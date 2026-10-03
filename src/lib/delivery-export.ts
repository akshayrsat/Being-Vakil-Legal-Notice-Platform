// One row per person for a single bank.
// SMS, email, WhatsApp, and Speed Post are columns on that row, not extra rows.
// The summary CSV stays aggregate. This file is the delivery download.
// A row is kept only when the delivery, the send, and the upload all belong to that bank.
// The sheet does not name the messaging vendor.

import type { Prisma } from "@prisma/client";
import ExcelJS from "exceljs";
import { prisma } from "./db";
import { csvCell, indiaDayRange } from "./india-day";
import { noticePublicUrl } from "./notice-link";
import { noticeLinkOpensByNumber } from "./public-notice";
import { postalStatusLabel } from "./postal";
import type { ReportFilters } from "./desk-reports";

export const DELIVERY_EXPORT_COLUMNS = [
  "Name",
  "Mobile",
  "Email address",
  "Loan or account number",
  "Notice number",
  "Notice link",
  "SMS",
  "Email",
  "WhatsApp",
  "Speed Post",
] as const;

const STATUS_WORDS: Record<string, string> = {
  QUEUED: "queued",
  SENT: "sent",
  DELIVERED: "delivered",
  FAILED: "failed",
  SKIPPED: "skipped",
  SIMULATED_SENT: "simulated",
  READ: "read",
  PENDING: "pending",
};

const EXPORT_LIMIT = 5000;

export type DeliveryExportRow = {
  bankId: string;
  campaignBankId: string;
  batchBankId: string;
  uploadFileName: string;
  uploadedAt: Date;
  customerName: string;
  loanNumber: string;
  mobile: string;
  email: string;
  channel: string;
  campaignName: string;
  status: string;
  openedAt: Date | null;
  linkOpenedAt: Date | null;
  linkViewCount: number;
  noticeNumber: string;
  noticeUrl: string;
};

export type SpeedPostExportRow = {
  bankId: string;
  campaignBankId: string;
  batchBankId: string;
  uploadFileName: string;
  customerName: string;
  loanNumber: string;
  noticeNumber: string;
  status: string;
  updatedAt: Date;
};

type PersonSheet = {
  name: string;
  mobile: string;
  email: string;
  loan: string;
  notice: string;
  link: string;
  sms: string;
  emailStatus: string;
  whatsapp: string;
  speedPost: string;
  smsAt: number;
  emailAt: number;
  whatsappAt: number;
  speedPostAt: number;
};

export function deliveryStatusWord(status: string, technical = true): string {
  if (!status.trim()) return "";
  if (!technical && status === "SIMULATED_SENT") return "not sent";
  if (technical && status === "SIMULATED_SENT") return "dry run";
  return STATUS_WORDS[status] ?? status.trim().toLowerCase();
}

export function formatIstTimestamp(date: Date): string {
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const hour = pick("hour") === "24" ? "00" : pick("hour");
  return `${pick("day")}-${pick("month")}-${pick("year")} ${hour}:${pick("minute")} IST`;
}

export function rowBelongsToBank(row: DeliveryExportRow, bankId: string): boolean {
  const id = bankId.trim();
  return Boolean(id) && row.bankId === id && row.campaignBankId === id && row.batchBankId === id;
}

export function speedPostBelongsToBank(row: SpeedPostExportRow, bankId: string): boolean {
  const id = bankId.trim();
  return Boolean(id) && row.bankId === id && row.campaignBankId === id && row.batchBankId === id;
}

export function deliveryExportWhere(
  bankId: string,
  filters: Pick<ReportFilters, "channel" | "from" | "to"> & { file?: string },
  options?: { sentOnly?: boolean },
): Prisma.CampaignDeliveryWhereInput | null {
  const campaign = campaignWhere(bankId, filters, options);
  if (!campaign) return null;
  return { bankId: bankId.trim(), campaign };
}

export function speedPostExportWhere(
  bankId: string,
  filters: Pick<ReportFilters, "from" | "to"> & { file?: string },
  options?: { sentOnly?: boolean },
): Prisma.SpeedPostConsignmentWhereInput | null {
  const campaign = campaignWhere(bankId, filters, options);
  if (!campaign || typeof campaign.bankId !== "string") return null;
  return { bankId: campaign.bankId, campaign };
}

export function deliveryExportCsv(
  bank: { id: string },
  rows: DeliveryExportRow[],
  technical = true,
  speedPost: SpeedPostExportRow[] = [],
  channel = "",
): string {
  const table = deliveryPeople(bank, rows, technical, speedPost, channel);
  const lines = table.map((cells) => cells.map((cell) => csvCell(cell)).join(","));
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export async function deliveryExportXlsx(
  bank: { id: string },
  rows: DeliveryExportRow[],
  technical = true,
  speedPost: SpeedPostExportRow[] = [],
  channel = "",
): Promise<Buffer> {
  const table = deliveryPeople(bank, rows, technical, speedPost, channel);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Deliveries");
  for (const cells of table) sheet.addRow(cells.map(sheetCell));
  sheet.getRow(1).font = { bold: true };
  sheet.columns = DELIVERY_EXPORT_COLUMNS.map((header) => ({
    width: Math.min(42, Math.max(14, header.length + 2)),
  }));
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function deliveryPeople(
  bank: { id: string },
  rows: DeliveryExportRow[],
  technical = true,
  speedPost: SpeedPostExportRow[] = [],
  channel = "",
): string[][] {
  const id = bank.id.trim();
  const people = new Map<string, PersonSheet>();
  if (id) {
    for (const row of rows) {
      if (!rowBelongsToBank(row, id)) continue;
      const person = personFor(people, row.uploadFileName, row.customerName, row.loanNumber, row.noticeNumber, row.noticeUrl);
      fillContact(person, row.mobile, row.email);
      const at = row.uploadedAt.getTime();
      const word = deliveryStatusWord(row.status, technical);
      if (row.channel === "SMS") setStatus(person, "sms", "smsAt", word, at);
      if (row.channel === "EMAIL") setStatus(person, "emailStatus", "emailAt", word, at);
      if (row.channel === "WHATSAPP") setStatus(person, "whatsapp", "whatsappAt", word, at);
    }
    for (const row of speedPost) {
      if (!speedPostBelongsToBank(row, id)) continue;
      const person = personFor(people, row.uploadFileName, row.customerName, row.loanNumber, row.noticeNumber, "");
      setStatus(person, "speedPost", "speedPostAt", postalStatusLabel(row.status), row.updatedAt.getTime());
    }
  }
  const wanted = channel.trim().toUpperCase();
  const kept = [...people.values()].filter((person) => channelMatches(person, wanted));
  kept.sort((left, right) => left.name.localeCompare(right.name) || left.loan.localeCompare(right.loan) || left.notice.localeCompare(right.notice));
  return [Array.from(DELIVERY_EXPORT_COLUMNS), ...kept.map(cellsForPerson)];
}

export async function loadDeliveryExportRows(
  bankId: string,
  filters: Pick<ReportFilters, "channel" | "from" | "to"> & { file?: string },
  options?: { sentOnly?: boolean },
): Promise<DeliveryExportRow[]> {
  const id = bankId.trim();
  const where = deliveryExportWhere(id, filters, options);
  if (!where) return [];

  const rows = await prisma.campaignDelivery.findMany({
    where,
    select: {
      bankId: true,
      rowNumber: true,
      customerName: true,
      mobile: true,
      email: true,
      loanNumber: true,
      channel: true,
      status: true,
      openedAt: true,
      noticeNumber: true,
      campaign: {
        select: {
          bankId: true,
          templateName: true,
          batch: { select: { bankId: true, fileName: true, createdAt: true } },
        },
      },
    },
    orderBy: [{ campaign: { batch: { createdAt: "desc" } } }, { rowNumber: "asc" }, { channel: "asc" }],
    take: EXPORT_LIMIT,
  });

  const kept = rows.filter(
    (row) => row.bankId === id && row.campaign.bankId === id && row.campaign.batch.bankId === id,
  );
  const linkOpens = await noticeLinkOpensByNumber(
    kept.map((row) => row.noticeNumber),
    id,
  );

  return kept.map((row) => {
    const link = row.noticeNumber ? linkOpens.get(row.noticeNumber) : undefined;
    return {
      bankId: row.bankId,
      campaignBankId: row.campaign.bankId,
      batchBankId: row.campaign.batch.bankId,
      uploadFileName: row.campaign.batch.fileName,
      uploadedAt: row.campaign.batch.createdAt,
      customerName: row.customerName,
      loanNumber: row.loanNumber,
      mobile: row.mobile,
      email: row.email,
      channel: row.channel,
      campaignName: row.campaign.templateName,
      status: row.status,
      openedAt: row.openedAt,
      linkOpenedAt: link?.linkOpenedAt ?? null,
      linkViewCount: link?.linkViewCount ?? 0,
      noticeNumber: row.noticeNumber,
      noticeUrl: row.noticeNumber ? noticePublicUrl(row.noticeNumber) : "",
    };
  });
}

export async function loadSpeedPostExportRows(
  bankId: string,
  filters: Pick<ReportFilters, "from" | "to"> & { file?: string },
  options?: { sentOnly?: boolean },
): Promise<SpeedPostExportRow[]> {
  const id = bankId.trim();
  const where = speedPostExportWhere(id, filters, options);
  if (!where) return [];
  const rows = await prisma.speedPostConsignment.findMany({
    where,
    select: {
      bankId: true,
      customerName: true,
      loanNumber: true,
      noticeNumber: true,
      status: true,
      updatedAt: true,
      campaign: {
        select: {
          bankId: true,
          batch: { select: { bankId: true, fileName: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: EXPORT_LIMIT,
  });
  return rows.flatMap((row) => {
    if (!row.campaign || row.bankId !== id || row.campaign.bankId !== id || row.campaign.batch.bankId !== id) return [];
    return [
      {
        bankId: row.bankId,
        campaignBankId: row.campaign.bankId,
        batchBankId: row.campaign.batch.bankId,
        uploadFileName: row.campaign.batch.fileName,
        customerName: row.customerName,
        loanNumber: row.loanNumber,
        noticeNumber: row.noticeNumber,
        status: row.status,
        updatedAt: row.updatedAt,
      },
    ];
  });
}

function campaignWhere(
  bankId: string,
  filters: { from: string; to: string; file?: string },
  options?: { sentOnly?: boolean },
): Prisma.CampaignWhereInput | null {
  const id = bankId.trim();
  if (!id) return null;
  const createdAt = indiaDayRange(filters.from, filters.to);
  return {
    bankId: id,
    batch: { bankId: id, ...(filters.file ? { id: filters.file } : {}) },
    ...(createdAt ? { createdAt } : {}),
    ...(options?.sentOnly ? { status: { not: "REVIEW" } } : {}),
  };
}

function personFor(
  people: Map<string, PersonSheet>,
  uploadFileName: string,
  customerName: string,
  loanNumber: string,
  noticeNumber: string,
  noticeUrl: string,
): PersonSheet {
  const notice = noticeNumber.trim();
  const key = notice
    ? `n:${notice.toLowerCase()}`
    : `p:${uploadFileName.trim().toLowerCase()}|${loanNumber.trim().toLowerCase()}|${customerName.trim().toLowerCase()}`;
  const existing = people.get(key);
  if (existing) {
    fillContact(existing, "", "");
    if (!existing.loan && loanNumber.trim()) existing.loan = loanNumber.trim();
    if (!existing.notice && notice) existing.notice = notice;
    if (!existing.link && noticeUrl.trim()) existing.link = noticeUrl.trim();
    if (!existing.link && notice) existing.link = noticePublicUrl(notice);
    return existing;
  }
  const created: PersonSheet = {
    name: customerName.trim(),
    mobile: "",
    email: "",
    loan: loanNumber.trim(),
    notice,
    link: noticeUrl.trim() || (notice ? noticePublicUrl(notice) : ""),
    sms: "",
    emailStatus: "",
    whatsapp: "",
    speedPost: "",
    smsAt: Number.NEGATIVE_INFINITY,
    emailAt: Number.NEGATIVE_INFINITY,
    whatsappAt: Number.NEGATIVE_INFINITY,
    speedPostAt: Number.NEGATIVE_INFINITY,
  };
  people.set(key, created);
  return created;
}

function fillContact(person: PersonSheet, mobile: string, email: string): void {
  if (!person.mobile && mobile.trim()) person.mobile = mobile.trim();
  if (!person.email && email.trim()) person.email = email.trim();
}

function setStatus(
  person: PersonSheet,
  field: "sms" | "emailStatus" | "whatsapp" | "speedPost",
  atField: "smsAt" | "emailAt" | "whatsappAt" | "speedPostAt",
  word: string,
  at: number,
): void {
  if (!word) return;
  if (person[field] && at < person[atField]) return;
  person[field] = word;
  person[atField] = at;
}

function channelMatches(person: PersonSheet, channel: string): boolean {
  if (channel === "SMS") return Boolean(person.sms);
  if (channel === "EMAIL") return Boolean(person.emailStatus);
  if (channel === "WHATSAPP") return Boolean(person.whatsapp);
  if (channel === "SPEED_POST") return Boolean(person.speedPost);
  return true;
}

function cellsForPerson(person: PersonSheet): string[] {
  return [
    person.name,
    person.mobile,
    person.email,
    person.loan,
    person.notice,
    person.link,
    person.sms,
    person.emailStatus,
    person.whatsapp,
    person.speedPost,
  ];
}

function sheetCell(value: string): string {
  if (/^[=+\-@\t\r]/.test(value)) return `'${value}`;
  return value;
}
