// Prepares a send for the current bank, then confirms it.
// With no MSG91 live-send switch, confirm records a dry run and does not call MSG91.

"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auditCurrentUser } from "@/lib/audit";
import { getSessionContext } from "@/lib/auth";
import { campaignWhere, recipientRowWhere, uploadBatchWhere } from "@/lib/bank-data";
import { workingBank } from "@/lib/bank-context";
import { isSendChannel, type SendChannel } from "@/lib/campaign-plan";
import { logDesk } from "@/lib/desk-log";
import { prisma } from "@/lib/db";
import { confirmSendsForReal } from "@/lib/live-send-switch";
import { liveSendIsOn } from "@/lib/live-send-store";
import { deliverNotice, dryRunReason, isLiveSendEnabled, msg91AuthKey, type EmailAttachment } from "@/lib/msg91";
import { emailNoticeVars, whatsappNoticeVars, smsNoticeVars } from "@/lib/notice-link";
import { noticePdfDataUri, noticePdfFileName, renderNoticePdf } from "@/lib/notice-pdf";
import { writePreparedDeliveries } from "@/lib/prepare-send";
import { tooManyAttempts } from "@/lib/rate-limit";
import { ensureStarterLegalNotice } from "@/lib/legal-notice-templates";
import { isOwnerAdmin } from "@/lib/owner-admin";
import { canSendNotices } from "@/lib/roles";
import { readOdrRules, sendWindowFromRules } from "@/lib/odr-store";
import { windowHold } from "@/lib/send-window";
import {
  isApprovedTemplateStatus,
  sendScope,
  TEMPLATE_APPROVED,
  templateWording,
  templateWordingSelect,
} from "@/lib/templates";

export type CampaignFormState = { error: string } | null;

async function adminBank() {
  const current = await getSessionContext();
  if (!current) redirect("/login");
  if (!canSendNotices(current.user.role)) {
    return { ok: false as const, error: "Only the owner or a legal coordinator can prepare a send." };
  }
  const bank = workingBank(current.user);
  if (!bank) {
    return { ok: false as const, error: "Choose a bank before preparing a send." };
  }
  if (!bank.active) {
    return {
      ok: false as const,
      error: "This bank is inactive. Mark it active on the Banks page before preparing a send.",
    };
  }
  return { ok: true as const, bank, userId: current.user.id, user: current.user };
}

export async function createCampaign(
  _previous: CampaignFormState,
  formData: FormData,
): Promise<CampaignFormState> {
  const scope = await adminBank();
  if (!scope.ok) return { error: scope.error };

  const batchId = String(formData.get("batchId") ?? "");
  const templateId = String(formData.get("templateId") ?? "");
  const legalNoticeTemplateId = String(formData.get("legalNoticeTemplateId") ?? "").trim();
  const channels = formData
    .getAll("channel")
    .map((value) => String(value).trim().toUpperCase())
    .filter(isSendChannel);

  if (channels.length === 0) {
    return { error: "Tick at least one channel: SMS, Email, or WhatsApp." };
  }

  const batch = await prisma.uploadBatch.findFirst({
    where: { id: batchId, ...uploadBatchWhere(scope.bank.id), saved: true },
  });
  if (!batch) {
    return { error: "Choose a spreadsheet that already has a saved column match." };
  }

  // Approved wording may have been written for another bank. Only those text fields are read.
  // The spreadsheet and its people must belong to the bank we are working on.
  const template = await prisma.noticeTemplate.findFirst({
    where: { id: templateId, status: TEMPLATE_APPROVED },
    select: templateWordingSelect,
  });
  const rows = await prisma.recipientRow.findMany({
    where: recipientRowWhere(scope.bank.id, batch.id),
    orderBy: { rowNumber: "asc" },
  });
  const decision = sendScope({
    workingBankId: scope.bank.id,
    template: template && isApprovedTemplateStatus(template.status) ? template : null,
    batch,
    rows,
  });
  if (!decision.ok || !template || !batch) {
    if (decision.ok === false && decision.reason === "batch") {
      return { error: "Choose a spreadsheet that already has a saved column match." };
    }
    if (decision.ok === false && decision.reason === "rows") {
      return { error: "That spreadsheet has no saved people for this bank." };
    }
    return { error: "Choose an approved template. Drafts cannot be sent." };
  }
  const wording = templateWording(template);
  await ensureStarterLegalNotice(prisma);
  const legalNotice = legalNoticeTemplateId
    ? await prisma.legalNoticeTemplate.findUnique({ where: { id: legalNoticeTemplateId } })
    : null;
  if (!legalNotice) {
    return { error: "Choose the legal notice." };
  }

  const live = await isLiveSendEnabled();
  const campaign = await prisma.$transaction(
    async (tx) => {
      const created = await tx.campaign.create({
        data: {
          bankId: scope.bank.id,
          batchId: batch.id,
          templateId: wording.id,
          templateName: wording.name,
          templateBody: wording.body,
          dltTemplateId: wording.dltTemplateId,
          legalNoticeTemplateId: legalNotice.id,
          legalNoticeName: legalNotice.name,
          legalNoticeBody: legalNotice.body,
          legalNoticeFormat: legalNotice.format,
          channels: JSON.stringify(channels),
          mode: live ? "LIVE" : "DRY_RUN",
          status: "REVIEW",
          dryRunNote: live ? "" : await dryRunReason(),
          createdById: scope.userId,
        },
      });
      await writePreparedDeliveries(tx, {
        campaignId: created.id,
        bankId: scope.bank.id,
        bankName: scope.bank.name,
        templateBody: wording.body,
        rows,
        channels,
        legalNotice: { format: legalNotice.format, body: legalNotice.body },
      });
      return created;
    },
    { timeout: 30000 },
  );

  redirect(`/campaigns/${campaign.id}`);
}

export async function startFollowUp(
  _previous: CampaignFormState,
  formData: FormData,
): Promise<CampaignFormState> {
  const scope = await adminBank();
  if (!scope.ok) return { error: scope.error };

  const parentId = String(formData.get("campaignId") ?? "");
  const parent = await prisma.campaign.findFirst({
    where: campaignWhere(scope.bank.id, parentId),
    include: { deliveries: { where: { bankId: scope.bank.id } } },
  });
  if (!parent) {
    return { error: "That send was not found for the bank you are working on." };
  }
  if (parent.status === "REVIEW") {
    return { error: "Confirm the send before preparing a follow-up." };
  }

  const openFollowUp = await prisma.campaign.findFirst({
    where: { followsCampaignId: parent.id, bankId: scope.bank.id, status: "REVIEW" },
    select: { id: true },
  });
  if (openFollowUp) redirect(`/campaigns/${openFollowUp.id}`);

  const missed = parent.deliveries.filter(
    (row) => row.status === "SKIPPED" || row.status === "FAILED",
  );
  if (missed.length === 0) {
    return { error: "Nobody was skipped or failed, so there is nobody to follow up." };
  }

  const channels = [...new Set(missed.map((row) => row.channel))].filter(isSendChannel);
  const rowIds = [...new Set(missed.map((row) => row.recipientRowId))];
  const rows = await prisma.recipientRow.findMany({
    where: { ...recipientRowWhere(scope.bank.id), id: { in: rowIds } },
    orderBy: { rowNumber: "asc" },
  });
  if (rows.length === 0) {
    return { error: "The people on that send could not be found." };
  }

  const missedKeys = new Set(missed.map((row) => `${row.recipientRowId}:${row.channel}`));
  const live = await isLiveSendEnabled();
  const note = `Follow-up to “${parent.templateName}”. People are matched on loan number, customer id, or mobile. ${
    live ? "Live send is on." : await dryRunReason()
  }`;
  let campaign;
  try {
    campaign = await prisma.$transaction(
      async (tx) => {
        const created = await tx.campaign.create({
          data: {
            bankId: scope.bank.id,
            batchId: parent.batchId,
            templateId: parent.templateId,
            templateName: parent.templateName,
            templateBody: parent.templateBody,
            dltTemplateId: parent.dltTemplateId,
            legalNoticeTemplateId: parent.legalNoticeTemplateId,
            legalNoticeName: parent.legalNoticeName,
            legalNoticeBody: parent.legalNoticeBody,
            legalNoticeFormat: parent.legalNoticeFormat,
            channels: JSON.stringify(channels),
            mode: live ? "LIVE" : "DRY_RUN",
            status: "REVIEW",
            dryRunNote: note,
            createdById: scope.userId,
            followsCampaignId: parent.id,
          },
        });
        const kept = await writePreparedDeliveries(tx, {
          campaignId: created.id,
          bankId: scope.bank.id,
          bankName: scope.bank.name,
          templateBody: parent.templateBody,
          rows,
          channels,
          include: missedKeys,
          legalNotice: parent.legalNoticeFormat
            ? { format: parent.legalNoticeFormat, body: parent.legalNoticeBody }
            : null,
        });
        if (kept === 0) throw new Error("NO_FOLLOW_UP");
        return created;
      },
      { timeout: 30000 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "NO_FOLLOW_UP") {
      return { error: "Nobody was skipped or failed, so there is nobody to follow up." };
    }
    throw error;
  }

  await auditCurrentUser({
    action: "campaign.follow-up",
    summary: `Prepared a follow-up to ${parent.templateName}. Nothing was sent.`,
    bankId: scope.bank.id,
    bankName: scope.bank.name,
    targetId: campaign.id,
  });

  redirect(`/campaigns/${campaign.id}`);
}

export async function confirmCampaign(
  _previous: CampaignFormState,
  formData: FormData,
): Promise<CampaignFormState> {
  const scope = await adminBank();
  if (!scope.ok) return { error: scope.error };

  const campaignId = String(formData.get("campaignId") ?? "");
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, bankId: scope.bank.id },
  });
  if (!campaign) {
    return { error: "That send was not found for the bank you are working on." };
  }
  if (campaign.status !== "REVIEW") {
    return { error: "This send was already confirmed." };
  }

  const headerList = await headers();
  const ip = (headerList.get("x-forwarded-for") ?? "local").split(",")[0]?.trim() || "local";
  if (tooManyAttempts(`confirm:${scope.userId}:${ip}`, 12, 60 * 1000)) {
    return { error: "Too many confirmations. Wait a minute and try again." };
  }

  const switchOn = await liveSendIsOn();
  const sends = confirmSendsForReal({
    switchOn,
    preparedLive: campaign.mode === "LIVE",
    authKeySet: Boolean(msg91AuthKey()),
  });
  if (!sends) {
    if (switchOn && campaign.mode === "LIVE") {
      return {
        error: isOwnerAdmin(scope.user)
          ? "Live send is on, but MSG91 is not set up, so nothing was sent."
          : "Sending is turned on, but it is not ready yet, so nothing was sent.",
      };
    }
    const done = await finishDryRun(campaign.id, scope.bank.id);
    if (done) {
      await auditCurrentUser({
        action: "campaign.dry-run",
        summary: `Confirmed a dry run of ${campaign.templateName}. Nothing was sent.`,
        bankId: scope.bank.id,
        bankName: scope.bank.name,
        targetId: campaign.id,
      });
    }
    redirect(`/campaigns/${campaign.id}?done=1`);
  }

  const done = await finishLiveSend(campaign.id, scope.bank.id, campaign.dltTemplateId);
  if (!done) {
    const current = await prisma.campaign.findFirst({
      where: { id: campaign.id, bankId: scope.bank.id },
      select: { status: true },
    });
    if (current?.status === "REVIEW") {
      return { error: "This send is already being confirmed. Wait a moment, then refresh." };
    }
  }
  if (done) {
    await auditCurrentUser({
      action: "campaign.confirm",
      summary: `Confirmed a live send of ${campaign.templateName}.`,
      bankId: scope.bank.id,
      bankName: scope.bank.name,
      targetId: campaign.id,
    });
  }
  redirect(`/campaigns/${campaign.id}?done=1`);
}

async function finishDryRun(campaignId: string, bankId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.campaign.updateMany({
      where: { id: campaignId, bankId, status: "REVIEW" },
      data: {
        status: "COMPLETED",
        mode: "DRY_RUN",
        confirmedAt: new Date(),
      },
    });
    if (updated.count !== 1) return false;
    await tx.campaignDelivery.updateMany({
      where: { campaignId, status: "PENDING" },
      data: {
        status: "SIMULATED_SENT",
        detail: "Dry run. Queued here as a simulated send. Nothing was sent.",
      },
    });
    return true;
  });
}

async function finishLiveSend(
  campaignId: string,
  bankId: string,
  dltTemplateId: string,
): Promise<boolean> {
  // Each pending row is claimed (PENDING -> QUEUED) before MSG91 is called.
  // A second confirm sees no PENDING row, so the same person is not sent twice.
  if (!(await isLiveSendEnabled())) return false;

  const bank = await prisma.bank.findFirst({
    where: { id: bankId },
    select: { name: true, attachNoticePdf: true },
  });
  const bankName = bank?.name ?? "";
  const attachPdf = bank?.attachNoticePdf === true;
  const pending = await prisma.campaignDelivery.findMany({
    where: { campaignId, bankId, status: "PENDING" },
    orderBy: { rowNumber: "asc" },
  });
  if (pending.length === 0) {
    const busy = await prisma.campaignDelivery.count({
      where: { campaignId, bankId, status: "QUEUED" },
    });
    if (busy > 0) return false;
  }

  const sendWindow = sendWindowFromRules(await readOdrRules());
  let attempted = 0;
  let failed = 0;
  for (const row of pending) {
    const claim = await prisma.campaignDelivery.updateMany({
      where: { id: row.id, campaignId, bankId, status: "PENDING" },
      data: { status: "QUEUED", detail: "Claimed for MSG91. A second confirm will not send this row again." },
    });
    if (claim.count !== 1) continue;
    attempted += 1;
    logDesk("send.claim", { campaignId, deliveryId: row.id, channel: row.channel });
    const held = windowHold(new Date(), sendWindow);
    if (held.hold) {
      await prisma.campaignDelivery.updateMany({
        where: { id: row.id, campaignId, bankId, status: "QUEUED" },
        data: { status: "QUEUED", notBefore: held.notBefore, detail: held.detail },
      });
      continue;
    }

    const channel = row.channel as SendChannel;
    const to = channel === "EMAIL" ? row.email : row.mobile;
    let attachments: EmailAttachment[] | undefined;
    let blocked = "";
    if (attachPdf && channel === "EMAIL") {
        const pdf = await emailPdfAttachment(row.noticeNumber, bankId);
      if (!pdf.ok) blocked = pdf.error;
      else attachments = [pdf.attachment];
    }

    let result: { ok: true; providerId: string; detail: string } | { ok: false; error: string };
    if (blocked) {
      result = { ok: false, error: blocked };
    } else {
      try {
        const sent = await deliverNotice({
          channel,
          to,
          body: row.messageText,
          dltTemplateId,
          attachments,
          sms:
            channel === "SMS" && row.noticeNumber
              ? smsNoticeVars({
                  customerName: row.customerName,
                  bankName,
                  noticeNumber: row.noticeNumber,
                })
              : undefined,
          email:
            channel === "EMAIL" && row.noticeNumber
              ? emailNoticeVars({
                  customerName: row.customerName,
                  loanAccount: row.loanNumber,
                  noticeNumber: row.noticeNumber,
                })
              : undefined,
          whatsapp:
            channel === "WHATSAPP" && row.noticeNumber
              ? whatsappNoticeVars({
                  customerName: row.customerName,
                  bankName,
                  noticeNumber: row.noticeNumber,
                })
              : undefined,
        });
        result = sent.ok
          ? {
              ok: true,
              providerId: sent.providerId,
              detail: attachments ? "Handed to MSG91 with a notice PDF. The notice link is unchanged." : "Handed to MSG91.",
            }
          : sent;
      } catch (error) {
        console.error(error instanceof Error ? error.message : "send failed");
        result = { ok: false, error: "The send stopped before MSG91 accepted it." };
      }
    }

    await prisma.campaignDelivery.updateMany({
      where: { id: row.id, campaignId, bankId, status: "QUEUED" },
      data: result.ok
        ? {
            // SMS acceptance is only a handoff. Delivered or failed comes from the receipt.
            status: channel === "SMS" ? "SENT" : "DELIVERED",
            detail: channel === "SMS" ? "Sent to the operator." : result.detail,
            providerId: result.providerId,
          }
        : { status: "FAILED", detail: result.error },
    });
    if (!result.ok) failed += 1;
    logDesk("send.result", { campaignId, deliveryId: row.id, channel: row.channel, ok: result.ok });
  }

  const updated = await prisma.campaign.updateMany({
    where: { id: campaignId, bankId, status: "REVIEW" },
    data: {
      status: attempted > 0 && failed === attempted ? "FAILED" : "COMPLETED",
      mode: "LIVE",
      confirmedAt: new Date(),
    },
  });
  return updated.count === 1;
}

async function emailPdfAttachment(
  noticeNumber: string,
  bankId: string,
): Promise<{ ok: true; attachment: EmailAttachment } | { ok: false; error: string }> {
  if (!noticeNumber) {
    return { ok: false, error: "Notice PDF is on for this bank, but this row has no notice number. Nothing was sent." };
  }
  const notice = await prisma.publicNotice.findFirst({ where: { noticeNumber, bankId } });
  if (!notice) {
    return { ok: false, error: "Notice PDF is on for this bank, but the notice record is missing. Nothing was sent." };
  }
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
    return {
      ok: true,
      attachment: {
        fileName: noticePdfFileName(notice.noticeNumber),
        file: noticePdfDataUri(pdf),
      },
    };
  } catch (error) {
    console.error(error instanceof Error ? error.message : "pdf failed");
    return { ok: false, error: "The notice PDF could not be prepared. Nothing was sent." };
  }
}
