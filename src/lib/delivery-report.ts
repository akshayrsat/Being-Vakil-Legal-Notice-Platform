// Shared rules for the status search and the CSV download.
// A Bank Viewer is always limited to their own bank. An Admin can pick a bank.

import type { Prisma } from "@prisma/client";
import { isSendChannel } from "./campaign-plan";
import { deliveryStatusLabel, isDeliveryStatus, sendChannelLabel, statusesForFilter } from "./campaigns";

export type DeliveryFilters = {
  text: string;
  campaignId: string;
  channel: string;
  status: string;
  from: string;
  to: string;
};

export function readDeliveryFilters(params: URLSearchParams): DeliveryFilters {
  return {
    text: (params.get("q") ?? "").trim().slice(0, 80),
    campaignId: (params.get("campaign") ?? "").trim(),
    channel: (params.get("channel") ?? "").trim().toUpperCase(),
    status: (params.get("status") ?? "").trim().toUpperCase(),
    from: dateOnly(params.get("from")),
    to: dateOnly(params.get("to")),
  };
}

export function filtersToSearch(filters: DeliveryFilters, bankId: string): string {
  const params = new URLSearchParams();
  params.set("bank", bankId);
  if (filters.text) params.set("q", filters.text);
  if (filters.campaignId) params.set("campaign", filters.campaignId);
  if (filters.channel) params.set("channel", filters.channel);
  if (filters.status) params.set("status", filters.status);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  return params.toString();
}

export function deliveryWhere(bankId: string, filters: DeliveryFilters): Prisma.CampaignDeliveryWhereInput {
  const where: Prisma.CampaignDeliveryWhereInput = { bankId };
  const text = filters.text;
  if (text) {
    const or: Prisma.CampaignDeliveryWhereInput[] = [
      { customerName: { contains: text } },
      { mobile: { contains: text } },
      { loanNumber: { contains: text } },
      { customerId: { contains: text } },
    ];
    const digits = text.replace(/\D/g, "");
    if (digits.length >= 4 && digits !== text) {
      or.push({ mobile: { contains: digits } });
    }
    or.push({ noticeNumber: { contains: text.toUpperCase() } });
    where.OR = or;
  }
  if (isSendChannel(filters.channel)) where.channel = filters.channel;
  if (isDeliveryStatus(filters.status)) where.status = { in: statusesForFilter(filters.status) };

  const createdAt = createdAtRange(filters.from, filters.to);
  if (filters.campaignId || createdAt) {
    where.campaign = {
      ...(filters.campaignId ? { id: filters.campaignId } : {}),
      ...(createdAt ? { createdAt } : {}),
    };
  }
  return where;
}

export type ReportRow = {
  bankName: string;
  campaignName: string;
  when: Date;
  customerName: string;
  mobile: string;
  email: string;
  loanNumber: string;
  customerId: string;
  channel: string;
  status: string;
  detail: string;
  rowNumber: number;
  noticeNumber: string;
  noticeUrl: string;
  openedAt: Date | null;
  linkOpenedAt: Date | null;
  linkViewCount: number;
  speedPostArticle: string;
  speedPostStatus: string;
};

export function reportCsv(rows: ReportRow[]): string {
  const header = [
    "Bank",
    "Campaign",
    "Date",
    "Customer name",
    "Mobile",
    "Email",
    "Loan number",
    "Customer id",
    "Channel",
    "Status",
    "Note",
    "Sheet row",
    "Notice number",
    "Notice link",
    "Opened at",
    "Notice link opened at",
    "Notice link views",
    "Speed Post article",
    "Speed Post status",
  ];
  const lines = [header.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.bankName,
        row.campaignName,
        formatReportDate(row.when),
        row.customerName,
        row.mobile,
        row.email,
        row.loanNumber,
        row.customerId,
        sendChannelLabel(row.channel),
        deliveryStatusLabel(row.status),
        row.detail,
        String(row.rowNumber),
        row.noticeNumber,
        row.noticeUrl,
        row.openedAt ? formatReportDate(row.openedAt) : "",
        row.linkOpenedAt ? formatReportDate(row.linkOpenedAt) : "",
        row.linkViewCount > 0 ? String(row.linkViewCount) : "",
        row.speedPostArticle,
        row.speedPostStatus,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function personHistoryHref(
  row: { loanNumber: string; customerId: string; mobile: string },
  bankId: string,
): string | null {
  const params = new URLSearchParams();
  params.set("bank", bankId);
  if (row.loanNumber) params.set("loan", row.loanNumber);
  if (row.customerId) params.set("customer", row.customerId);
  if (row.mobile) params.set("mobile", row.mobile);
  if (![...params.keys()].some((key) => key !== "bank")) return null;
  return `/deliveries/person?${params.toString()}`;
}

function dateOnly(value: string | null): string {
  const text = (value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function createdAtRange(from: string, to: string): { gte?: Date; lte?: Date } | undefined {
  const range: { gte?: Date; lte?: Date } = {};
  if (from) {
    const start = new Date(`${from}T00:00:00`);
    if (!Number.isNaN(start.getTime())) range.gte = start;
  }
  if (to) {
    const end = new Date(`${to}T23:59:59.999`);
    if (!Number.isNaN(end.getTime())) range.lte = end;
  }
  return range.gte || range.lte ? range : undefined;
}

function csvCell(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function formatReportDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
