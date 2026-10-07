// Per-bank retention. Zero days leaves that category alone.
// A bank legal hold skips the schedule for that bank.
// A person legal hold skips rows that match that person.
// Access logs stay for at least one year, including while a bank is on hold.

import type { PrismaClient } from "@prisma/client";
import { CLOSED_CASE_BLANK, EMPTY_SHEET } from "./data-min";
import { personMatchesHold, retentionCutoff, type HoldKey } from "./privacy-keys";

const BATCH = 40;

export async function enforcePrivacyRetention(db: PrismaClient, now: Date): Promise<void> {
  const schedules = await db.bankRetention.findMany();
  const heldBanks = schedules.filter((row) => row.legalHold).map((row) => row.bankId);
  for (const schedule of schedules) {
    if (schedule.legalHold) continue;
    const holds = await db.personLegalHold.findMany({
      where: { bankId: schedule.bankId, active: true },
      select: { accountKey: true, mobileKey: true, emailKey: true },
    });
    await purgeClosedCases(db, schedule.bankId, schedule.closedCaseDays, now, holds);
    await purgeMessages(db, schedule.bankId, schedule.messageDays, now, holds);
    await purgeDocuments(db, schedule.bankId, schedule.documentDays, now, holds);
    await purgeNotices(db, schedule.bankId, schedule.publicNoticeDays, now, holds);
    await purgeCampaigns(db, schedule.bankId, schedule.campaignDays, now, holds);
  }
  await purgeAccessLogs(db, now, heldBanks);
}

async function purgeClosedCases(
  db: PrismaClient,
  bankId: string,
  days: number,
  now: Date,
  holds: HoldKey[],
): Promise<void> {
  const cutoff = retentionCutoff(now, days);
  if (!cutoff) return;
  const rows = await db.odrCase.findMany({
    where: {
      bankId,
      status: { in: ["CLOSED", "SETTLED", "AWARD_PASSED"] },
      updatedAt: { lt: cutoff },
      NOT: { customerName: "" },
    },
    select: { id: true, accountNumber: true, mobile: true, email: true },
    take: BATCH,
  });
  for (const row of rows) {
    if (personMatchesHold(holds, row)) continue;
    await db.odrCase.update({ where: { id: row.id }, data: CLOSED_CASE_BLANK });
    await db.odrRespondent.deleteMany({ where: { caseId: row.id } });
    await db.odrMessage.deleteMany({ where: { caseId: row.id } });
    await db.odrDocument.deleteMany({ where: { caseId: row.id } });
  }
}

async function purgeMessages(
  db: PrismaClient,
  bankId: string,
  days: number,
  now: Date,
  holds: HoldKey[],
): Promise<void> {
  const cutoff = retentionCutoff(now, days);
  if (!cutoff) return;
  const rows = await db.odrMessage.findMany({
    where: { bankId, createdAt: { lt: cutoff } },
    select: {
      id: true,
      toAddress: true,
      case: { select: { accountNumber: true, mobile: true, email: true } },
    },
    take: BATCH,
  });
  const ids = rows
    .filter(
      (row) =>
        !personMatchesHold(holds, {
          account: row.case.accountNumber,
          mobile: row.toAddress || row.case.mobile,
          email: row.case.email,
        }),
    )
    .map((row) => row.id);
  if (ids.length === 0) return;
  await db.odrMessage.deleteMany({ where: { id: { in: ids } } });
}

async function purgeDocuments(
  db: PrismaClient,
  bankId: string,
  days: number,
  now: Date,
  holds: HoldKey[],
): Promise<void> {
  const cutoff = retentionCutoff(now, days);
  if (!cutoff) return;
  const rows = await db.odrDocument.findMany({
    where: { bankId, createdAt: { lt: cutoff } },
    select: { id: true, case: { select: { accountNumber: true, mobile: true, email: true } } },
    take: BATCH,
  });
  const ids = rows.filter((row) => !personMatchesHold(holds, row.case)).map((row) => row.id);
  if (ids.length === 0) return;
  await db.odrDocument.deleteMany({ where: { id: { in: ids } } });
}

async function purgeNotices(
  db: PrismaClient,
  bankId: string,
  days: number,
  now: Date,
  holds: HoldKey[],
): Promise<void> {
  const cutoff = retentionCutoff(now, days);
  if (!cutoff) return;
  const rows = await db.publicNotice.findMany({
    where: { bankId, createdAt: { lt: cutoff } },
    select: { id: true, loanNumber: true, customerId: true, referenceNumber: true, collectionManagerMobile: true },
    take: BATCH,
  });
  const ids = rows
    .filter(
      (row) =>
        !personMatchesHold(holds, {
          account: row.loanNumber || row.customerId || row.referenceNumber,
          mobile: row.collectionManagerMobile,
        }),
    )
    .map((row) => row.id);
  if (ids.length === 0) return;
  await db.publicNotice.deleteMany({ where: { id: { in: ids } } });
}

async function purgeCampaigns(
  db: PrismaClient,
  bankId: string,
  days: number,
  now: Date,
  holds: HoldKey[],
): Promise<void> {
  const cutoff = retentionCutoff(now, days);
  if (!cutoff) return;
  const deliveries = await db.campaignDelivery.findMany({
    where: { bankId, campaign: { createdAt: { lt: cutoff } }, NOT: { customerName: "", mobile: "", email: "" } },
    select: { id: true, loanNumber: true, customerId: true, mobile: true, email: true },
    take: BATCH,
  });
  const deliveryIds = deliveries
    .filter((row) => !personMatchesHold(holds, { account: row.loanNumber || row.customerId, mobile: row.mobile, email: row.email }))
    .map((row) => row.id);
  if (deliveryIds.length > 0) {
    await db.campaignDelivery.updateMany({
      where: { id: { in: deliveryIds } },
      data: { customerName: "", mobile: "", email: "", messageText: "" },
    });
  }
  const recipients = await db.recipientRow.findMany({
    where: { bankId, batch: { createdAt: { lt: cutoff } }, NOT: { customerName: "" } },
    select: { id: true, loanNumber: true, customerId: true, mobile1: true, email: true },
    take: BATCH,
  });
  for (const row of recipients) {
    if (personMatchesHold(holds, { account: row.loanNumber || row.customerId, mobile: row.mobile1, email: row.email })) continue;
    await db.recipientRow.update({
      where: { id: row.id },
      data: {
        customerName: "",
        mobile1: "",
        mobile2: "",
        mobile3: "",
        mobiles: "[]",
        email: "",
        address: "",
        loanNumber: "",
        customerId: "",
        loanAmount: "",
        outstandingAmount: "",
        referenceNumber: "",
        collectionManager: "",
        collectionManagerMobile: "",
        coBorrowerName: "",
        coBorrowerMobile: "",
        coBorrowerEmail: "",
        guarantorName: "",
        guarantorMobile: "",
        guarantorEmail: "",
      },
    });
  }
  if (holds.length > 0) return;
  const uploads = await db.uploadBatch.findMany({
    where: { bankId, createdAt: { lt: cutoff }, NOT: { rawRows: "[]" } },
    select: { id: true },
    take: BATCH,
  });
  for (const sheet of uploads) {
    await db.uploadBatch.update({ where: { id: sheet.id }, data: EMPTY_SHEET });
  }
  const odrSheets = await db.odrBatch.findMany({
    where: { bankId, createdAt: { lt: cutoff }, NOT: { rawRows: "[]" } },
    select: { id: true },
    take: BATCH,
  });
  for (const sheet of odrSheets) {
    await db.odrBatch.update({ where: { id: sheet.id }, data: EMPTY_SHEET });
  }
}

async function purgeAccessLogs(db: PrismaClient, now: Date, heldBanks: string[]): Promise<void> {
  const cutoff = retentionCutoff(now, 365);
  if (!cutoff) return;
  await db.odrAccessLog.deleteMany({
    where: {
      createdAt: { lt: cutoff },
      ...(heldBanks.length > 0 ? { bankId: { notIn: heldBanks } } : {}),
    },
  });
  await db.auditEvent.deleteMany({
    where: {
      createdAt: { lt: cutoff },
      ...(heldBanks.length > 0 ? { OR: [{ bankId: null }, { bankId: { notIn: heldBanks } }] } : {}),
    },
  });
}
