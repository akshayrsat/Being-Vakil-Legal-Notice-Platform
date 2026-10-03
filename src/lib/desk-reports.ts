// Counts for the reports page. Dry runs are kept out of failure rates.

import type { Prisma } from "@prisma/client";
import { requiredBankId } from "./bank-data";
import { SEND_CHANNELS, isSendChannel } from "./campaign-plan";
import { sendChannelLabel } from "./campaigns";
import { prisma } from "./db";
import { csvCell, indiaDayRange } from "./india-day";
import { POSTAL_STATUSES, postalStatusLabel } from "./postal";

export type ReportFilters = {
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
  handedOver: number;
  opened: number;
  unopened: number;
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
const HANDED = ["SENT", "DELIVERED", "READ"] as const;

export function readReportFilters(params: URLSearchParams): ReportFilters {
  const channel = (params.get("channel") ?? "").trim().toUpperCase();
  return {
    channel: isSendChannel(channel) || channel === "SPEED_POST" ? channel : "",
    from: dateOnly(params.get("from")),
    to: dateOnly(params.get("to")),
  };
}

export function reportFiltersToSearch(filters: ReportFilters, bankId: string): string {
  const params = new URLSearchParams();
  params.set("bank", bankId);
  if (filters.channel) params.set("channel", filters.channel);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  return params.toString();
}

// The bank id is always present. A download needs a channel and/or a from/to date from Apply.
export function reportFiltersApplied(filters: ReportFilters): boolean {
  return Boolean(filters.channel || filters.from || filters.to);
}

export async function loadDeskReport(
  bankId: string,
  filters: ReportFilters,
  options?: { sentOnly?: boolean },
): Promise<DeskReport> {
  const range = createdRange(filters.from, filters.to);
  const digital = filters.channel !== "SPEED_POST";
  const postal = !filters.channel || filters.channel === "SPEED_POST";
  const channels = digital ? await channelReports(bankId, filters, range, options?.sentOnly) : [];
  const links = digital ? await linkReports(bankId, range, options?.sentOnly) : { opened: 0, closed: 0 };
  const speedPost = postal ? await speedPostReports(bankId, range, options?.sentOnly) : [];
  return {
    channels,
    linkOpened: links.opened,
    linkNotOpened: links.closed,
    speedPost,
    speedPostTotal: speedPost.reduce((sum, row) => sum + row.count, 0),
  };
}

export function reportSummaryCsv(bankName: string, report: DeskReport): string {
  const lines = [["Bank", "Section", "Channel", "Metric", "Count"].join(",")];
  for (const row of report.channels) {
    lines.push(csvLine([bankName, "Digital", row.label, "Attempted", String(row.attempted)]));
    lines.push(csvLine([bankName, "Digital", row.label, "Failed or bounced", String(row.failed)]));
    lines.push(csvLine([bankName, "Digital", row.label, "Failure rate", row.failureRate]));
    lines.push(csvLine([bankName, "Digital", row.label, "Handed over", String(row.handedOver)]));
    lines.push(csvLine([bankName, "Digital", row.label, "Opened", String(row.opened)]));
    lines.push(csvLine([bankName, "Digital", row.label, "Not opened", String(row.unopened)]));
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
  range: { gte?: Date; lte?: Date } | undefined,
  sentOnly = false,
): Promise<ChannelReport[]> {
  const scope = requiredBankId(bankId);
  const channels = filters.channel && isSendChannel(filters.channel) ? [filters.channel] : [...SEND_CHANNELS];
  const reports: ChannelReport[] = [];
  for (const channel of channels) {
    const where: Prisma.CampaignDeliveryWhereInput = {
      bankId: scope,
      channel,
      campaign: {
        bankId: scope,
        ...(range ? { createdAt: range } : {}),
        ...(sentOnly ? { status: { not: "REVIEW" } } : {}),
      },
    };
    const [attempted, failed, handedOver, opened, skipped, dryRun] = await Promise.all([
      prisma.campaignDelivery.count({ where: { ...where, status: { in: [...ATTEMPTED] } } }),
      prisma.campaignDelivery.count({ where: { ...where, status: "FAILED" } }),
      prisma.campaignDelivery.count({ where: { ...where, status: { in: [...HANDED] } } }),
      prisma.campaignDelivery.count({
        where: {
          AND: [where, { OR: [{ openedAt: { not: null } }, { status: "READ" }] }],
        },
      }),
      prisma.campaignDelivery.count({ where: { ...where, status: "SKIPPED" } }),
      prisma.campaignDelivery.count({ where: { ...where, status: "SIMULATED_SENT" } }),
    ]);
    const unopened = Math.max(0, handedOver - opened);
    reports.push({
      channel,
      label: sendChannelLabel(channel),
      attempted,
      failed,
      failureRate: attempted === 0 ? "—" : `${Math.round((failed / attempted) * 100)}%`,
      handedOver,
      opened: channel === "SMS" ? 0 : opened,
      unopened: channel === "SMS" ? 0 : unopened,
      skipped,
      dryRun,
    });
  }
  return reports;
}

async function linkReports(
  bankId: string,
  range: { gte?: Date; lte?: Date } | undefined,
  sentOnly = false,
) {
  const where = {
    bankId: requiredBankId(bankId),
    ...(range ? { createdAt: range } : {}),
    ...(sentOnly ? { campaign: { status: { not: "REVIEW" as const } } } : {}),
  };
  const [opened, closed] = await Promise.all([
    prisma.publicNotice.count({ where: { ...where, linkViewCount: { gt: 0 } } }),
    prisma.publicNotice.count({ where: { ...where, linkViewCount: 0 } }),
  ]);
  return { opened, closed };
}

async function speedPostReports(
  bankId: string,
  range: { gte?: Date; lte?: Date } | undefined,
  sentOnly = false,
): Promise<SpeedPostReport[]> {
  const rows = await Promise.all(
    POSTAL_STATUSES.map(async (status) => ({
      status,
      label: postalStatusLabel(status),
      count: await prisma.speedPostConsignment.count({
        where: {
          bankId: requiredBankId(bankId),
          status,
          ...(range ? { updatedAt: range } : {}),
          ...(sentOnly ? { campaign: { status: { not: "REVIEW" as const } } } : {}),
        },
      }),
    })),
  );
  return rows;
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
