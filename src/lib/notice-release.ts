// Sends legal notices that were confirmed outside the send window.
// The ODR cron is the scheduler. A dry run never reaches this list.

import { prisma } from "./db";
import { readOdrRules, sendWindowFromRules } from "./odr-store";
import { isLiveSendEnabled, deliverNotice, type EmailAttachment } from "./msg91";
import { emailNoticeVars, smsNoticeVars, whatsappNoticeVars } from "./notice-link";
import { noticePdfDataUri, noticePdfFileName, renderNoticePdf } from "./notice-pdf";
import { SEND_WINDOW_WAIT, windowHold } from "./send-window";
import type { SendChannel } from "./campaign-plan";

export async function releaseHeldNoticeSends(now = new Date()): Promise<number> {
  if (!(await isLiveSendEnabled())) return 0;
  const sendWindow = sendWindowFromRules(await readOdrRules());
  if (windowHold(now, sendWindow).hold) return 0;
  const held = await prisma.campaignDelivery.findMany({
    where: {
      status: "QUEUED",
      notBefore: { lte: now },
      detail: { startsWith: SEND_WINDOW_WAIT },
    },
    orderBy: { rowNumber: "asc" },
    take: 20,
    include: { campaign: { select: { dltTemplateId: true, bankId: true } } },
  });
  let sent = 0;
  for (const row of held) {
    const bank = await prisma.bank.findFirst({
      where: { id: row.bankId },
      select: { name: true, attachNoticePdf: true },
    });
    const channel = row.channel as SendChannel;
    let attachments: EmailAttachment[] | undefined;
    if (bank?.attachNoticePdf && channel === "EMAIL") {
      const pdf = await emailPdf(row.noticeNumber, row.bankId);
      if (!pdf.ok) {
        await prisma.campaignDelivery.update({
          where: { id: row.id },
          data: { status: "FAILED", detail: pdf.error },
        });
        continue;
      }
      attachments = [pdf.attachment];
    }
    const result = await deliverNotice({
      channel,
      to: channel === "EMAIL" ? row.email : row.mobile,
      body: row.messageText,
      dltTemplateId: row.campaign.dltTemplateId,
      attachments,
      sms: channel === "SMS" && row.noticeNumber
        ? smsNoticeVars({ customerName: row.customerName, bankName: bank?.name ?? "", noticeNumber: row.noticeNumber })
        : undefined,
      email: channel === "EMAIL" && row.noticeNumber
        ? emailNoticeVars({ customerName: row.customerName, loanAccount: row.loanNumber, noticeNumber: row.noticeNumber })
        : undefined,
      whatsapp: channel === "WHATSAPP" && row.noticeNumber
        ? whatsappNoticeVars({ customerName: row.customerName, bankName: bank?.name ?? "", noticeNumber: row.noticeNumber })
        : undefined,
    });
    await prisma.campaignDelivery.update({
      where: { id: row.id },
      data: result.ok
        ? {
            status: channel === "SMS" ? "SENT" : "DELIVERED",
            detail: channel === "SMS" ? "Sent to the operator." : "Handed to MSG91.",
            providerId: result.providerId,
            notBefore: null,
          }
        : { status: "FAILED", detail: result.error },
    });
    if (result.ok) sent += 1;
  }
  return sent;
}

async function emailPdf(
  noticeNumber: string,
  bankId: string,
): Promise<{ ok: true; attachment: EmailAttachment } | { ok: false; error: string }> {
  if (!noticeNumber) return { ok: false, error: "This row has no notice number. Nothing was sent." };
  const notice = await prisma.publicNotice.findFirst({ where: { noticeNumber, bankId } });
  if (!notice) return { ok: false, error: "The notice record is missing. Nothing was sent." };
  try {
    const pdf = await renderNoticePdf({
      customerName: notice.customerName,
      address: notice.address,
      outstandingAmount: notice.outstandingAmount,
      loanNumber: notice.loanNumber,
      bankName: notice.bankName,
      loanType: notice.loanType,
      referenceNumber: notice.referenceNumber,
      collectionManager: notice.collectionManager,
      collectionManagerMobile: notice.collectionManagerMobile,
      bankWebsite: notice.bankWebsite,
      noticeNumber: notice.noticeNumber,
      dated: notice.createdAt,
      documentFormat: notice.documentFormat,
      filledBody: notice.body,
    });
    return { ok: true, attachment: { fileName: noticePdfFileName(notice.noticeNumber), file: noticePdfDataUri(pdf) } };
  } catch {
    return { ok: false, error: "The notice PDF could not be prepared. Nothing was sent." };
  }
}
