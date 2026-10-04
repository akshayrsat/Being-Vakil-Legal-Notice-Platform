// Writes one public notice per person, then the channel rows that point at it.

import type { Prisma } from "@prisma/client";
import { planDeliveries, type SendChannel } from "./campaign-plan";
import type { NoticeRecipient } from "./merge-notice";
import { assignNoticeNumbers, buildNoticeDraft } from "./public-notice";

type PlanRow = NoticeRecipient & {
  id: string;
  rowNumber: number;
};

export async function writePreparedDeliveries(
  db: Prisma.TransactionClient,
  input: {
    campaignId: string;
    bankId: string;
    bankName: string;
    templateBody: string;
    rows: PlanRow[];
    channels: SendChannel[];
    include?: ReadonlySet<string>;
    legalNotice?: { format: string; body: string } | null;
  },
): Promise<number> {
  const rows = includedRows(input.rows, input.include);
  const numbers = await assignNoticeNumbers(db, rows.length);
  const drafts = rows.map((row, index) => {
    const noticeNumber = numbers[index];
    if (!noticeNumber) throw new Error("Could not assign a notice number.");
    return buildNoticeDraft(row, input.bankName, noticeNumber, input.legalNotice);
  });

  if (drafts.length > 0) {
    await db.publicNotice.createMany({
      data: drafts.map((draft) => ({
        noticeNumber: draft.noticeNumber,
        bankId: input.bankId,
        campaignId: input.campaignId,
        recipientRowId: draft.recipientRowId,
        customerName: draft.customerName,
        address: draft.address,
        loanAmount: draft.loanAmount,
        outstandingAmount: draft.outstandingAmount,
        loanNumber: draft.loanNumber,
        customerId: draft.customerId,
        loanType: draft.loanType,
        referenceNumber: draft.referenceNumber,
        collectionManager: draft.collectionManager,
        collectionManagerMobile: draft.collectionManagerMobile,
        bankWebsite: draft.bankWebsite,
        bankName: draft.bankName,
        body: draft.body,
        documentFormat: draft.documentFormat,
      })),
    });
  }

  const noticeNumbers = new Map(drafts.map((draft) => [draft.recipientRowId, draft.noticeNumber]));
  const planned = planDeliveries(
    rows,
    input.channels,
    input.bankName,
    input.templateBody,
    noticeNumbers,
  ).filter((row) => !input.include || input.include.has(`${row.recipientRowId}:${row.channel}`));
  const deliveries = planned.map((row) => ({
    campaignId: input.campaignId,
    bankId: input.bankId,
    recipientRowId: row.recipientRowId,
    rowNumber: row.rowNumber,
    customerName: row.customerName,
    mobile: row.mobile,
    email: row.email,
    loanNumber: row.loanNumber,
    customerId: row.customerId,
    channel: row.channel,
    status: row.status,
    detail: row.detail,
    messageText: row.messageText,
    noticeNumber: row.noticeNumber,
  }));

  for (let index = 0; index < deliveries.length; index += 200) {
    await db.campaignDelivery.createMany({ data: deliveries.slice(index, index + 200) });
  }
  return deliveries.length;
}

function includedRows(rows: PlanRow[], include: ReadonlySet<string> | undefined): PlanRow[] {
  if (!include) return rows;
  const ids = new Set([...include].map((key) => key.slice(0, key.lastIndexOf(":"))));
  return rows.filter((row) => ids.has(row.id));
}
