// One row per person and channel for a single bank.
// The summary CSV stays aggregate. This file is the delivery download.
// A row is kept only when the delivery, the send, and the upload all belong to that bank.

import type { Prisma } from "@prisma/client";
import { isSendChannel } from "./campaign-plan";
import { sendChannelLabel } from "./campaigns";
import { prisma } from "./db";
import { csvCell, indiaDayRange } from "./india-day";
import { noticePublicUrl } from "./notice-link";
import { noticeLinkOpensByNumber } from "./public-notice";
import type { ReportFilters } from "./desk-reports";

export const DELIVERY_EXPORT_COLUMNS = [
  "Bank",
  "Upload file",
  "Uploaded at (IST)",
  "Customer name",
  "Loan number",
  "Mobile",
  "Email",
  "Channel",
  "Campaign",
  "Delivery status",
  "Opened at (IST)",
  "MSG91 open or read",
  "Notice link opened at (IST)",
  "Notice link views",
  "Notice number",
  "Notice URL",
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

const CHANNEL_ORDER = ["SMS", "EMAIL", "WHATSAPP"];
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

export function deliveryStatusWord(status: string): string {
  return STATUS_WORDS[status] ?? status.trim().toLowerCase();
}

export function msg91OpenReadLabel(status: string, openedAt: Date | null): string {
  if (status === "READ") return "read";
  if (openedAt) return "open";
  return "";
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

export function deliveryExportWhere(
  bankId: string,
  filters: Pick<ReportFilters, "channel" | "from" | "to">,
): Prisma.CampaignDeliveryWhereInput | null {
  const id = bankId.trim();
  if (!id) return null;
  if (filters.channel === "SPEED_POST") return null;
  const createdAt = indiaDayRange(filters.from, filters.to);
  const where: Prisma.CampaignDeliveryWhereInput = {
    bankId: id,
    campaign: {
      bankId: id,
      batch: { bankId: id },
      ...(createdAt ? { createdAt } : {}),
    },
  };
  if (isSendChannel(filters.channel)) where.channel = filters.channel;
  return where;
}

export function deliveryExportCsv(bank: { id: string; name: string }, rows: DeliveryExportRow[]): string {
  const kept = rows.filter((row) => rowBelongsToBank(row, bank.id)).sort(compareRows);
  const lines = [DELIVERY_EXPORT_COLUMNS.map((column) => csvCell(column)).join(",")];
  for (const row of kept) {
    lines.push(cellsFor(bank.name, row).map((cell) => csvCell(cell)).join(","));
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export async function loadDeliveryExportRows(
  bankId: string,
  filters: Pick<ReportFilters, "channel" | "from" | "to">,
): Promise<DeliveryExportRow[]> {
  const id = bankId.trim();
  const where = deliveryExportWhere(id, filters);
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

function cellsFor(bankName: string, row: DeliveryExportRow): string[] {
  const contact = contactForChannel(row);
  return [
    bankName,
    row.uploadFileName,
    formatIstTimestamp(row.uploadedAt),
    row.customerName,
    row.loanNumber,
    contact.mobile,
    contact.email,
    sendChannelLabel(row.channel),
    row.campaignName,
    deliveryStatusWord(row.status),
    row.openedAt ? formatIstTimestamp(row.openedAt) : "",
    msg91OpenReadLabel(row.status, row.openedAt),
    row.linkOpenedAt ? formatIstTimestamp(row.linkOpenedAt) : "",
    row.linkViewCount > 0 ? String(row.linkViewCount) : "",
    row.noticeNumber,
    row.noticeUrl,
  ];
}

function contactForChannel(row: DeliveryExportRow): { mobile: string; email: string } {
  if (row.channel === "EMAIL") return { mobile: "", email: row.email };
  if (row.channel === "SMS" || row.channel === "WHATSAPP") return { mobile: row.mobile, email: "" };
  return { mobile: row.mobile, email: row.email };
}

function compareRows(left: DeliveryExportRow, right: DeliveryExportRow): number {
  const uploaded = right.uploadedAt.getTime() - left.uploadedAt.getTime();
  if (uploaded !== 0) return uploaded;
  const name = left.customerName.localeCompare(right.customerName);
  if (name !== 0) return name;
  const loan = left.loanNumber.localeCompare(right.loanNumber);
  if (loan !== 0) return loan;
  const channel = channelRank(left.channel) - channelRank(right.channel);
  if (channel !== 0) return channel;
  return left.campaignName.localeCompare(right.campaignName);
}

function channelRank(channel: string): number {
  const index = CHANNEL_ORDER.indexOf(channel);
  return index === -1 ? CHANNEL_ORDER.length : index;
}
