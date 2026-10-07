// Find, correct, and erase one person's rows for a single bank.
// Audit text is built by the caller from counts, never from the values removed.

import type { PrismaClient } from "@prisma/client";
import { maskContact, maskEmail, maskMobile } from "./mask";
import { personMatchesHold, searchNeedles, type HoldKey, type SearchNeedles } from "./privacy-keys";

export const PERSON_KINDS = [
  "notice",
  "case",
  "message",
  "document",
  "respondent",
  "recipient",
  "delivery",
  "upload",
  "odr-upload",
] as const;

export type PersonKind = (typeof PERSON_KINDS)[number];

export type PersonHit = {
  kind: PersonKind;
  id: string;
  title: string;
  detail: string;
  held: boolean;
};

const CORRECT_FIELDS: Record<string, string[]> = {
  notice: ["customerName", "address", "loanNumber", "customerId"],
  case: ["customerName", "mobile", "email", "accountNumber", "address"],
  message: ["toAddress"],
  document: ["note"],
  respondent: ["name", "mobile", "email", "address"],
  recipient: ["customerName", "mobile1", "email", "address", "loanNumber"],
  delivery: ["customerName", "mobile", "email", "loanNumber"],
};

export function correctFieldAllowed(kind: string, field: string): boolean {
  return (CORRECT_FIELDS[kind] ?? []).includes(field);
}

export function redactRawSheet(raw: string, needles: SearchNeedles): string {
  let rows: unknown;
  try {
    rows = JSON.parse(raw);
  } catch {
    return "[]";
  }
  if (!Array.isArray(rows)) return "[]";
  const exact = new Set(
    [needles.text, needles.email, ...needles.accounts, ...needles.mobiles]
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
  const next = rows.map((row) => blankRow(row, exact, needles.mobile));
  return JSON.stringify(next);
}

function blankRow(row: unknown, exact: Set<string>, mobile: string): unknown {
  if (Array.isArray(row)) return row.map((cell) => (cellMatches(cell, exact, mobile) ? "" : cell));
  if (!row || typeof row !== "object") return row;
  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    copy[key] = cellMatches(value, exact, mobile) ? "" : value;
  }
  return copy;
}

function cellMatches(value: unknown, exact: Set<string>, mobile: string): boolean {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return false;
  if (exact.has(text)) return true;
  if (mobile && text.replace(/\D/g, "").endsWith(mobile)) return true;
  return false;
}

export async function searchPeople(db: PrismaClient, bankId: string, query: string): Promise<PersonHit[]> {
  const needles = searchNeedles(query);
  if (!needles.email && !needles.mobile && needles.accounts.length === 0) return [];
  const holds = await db.personLegalHold.findMany({
    where: { bankId, active: true },
    select: { accountKey: true, mobileKey: true, emailKey: true },
  });
  const hits: PersonHit[] = [];

  const noticeOr = accountOr(needles, ["loanNumber", "customerId", "referenceNumber"]);
  const notices = noticeOr.length === 0 ? [] : await db.publicNotice.findMany({
    where: { bankId, OR: noticeOr },
    select: { id: true, noticeNumber: true, customerName: true, loanNumber: true, customerId: true, referenceNumber: true, collectionManagerMobile: true },
    take: 40,
  });
  for (const row of notices) {
    hits.push({
      kind: "notice",
      id: row.id,
      title: `Public notice ${row.noticeNumber}`,
      detail: row.customerName || row.noticeNumber,
      held: personMatchesHold(holds, { account: row.loanNumber || row.customerId || row.referenceNumber, mobile: row.collectionManagerMobile }),
    });
  }

  const cases = await db.odrCase.findMany({
    where: {
      bankId,
      OR: [
        ...accountOr(needles, ["accountNumber", "refNo"]),
        ...mobileOr(needles, "mobile"),
        ...emailOr(needles, "email"),
      ],
    },
    select: { id: true, refNo: true, customerName: true, accountNumber: true, mobile: true, email: true },
    take: 40,
  });
  const caseIds = cases.map((row) => row.id);
  for (const row of cases) {
    hits.push({
      kind: "case",
      id: row.id,
      title: `ODR case ${row.refNo}`,
      detail: `${row.customerName} · ${maskContact(row.mobile, row.email)}`,
      held: personMatchesHold(holds, row),
    });
  }

  const respondentOr = [
    ...mobileOr(needles, "mobile"),
    ...emailOr(needles, "email"),
    ...(caseIds.length ? [{ caseId: { in: caseIds } }] : []),
  ];
  const respondents = respondentOr.length === 0 ? [] : await db.odrRespondent.findMany({
    where: { bankId, OR: respondentOr },
    select: { id: true, name: true, mobile: true, email: true, case: { select: { accountNumber: true, refNo: true } } },
    take: 40,
  });
  for (const row of respondents) {
    hits.push({
      kind: "respondent",
      id: row.id,
      title: `Co-party on ${row.case.refNo}`,
      detail: `${row.name} · ${maskContact(row.mobile, row.email)}`,
      held: personMatchesHold(holds, { account: row.case.accountNumber, mobile: row.mobile, email: row.email }),
    });
  }

  if (caseIds.length > 0 || needles.mobiles.length > 0 || needles.email) {
    const messages = await db.odrMessage.findMany({
      where: {
        bankId,
        OR: [
          ...(caseIds.length ? [{ caseId: { in: caseIds } }] : []),
          ...needles.mobiles.map((value) => ({ toAddress: { contains: value } })),
          ...(needles.email ? [{ toAddress: needles.email }] : []),
        ],
      },
      select: { id: true, channel: true, toAddress: true, case: { select: { accountNumber: true, mobile: true, email: true, refNo: true } } },
      take: 40,
    });
    for (const row of messages) {
      hits.push({
        kind: "message",
        id: row.id,
        title: `${row.channel} on ${row.case.refNo}`,
        detail: row.toAddress.includes("@") ? maskEmail(row.toAddress) : maskMobile(row.toAddress),
        held: personMatchesHold(holds, {
          account: row.case.accountNumber,
          mobile: row.toAddress || row.case.mobile,
          email: row.toAddress.includes("@") ? row.toAddress : row.case.email,
        }),
      });
    }
    const documents = await db.odrDocument.findMany({
      where: { bankId, caseId: { in: caseIds } },
      select: { id: true, fileName: true, kind: true, case: { select: { accountNumber: true, mobile: true, email: true, refNo: true } } },
      take: 40,
    });
    for (const row of documents) {
      hits.push({
        kind: "document",
        id: row.id,
        title: `${row.kind} on ${row.case.refNo}`,
        detail: row.fileName,
        held: personMatchesHold(holds, row.case),
      });
    }
  }

  const recipients = await db.recipientRow.findMany({
    where: {
      bankId,
      OR: [
        ...accountOr(needles, ["loanNumber", "customerId", "referenceNumber"]),
        ...mobileOr(needles, "mobile1"),
        ...mobileOr(needles, "mobile2"),
        ...mobileOr(needles, "mobile3"),
        ...emailOr(needles, "email"),
      ],
    },
    select: { id: true, customerName: true, mobile1: true, email: true, loanNumber: true, customerId: true },
    take: 40,
  });
  for (const row of recipients) {
    hits.push({
      kind: "recipient",
      id: row.id,
      title: "Notice upload row",
      detail: `${row.customerName} · ${maskContact(row.mobile1, row.email)}`,
      held: personMatchesHold(holds, { account: row.loanNumber || row.customerId, mobile: row.mobile1, email: row.email }),
    });
  }

  const deliveries = await db.campaignDelivery.findMany({
    where: {
      bankId,
      OR: [
        ...accountOr(needles, ["loanNumber", "customerId"]),
        ...mobileOr(needles, "mobile"),
        ...emailOr(needles, "email"),
      ],
    },
    select: { id: true, customerName: true, mobile: true, email: true, loanNumber: true, customerId: true, channel: true },
    take: 40,
  });
  for (const row of deliveries) {
    hits.push({
      kind: "delivery",
      id: row.id,
      title: `${row.channel} delivery`,
      detail: `${row.customerName} · ${maskContact(row.mobile, row.email)}`,
      held: personMatchesHold(holds, { account: row.loanNumber || row.customerId, mobile: row.mobile, email: row.email }),
    });
  }

  const sheetNeedle = needles.mobile || needles.email || needles.accounts[0] || "";
  if (sheetNeedle) {
    const uploads = await db.uploadBatch.findMany({
      where: { bankId, rawRows: { contains: sheetNeedle } },
      select: { id: true, fileName: true },
      take: 20,
    });
    for (const row of uploads) {
      hits.push({ kind: "upload", id: row.id, title: "Notice spreadsheet", detail: row.fileName, held: false });
    }
    const odrUploads = await db.odrBatch.findMany({
      where: { bankId, rawRows: { contains: sheetNeedle } },
      select: { id: true, fileName: true },
      take: 20,
    });
    for (const row of odrUploads) {
      hits.push({ kind: "odr-upload", id: row.id, title: "ODR spreadsheet", detail: row.fileName, held: false });
    }
  }

  return hits;
}

function accountOr(needles: SearchNeedles, fields: string[]): Array<Record<string, { in: string[] }>> {
  if (needles.accounts.length === 0) return [];
  return fields.map((field) => ({ [field]: { in: needles.accounts } }));
}

function mobileOr(needles: SearchNeedles, field: string): Array<Record<string, { contains: string }>> {
  if (!needles.mobile) return [];
  return [{ [field]: { contains: needles.mobile } }];
}

function emailOr(needles: SearchNeedles, field: string): Array<Record<string, string>> {
  if (!needles.email) return [];
  return [{ [field]: needles.email }];
}

export async function bankHoldMessage(db: PrismaClient, bankId: string): Promise<string> {
  const row = await db.bankRetention.findUnique({ where: { bankId }, select: { legalHold: true } });
  if (row?.legalHold) return "This bank is on a legal hold. Erasure is blocked.";
  return "";
}

export async function erasePersonRow(
  db: PrismaClient,
  bankId: string,
  kind: PersonKind,
  id: string,
  query: string,
): Promise<{ error: string } | { erased: number }> {
  const blocked = await bankHoldMessage(db, bankId);
  if (blocked) return { error: blocked };
  const holds = await db.personLegalHold.findMany({
    where: { bankId, active: true },
    select: { accountKey: true, mobileKey: true, emailKey: true },
  });
  const needles = searchNeedles(query);
  if (kind === "notice") return eraseNotice(db, bankId, id, holds);
  if (kind === "case") return eraseCase(db, bankId, id, holds);
  if (kind === "message") return eraseMessage(db, bankId, id, holds);
  if (kind === "document") return eraseDocument(db, bankId, id, holds);
  if (kind === "respondent") return eraseRespondent(db, bankId, id, holds);
  if (kind === "recipient") return eraseRecipient(db, bankId, id, holds);
  if (kind === "delivery") return eraseDelivery(db, bankId, id, holds);
  if (kind === "upload") return eraseUpload(db, bankId, id, needles, holds);
  return eraseOdrUpload(db, bankId, id, needles);
}

async function eraseNotice(db: PrismaClient, bankId: string, id: string, holds: HoldKey[]) {
  const row = await db.publicNotice.findFirst({ where: { id, bankId } });
  if (!row) return { error: "That notice is not on this bank." };
  if (personMatchesHold(holds, { account: row.loanNumber || row.customerId, mobile: row.collectionManagerMobile })) {
    return { error: "This person is on a legal hold. Erasure is blocked." };
  }
  await db.publicNotice.update({
    where: { id },
    data: {
      customerName: "",
      address: "",
      loanAmount: "",
      outstandingAmount: "",
      loanNumber: "",
      customerId: "",
      loanType: "",
      referenceNumber: "",
      collectionManager: "",
      collectionManagerMobile: "",
      bankWebsite: "",
      body: "",
    },
  });
  return { erased: 1 };
}

async function eraseCase(db: PrismaClient, bankId: string, id: string, holds: HoldKey[]) {
  const row = await db.odrCase.findFirst({ where: { id, bankId } });
  if (!row) return { error: "That case is not on this bank." };
  if (personMatchesHold(holds, row)) return { error: "This person is on a legal hold. Erasure is blocked." };
  await db.odrCase.update({
    where: { id },
    data: {
      customerName: "",
      coParties: "",
      accountNumber: "",
      mobile: "",
      email: "",
      address: "",
      loanAmount: "",
      claimAmount: "",
      disputeSummary: "",
      bankContact: "",
      paymentInfo: "",
      paperJson: "{}",
    },
  });
  await db.odrRespondent.deleteMany({ where: { caseId: id } });
  await db.odrMessage.deleteMany({ where: { caseId: id } });
  await db.odrDocument.deleteMany({ where: { caseId: id } });
  return { erased: 1 };
}

async function eraseMessage(db: PrismaClient, bankId: string, id: string, holds: HoldKey[]) {
  const row = await db.odrMessage.findFirst({
    where: { id, bankId },
    include: { case: { select: { accountNumber: true, mobile: true, email: true } } },
  });
  if (!row) return { error: "That message is not on this bank." };
  if (personMatchesHold(holds, { account: row.case.accountNumber, mobile: row.toAddress || row.case.mobile, email: row.case.email })) {
    return { error: "This person is on a legal hold. Erasure is blocked." };
  }
  await db.odrMessage.delete({ where: { id } });
  return { erased: 1 };
}

async function eraseDocument(db: PrismaClient, bankId: string, id: string, holds: HoldKey[]) {
  const row = await db.odrDocument.findFirst({
    where: { id, bankId },
    include: { case: { select: { accountNumber: true, mobile: true, email: true } } },
  });
  if (!row) return { error: "That document is not on this bank." };
  if (personMatchesHold(holds, row.case)) return { error: "This person is on a legal hold. Erasure is blocked." };
  await db.odrDocument.delete({ where: { id } });
  return { erased: 1 };
}

async function eraseRespondent(db: PrismaClient, bankId: string, id: string, holds: HoldKey[]) {
  const row = await db.odrRespondent.findFirst({
    where: { id, bankId },
    include: { case: { select: { accountNumber: true } } },
  });
  if (!row) return { error: "That person is not on this bank." };
  if (personMatchesHold(holds, { account: row.case.accountNumber, mobile: row.mobile, email: row.email })) {
    return { error: "This person is on a legal hold. Erasure is blocked." };
  }
  await db.odrRespondent.delete({ where: { id } });
  return { erased: 1 };
}

async function eraseRecipient(db: PrismaClient, bankId: string, id: string, holds: HoldKey[]) {
  const row = await db.recipientRow.findFirst({ where: { id, bankId } });
  if (!row) return { error: "That row is not on this bank." };
  if (personMatchesHold(holds, { account: row.loanNumber || row.customerId, mobile: row.mobile1, email: row.email })) {
    return { error: "This person is on a legal hold. Erasure is blocked." };
  }
  await db.recipientRow.update({
    where: { id },
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
      coBorrowerName: "",
      coBorrowerMobile: "",
      coBorrowerEmail: "",
      guarantorName: "",
      guarantorMobile: "",
      guarantorEmail: "",
    },
  });
  return { erased: 1 };
}

async function eraseDelivery(db: PrismaClient, bankId: string, id: string, holds: HoldKey[]) {
  const row = await db.campaignDelivery.findFirst({ where: { id, bankId } });
  if (!row) return { error: "That delivery is not on this bank." };
  if (personMatchesHold(holds, { account: row.loanNumber || row.customerId, mobile: row.mobile, email: row.email })) {
    return { error: "This person is on a legal hold. Erasure is blocked." };
  }
  await db.campaignDelivery.update({
    where: { id },
    data: { customerName: "", mobile: "", email: "", messageText: "" },
  });
  return { erased: 1 };
}

async function eraseUpload(db: PrismaClient, bankId: string, id: string, needles: SearchNeedles, holds: HoldKey[]) {
  const row = await db.uploadBatch.findFirst({ where: { id, bankId } });
  if (!row) return { error: "That upload is not on this bank." };
  if (holds.length > 0) return { error: "A person on this bank is on a legal hold. Clear the hold before erasing a spreadsheet." };
  await db.uploadBatch.update({ where: { id }, data: { rawRows: redactRawSheet(row.rawRows, needles) } });
  return { erased: 1 };
}

async function eraseOdrUpload(db: PrismaClient, bankId: string, id: string, needles: SearchNeedles) {
  const row = await db.odrBatch.findFirst({ where: { id, bankId } });
  if (!row) return { error: "That upload is not on this bank." };
  await db.odrBatch.update({ where: { id }, data: { rawRows: redactRawSheet(row.rawRows, needles) } });
  return { erased: 1 };
}

export async function correctPersonRow(
  db: PrismaClient,
  bankId: string,
  kind: PersonKind,
  id: string,
  field: string,
  value: string,
): Promise<{ error: string } | { corrected: true }> {
  if (!correctFieldAllowed(kind, field)) return { error: "That field cannot be corrected here." };
  const next = value.trim().slice(0, 500);
  if (!next) return { error: "Enter the corrected value." };
  const data = { [field]: next };
  if (kind === "notice") {
    const row = await db.publicNotice.updateMany({ where: { id, bankId }, data });
    return row.count === 1 ? { corrected: true } : { error: "That notice is not on this bank." };
  }
  if (kind === "case") {
    const row = await db.odrCase.updateMany({ where: { id, bankId }, data });
    return row.count === 1 ? { corrected: true } : { error: "That case is not on this bank." };
  }
  if (kind === "message") {
    const row = await db.odrMessage.updateMany({ where: { id, bankId }, data });
    return row.count === 1 ? { corrected: true } : { error: "That message is not on this bank." };
  }
  if (kind === "document") {
    const row = await db.odrDocument.updateMany({ where: { id, bankId }, data });
    return row.count === 1 ? { corrected: true } : { error: "That document is not on this bank." };
  }
  if (kind === "respondent") {
    const row = await db.odrRespondent.updateMany({ where: { id, bankId }, data });
    return row.count === 1 ? { corrected: true } : { error: "That person is not on this bank." };
  }
  if (kind === "recipient") {
    const row = await db.recipientRow.updateMany({ where: { id, bankId }, data });
    return row.count === 1 ? { corrected: true } : { error: "That row is not on this bank." };
  }
  if (kind === "delivery") {
    const row = await db.campaignDelivery.updateMany({ where: { id, bankId }, data });
    return row.count === 1 ? { corrected: true } : { error: "That delivery is not on this bank." };
  }
  return { error: "That record cannot be corrected here. Use erase for a spreadsheet." };
}
