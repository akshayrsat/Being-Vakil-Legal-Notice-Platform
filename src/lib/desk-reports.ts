// Counts for the reports page. Dry runs are kept out of failure rates.

import type { Prisma } from "@prisma/client";
import { requiredBankId } from "./bank-data";
import { SEND_CHANNELS, isSendChannel } from "./campaign-plan";
import { deliveryStatusLabel, sendChannelLabel } from "./campaigns";
import { prisma } from "./db";
import { csvCell, formatIndiaDateTime, indiaDayRange } from "./india-day";
import { POSTAL_STATUSES, postalStatusLabel } from "./postal";

export type ReportFilters = {
  file: string;
  channel: string;
  from: string;
  to: string;
};

export type ChannelReport = {
  channel: string;
  label: string;
  attempted: number;
  failed: number;
  failureRate: string;
  delivered: number;
  /** Null when this channel cannot report that a phone opened the message. */
  opened: number | null;
  unopened: number | null;
  skipped: number;
  dryRun: number;
};

export type SpeedPostReport = {
  status: string;
  label: string;
  count: number;
};

export type DeskReport = {
  channels: ChannelReport[];
  linkOpened: number;
  linkNotOpened: number;
  speedPost: SpeedPostReport[];
  speedPostTotal: number;
};

const ATTEMPTED = ["QUEUED", "SENT", "DELIVERED", "READ", "FAILED"] as const;
// SENT is only a handoff to the operator. A delivery receipt is DELIVERED or READ.
const DELIVERED = ["DELIVERED", "READ"] as const;
const HANDED = ["SENT", "DELIVERED", "READ"] as const;

export function reportFileId(value: string | null): string {
  const text = (value ?? "").trim();
  return /^[a-z0-9]{10,32}$/i.test(text) ? text : "";
}

export function channelShowsOpens(channel: string): boolean {
  return channel !== "SMS";
}

export function readReportFilters(params: URLSearchParams): ReportFilters {
  const channel = (params.get("channel") ?? "").trim().toUpperCase();
  return {
    file: reportFileId(params.get("file")),
    channel: isSendChannel(channel) || channel === "SPEED_POST" ? channel : "",
    from: dateOnly(params.get("from")),
    to: dateOnly(params.get("to")),
  };
}

export function reportFiltersToSearch(filters: ReportFilters, bankId: string): string {
  const params = new URLSearchParams();
  params.set("bank", bankId);
  if (filters.file) params.set("file", filters.file);
  if (filters.channel) params.set("channel", filters.channel);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  return params.toString();
}

// The bank id is always present. A download needs a file, a channel, and/or a from/to date from Apply.
export function reportFiltersApplied(filters: ReportFilters): boolean {
  return Boolean(filters.file || filters.channel || filters.from || filters.to);
}

export function reportFileLabel(fileName: string, createdAt: Date, duplicate: boolean): string {
  const name = fileName.trim() || "Spreadsheet";
  if (!duplicate) return name;
  return `${name} · ${formatIndiaDateTime(createdAt)}`;
}

export function reportCampaignWhere(
  bankId: string,
  filters: Pick<ReportFilters, "file" | "from" | "to">,
  sentOnly = false,
): Prisma.CampaignWhereInput {
  const scope = requiredBankId(bankId);
  const createdAt = createdRange(filters.from, filters.to);
  return {
    bankId: scope,
    batch: {
      bankId: scope,
      ...(filters.file ? { id: filters.file } : {}),
    },
    ...(createdAt ? { createdAt } : {}),
    ...(sentOnly ? { status: { not: "REVIEW" } } : {}),
  };
}

export async function loadDeskReport(
  bankId: string,
  filters: ReportFilters,
  options?: { sentOnly?: boolean },
): Promise<DeskReport> {
  const range = createdRange(filters.from, filters.to);
  const digital = filters.channel !== "SPEED_POST";
  const postal = !filters.channel || filters.channel === "SPEED_POST";
  const channels = digital ? await channelReports(bankId, filters, options?.sentOnly) : [];
  const links = digital ? await linkReports(bankId, filters, range, options?.sentOnly) : { opened: 0, closed: 0 };
  const speedPost = postal ? await speedPostReports(bankId, filters, range, options?.sentOnly) : [];
  return {
    channels,
    linkOpened: links.opened,
    linkNotOpened: links.closed,
    speedPost,
    speedPostTotal: speedPost.reduce((sum, row) => sum + row.count, 0),
  };
}

export function channelSummaryMetrics(row: ChannelReport): Array<{ metric: string; count: string }> {
  const metrics = [
    { metric: "Attempted", count: String(row.attempted) },
    { metric: "Failed or bounced", count: String(row.failed) },
    { metric: "Failure rate", count: row.failureRate },
    { metric: "Delivered", count: String(row.delivered) },
  ];
  if (channelShowsOpens(row.channel)) {
    metrics.push(
      { metric: "Opened", count: String(row.opened ?? 0) },
      { metric: "Not opened", count: String(row.unopened ?? 0) },
    );
  }
  return metrics;
}

export function reportSummaryCsv(bankName: string, report: DeskReport): string {
  const lines = [["Bank", "Section", "Channel", "Metric", "Count"].join(",")];
  for (const row of report.channels) {
    for (const metric of channelSummaryMetrics(row)) {
      lines.push(csvLine([bankName, "Digital", row.label, metric.metric, metric.count]));
    }
  }
  lines.push(csvLine([bankName, "Notice link", "", "Opened", String(report.linkOpened)]));
  lines.push(csvLine([bankName, "Notice link", "", "Not opened", String(report.linkNotOpened)]));
  for (const row of report.speedPost) {
    lines.push(csvLine([bankName, "Speed Post", row.label, "Consignments", String(row.count)]));
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

async function channelReports(
  bankId: string,
  filters: ReportFilters,
  sentOnly = false,
): Promise<ChannelReport[]> {
  const scope = requiredBankId(bankId);
  const channels = filters.channel && isSendChannel(filters.channel) ? [filters.channel] : [...SEND_CHANNELS];
  const reports: ChannelReport[] = [];
  for (const channel of channels) {
    const where: Prisma.CampaignDeliveryWhereInput = {
      bankId: scope,
      channel,
      campaign: reportCampaignWhere(scope, filters, sentOnly),
    };
    const [attempted, failed, delivered, skipped, dryRun] = await Promise.all([
      prisma.campaignDelivery.count({ where: { ...where, status: { in: [...ATTEMPTED] } } }),
      prisma.campaignDelivery.count({ where: { ...where, status: "FAILED" } }),
      prisma.campaignDelivery.count({ where: { ...where, status: { in: [...DELIVERED] } } }),
      prisma.campaignDelivery.count({ where: { ...where, status: "SKIPPED" } }),
      prisma.campaignDelivery.count({ where: { ...where, status: "SIMULATED_SENT" } }),
    ]);
    const opens = channelShowsOpens(channel)
      ? await openCounts(where)
      : { opened: null, unopened: null };
    reports.push({
      channel,
      label: sendChannelLabel(channel),
      attempted,
      failed,
      failureRate: attempted === 0 ? "—" : `${Math.round((failed / attempted) * 100)}%`,
      delivered,
      opened: opens.opened,
      unopened: opens.unopened,
      skipped,
      dryRun,
    });
  }
  return reports;
}

async function openCounts(where: Prisma.CampaignDeliveryWhereInput): Promise<{ opened: number; unopened: number }> {
  const [handedOver, opened] = await Promise.all([
    prisma.campaignDelivery.count({ where: { ...where, status: { in: [...HANDED] } } }),
    prisma.campaignDelivery.count({
      where: {
        AND: [where, { OR: [{ openedAt: { not: null } }, { status: "READ" }] }],
      },
    }),
  ]);
  return { opened, unopened: Math.max(0, handedOver - opened) };
}

async function linkReports(
  bankId: string,
  filters: ReportFilters,
  range: { gte?: Date; lte?: Date } | undefined,
  sentOnly = false,
) {
  const scope = requiredBankId(bankId);
  const where = {
    bankId: scope,
    ...(range ? { createdAt: range } : {}),
    ...(filters.file || sentOnly
      ? {
          campaign: filters.file
            ? {
                bankId: scope,
                batch: { id: filters.file, bankId: scope },
                ...(sentOnly ? { status: { not: "REVIEW" as const } } : {}),
              }
            : { status: { not: "REVIEW" as const } },
        }
      : {}),
  };
  const [opened, closed] = await Promise.all([
    prisma.publicNotice.count({ where: { ...where, linkViewCount: { gt: 0 } } }),
    prisma.publicNotice.count({ where: { ...where, linkViewCount: 0 } }),
  ]);
  return { opened, closed };
}

async function speedPostReports(
  bankId: string,
  filters: ReportFilters,
  range: { gte?: Date; lte?: Date } | undefined,
  sentOnly = false,
): Promise<SpeedPostReport[]> {
  const scope = requiredBankId(bankId);
  const rows = await Promise.all(
    POSTAL_STATUSES.map(async (status) => ({
      status,
      label: postalStatusLabel(status),
      count: await prisma.speedPostConsignment.count({
        where: {
          bankId: scope,
          status,
          ...(range ? { updatedAt: range } : {}),
          ...(filters.file || sentOnly
            ? {
                campaign: filters.file
                  ? {
                      bankId: scope,
                      batch: { id: filters.file, bankId: scope },
                      ...(sentOnly ? { status: { not: "REVIEW" as const } } : {}),
                    }
                  : { status: { not: "REVIEW" as const } },
              }
            : {}),
        },
      }),
    })),
  );
  return rows;
}

export type ReportFileOption = {
  id: string;
  fileName: string;
  createdAt: Date;
};

export type ReportNoticeRow = {
  person: string;
  notice: string;
  channel: string;
  status: string;
};

const sentFileWhere = (bankId: string) => {
  const scope = requiredBankId(bankId);
  return {
    bankId: scope,
    saved: true,
    campaigns: { some: { bankId: scope, status: { not: "REVIEW" as const } } },
  };
};

export async function listReportFiles(bankId: string): Promise<ReportFileOption[]> {
  return prisma.uploadBatch.findMany({
    where: sentFileWhere(bankId),
    select: { id: true, fileName: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function reportFileBelongsToBank(bankId: string, fileId: string): Promise<boolean> {
  const id = reportFileId(fileId);
  if (!id) return false;
  const found = await prisma.uploadBatch.findFirst({
    where: { id, ...sentFileWhere(bankId) },
    select: { id: true },
  });
  return Boolean(found);
}

export async function loadReportNotices(
  bankId: string,
  filters: ReportFilters,
  options?: { sentOnly?: boolean; technical?: boolean },
): Promise<ReportNoticeRow[]> {
  if (!filters.file) return [];
  const scope = requiredBankId(bankId);
  const technical = options?.technical ?? false;
  const campaign = reportCampaignWhere(scope, filters, options?.sentOnly ?? false);
  const digital = filters.channel !== "SPEED_POST";
  const postal = !filters.channel || filters.channel === "SPEED_POST";
  const deliveries = digital
    ? await prisma.campaignDelivery.findMany({
        where: {
          bankId: scope,
          campaign,
          ...(isSendChannel(filters.channel) ? { channel: filters.channel } : {}),
        },
        select: { customerName: true, noticeNumber: true, channel: true, status: true, rowNumber: true },
        orderBy: [{ rowNumber: "asc" }, { channel: "asc" }],
        take: 1000,
      })
    : [];
  const postalRows = postal
    ? await prisma.speedPostConsignment.findMany({
        where: { bankId: scope, campaign },
        select: { customerName: true, noticeNumber: true, status: true },
        orderBy: [{ customerName: "asc" }, { noticeNumber: "asc" }],
        take: 1000,
      })
    : [];
  return [
    ...deliveries.map((row) => ({
      person: row.customerName,
      notice: row.noticeNumber,
      channel: sendChannelLabel(row.channel),
      status: deliveryStatusLabel(row.status, technical),
    })),
    ...postalRows.map((row) => ({
      person: row.customerName,
      notice: row.noticeNumber,
      channel: "Speed Post",
      status: postalStatusLabel(row.status),
    })),
  ];
}

function dateOnly(value: string | null): string {
  const text = (value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function createdRange(from: string, to: string): { gte?: Date; lte?: Date } | undefined {
  return indiaDayRange(from, to);
}

function csvLine(cells: string[]): string {
  return cells.map(csvCell).join(",");
}
