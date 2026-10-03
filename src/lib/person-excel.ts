// One Excel workbook for the person on the loan page.
// One row per notice. SMS, email, and WhatsApp sit on that row.
// A row is kept only when the notice and the send belong to the working bank
// and to the loan or account on screen. Another person's row is left out.

import ExcelJS from "exceljs";
import { NO_BANK, requiredBankId } from "./bank-data";
import { deliveryStatusLabel } from "./campaigns";
import { prisma } from "./db";
import { formatIndiaDateTime } from "./india-day";

export const PERSON_EXCEL_COLUMNS = [
  "Name",
  "Account or loan number",
  "Notice number",
  "Date",
  "SMS",
  "Email",
  "WhatsApp",
] as const;

export const NOT_SENT = "Not sent";

const EXPORT_LIMIT = 2000;

type ChannelKey = "SMS" | "EMAIL" | "WHATSAPP";

export type PersonNoticeSource = {
  bankId: string;
  noticeNumber: string;
  customerName: string;
  loanNumber: string;
  customerId: string;
  createdAt: Date;
};

export type PersonDeliverySource = {
  bankId: string;
  campaignBankId: string;
  batchBankId: string;
  customerName: string;
  loanNumber: string;
  customerId: string;
  channel: string;
  status: string;
  noticeNumber: string;
  sentAt: Date;
};

export type PersonNoticeRow = {
  name: string;
  accountOrLoan: string;
  noticeNumber: string;
  date: string;
  sms: string;
  email: string;
  whatsapp: string;
};

type Bucket = {
  name: string;
  loanNumber: string;
  customerId: string;
  noticeNumber: string;
  at: Date;
  status: Record<ChannelKey, string>;
  seenAt: Record<ChannelKey, number>;
};

export function accountOrLoanLabel(loanNumber: string, customerId: string): string {
  const loan = loanNumber.trim();
  const account = customerId.trim();
  if (loan && account && loan !== account) return `Loan ${loan} · Account ${account}`;
  return loan || account;
}

export function personExcelFilename(identifier: string): string {
  const slug = identifier
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `person-${slug || "account"}.xlsx`;
}

export function personExcelHref(bankId: string, loan: string, account: string): string | null {
  const bank = bankId.trim();
  const loanNumber = loan.trim();
  const accountNumber = account.trim();
  if (!bank || (!loanNumber && !accountNumber)) return null;
  const params = new URLSearchParams();
  params.set("bank", bank);
  if (loanNumber) params.set("loan", loanNumber);
  else params.set("account", accountNumber);
  return `/loans/export?${params.toString()}`;
}

export function buildPersonNoticeRows(input: {
  bankId: string;
  loan?: string;
  account?: string;
  notices: PersonNoticeSource[];
  deliveries: PersonDeliverySource[];
}): PersonNoticeRow[] {
  const bankId = input.bankId.trim();
  const loan = (input.loan ?? "").trim();
  const account = (input.account ?? "").trim();
  if (!bankId || bankId === NO_BANK || (!loan && !account)) return [];

  const notices = input.notices.filter(
    (row) => row.bankId === bankId && matchesPerson(row, loan, account) && row.noticeNumber.trim(),
  );
  const ownNoticeNumbers = new Set(notices.map((row) => row.noticeNumber.trim()));
  const deliveries = input.deliveries.filter(
    (row) => sameBank(row, bankId) && deliveryIsThisPerson(row, loan, account, ownNoticeNumbers),
  );

  const buckets = new Map<string, Bucket>();
  for (const notice of notices) {
    const number = notice.noticeNumber.trim();
    buckets.set(number, emptyBucket(notice.customerName, notice.loanNumber, notice.customerId, number, notice.createdAt));
  }

  const ordered = [...deliveries].sort((left, right) => left.sentAt.getTime() - right.sentAt.getTime());
  for (const delivery of ordered) {
    const number = delivery.noticeNumber.trim();
    const channel = channelKey(delivery.channel);
    if (!number || !channel) continue;
    let bucket = buckets.get(number);
    if (!bucket) {
      bucket = emptyBucket(delivery.customerName, delivery.loanNumber, delivery.customerId, number, delivery.sentAt);
      buckets.set(number, bucket);
    }
    if (!bucket.name && delivery.customerName.trim()) bucket.name = delivery.customerName.trim();
    fillIdentifier(bucket, delivery, loan, account);
    const at = delivery.sentAt.getTime();
    if (Number.isNaN(at) || at < bucket.seenAt[channel]) continue;
    bucket.status[channel] = deliveryStatusLabel(delivery.status, false) || NOT_SENT;
    bucket.seenAt[channel] = at;
  }

  return [...buckets.values()]
    .sort((left, right) => left.at.getTime() - right.at.getTime() || left.noticeNumber.localeCompare(right.noticeNumber))
    .slice(0, EXPORT_LIMIT)
    .map((bucket) => ({
      name: bucket.name || "This loan",
      accountOrLoan: accountOrLoanLabel(bucket.loanNumber, bucket.customerId),
      noticeNumber: bucket.noticeNumber,
      date: dateLabel(bucket.at),
      sms: bucket.status.SMS,
      email: bucket.status.EMAIL,
      whatsapp: bucket.status.WHATSAPP,
    }));
}

export async function loadPersonNoticeRows(input: {
  bankId: string;
  loan?: string;
  account?: string;
}): Promise<PersonNoticeRow[]> {
  const bankId = requiredBankId(input.bankId);
  const loan = (input.loan ?? "").trim();
  const account = (input.account ?? "").trim();
  if (bankId === NO_BANK || (!loan && !account)) return [];

  const personWhere = loan ? { bankId, loanNumber: loan } : { bankId, customerId: account };
  const notices = await prisma.publicNotice.findMany({
    where: personWhere,
    orderBy: { createdAt: "asc" },
    take: EXPORT_LIMIT,
    select: {
      bankId: true,
      noticeNumber: true,
      customerName: true,
      loanNumber: true,
      customerId: true,
      createdAt: true,
    },
  });
  const noticeNumbers = [...new Set(notices.map((row) => row.noticeNumber.trim()).filter(Boolean))];
  const deliveries = await prisma.campaignDelivery.findMany({
    where: {
      bankId,
      OR: noticeNumbers.length
        ? [loan ? { loanNumber: loan } : { customerId: account }, { noticeNumber: { in: noticeNumbers } }]
        : [loan ? { loanNumber: loan } : { customerId: account }],
    },
    take: EXPORT_LIMIT,
    select: {
      bankId: true,
      customerName: true,
      loanNumber: true,
      customerId: true,
      channel: true,
      status: true,
      noticeNumber: true,
      campaign: {
        select: {
          bankId: true,
          createdAt: true,
          confirmedAt: true,
          batch: { select: { bankId: true } },
        },
      },
    },
  });

  return buildPersonNoticeRows({
    bankId,
    loan,
    account,
    notices,
    deliveries: deliveries.map((row) => ({
      bankId: row.bankId,
      campaignBankId: row.campaign.bankId,
      batchBankId: row.campaign.batch.bankId,
      customerName: row.customerName,
      loanNumber: row.loanNumber,
      customerId: row.customerId,
      channel: row.channel,
      status: row.status,
      noticeNumber: row.noticeNumber,
      sentAt: row.campaign.confirmedAt ?? row.campaign.createdAt,
    })),
  });
}

export async function personNoticeWorkbook(rows: PersonNoticeRow[]): Promise<Uint8Array<ArrayBuffer>> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Notice Desk";
  const sheet = workbook.addWorksheet("Notices");
  sheet.addRow([...PERSON_EXCEL_COLUMNS]);
  for (const row of rows) {
    sheet.addRow([
      excelText(row.name),
      excelText(row.accountOrLoan),
      excelText(row.noticeNumber),
      excelText(row.date),
      excelText(row.sms),
      excelText(row.email),
      excelText(row.whatsapp),
    ]);
  }
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: "A1", to: "G1" };
  sheet.columns.forEach((column) => {
    column.width = 28;
  });
  const raw = await workbook.xlsx.writeBuffer();
  const view = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
  const copy = new ArrayBuffer(view.byteLength);
  new Uint8Array(copy).set(view);
  return new Uint8Array(copy);
}

function emptyBucket(
  name: string,
  loanNumber: string,
  customerId: string,
  noticeNumber: string,
  at: Date,
): Bucket {
  return {
    name: name.trim(),
    loanNumber: loanNumber.trim(),
    customerId: customerId.trim(),
    noticeNumber,
    at,
    status: { SMS: NOT_SENT, EMAIL: NOT_SENT, WHATSAPP: NOT_SENT },
    seenAt: { SMS: Number.NEGATIVE_INFINITY, EMAIL: Number.NEGATIVE_INFINITY, WHATSAPP: Number.NEGATIVE_INFINITY },
  };
}

function fillIdentifier(bucket: Bucket, delivery: PersonDeliverySource, loan: string, account: string): void {
  const deliveryLoan = delivery.loanNumber.trim();
  const deliveryAccount = delivery.customerId.trim();
  if (!bucket.loanNumber && deliveryLoan && (!loan || deliveryLoan === loan)) bucket.loanNumber = deliveryLoan;
  if (!bucket.customerId && deliveryAccount && (!account || deliveryAccount === account)) {
    bucket.customerId = deliveryAccount;
  }
}

function matchesPerson(row: { loanNumber: string; customerId: string }, loan: string, account: string): boolean {
  if (loan) return row.loanNumber.trim() === loan;
  return row.customerId.trim() === account;
}

function sameBank(row: PersonDeliverySource, bankId: string): boolean {
  return row.bankId === bankId && row.campaignBankId === bankId && row.batchBankId === bankId;
}

function deliveryIsThisPerson(
  row: PersonDeliverySource,
  loan: string,
  account: string,
  ownNoticeNumbers: Set<string>,
): boolean {
  if (matchesPerson(row, loan, account)) return true;
  const number = row.noticeNumber.trim();
  if (!number || !ownNoticeNumbers.has(number)) return false;
  if (loan && row.loanNumber.trim() && row.loanNumber.trim() !== loan) return false;
  if (!loan && account && row.customerId.trim() && row.customerId.trim() !== account) return false;
  return true;
}

function channelKey(channel: string): ChannelKey | null {
  const key = channel.trim().toUpperCase();
  if (key === "SMS" || key === "EMAIL" || key === "WHATSAPP") return key;
  return null;
}

function dateLabel(date: Date): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return formatIndiaDateTime(date);
}

function excelText(value: string): string {
  if (/^[=+\-@\t\r]/.test(value)) return `'${value}`;
  return value;
}
