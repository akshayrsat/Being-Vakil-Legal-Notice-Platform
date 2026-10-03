// One chronological history for a loan or account number inside a single bank.

import { NO_BANK, requiredBankId } from "./bank-data";
import { deliveryStatusLabel, sendChannelLabel } from "./campaigns";
import { hideVendorWording } from "./staff-language";
import { prisma } from "./db";
import { noticePageHref } from "./notice-link";
import { postalStatusLabel } from "./postal";

export type TimelineEvent = {
  id: string;
  at: Date;
  kind: "notice" | "channel" | "link" | "speed-post";
  title: string;
  detail: string;
  href: string;
  hrefLabel: string;
};

export type AccountTimeline = {
  customerName: string;
  loanNumber: string;
  customerId: string;
  events: TimelineEvent[];
};

export type LoanMatch = {
  key: string;
  loanNumber: string;
  customerId: string;
  customerName: string;
  href: string;
};

export function loanSearchHref(bankId: string, loanNumber: string, customerId: string): string | null {
  const params = new URLSearchParams();
  params.set("bank", bankId);
  if (loanNumber.trim()) params.set("loan", loanNumber.trim());
  else if (customerId.trim()) params.set("account", customerId.trim());
  else return null;
  return `/loans?${params.toString()}`;
}

export async function searchLoanMatches(bankId: string, text: string): Promise<LoanMatch[]> {
  const scope = requiredBankId(bankId);
  const query = text.trim().slice(0, 80);
  if (scope === NO_BANK || query.length < 2) return [];
  const [notices, deliveries, consignments] = await Promise.all([
    prisma.publicNotice.findMany({
      where: {
        bankId: scope,
        OR: [{ loanNumber: { contains: query } }, { customerId: { contains: query } }],
      },
      select: { loanNumber: true, customerId: true, customerName: true },
      take: 80,
    }),
    prisma.campaignDelivery.findMany({
      where: {
        bankId: scope,
        OR: [{ loanNumber: { contains: query } }, { customerId: { contains: query } }],
      },
      select: { loanNumber: true, customerId: true, customerName: true },
      take: 80,
    }),
    prisma.speedPostConsignment.findMany({
      where: {
        bankId: scope,
        OR: [{ loanNumber: { contains: query } }, { customerId: { contains: query } }, { articleNumber: { contains: query.toUpperCase() } }],
      },
      select: { loanNumber: true, customerId: true, customerName: true },
      take: 80,
    }),
  ]);

  const matches = new Map<string, LoanMatch>();
  for (const row of [...notices, ...deliveries, ...consignments]) {
    const loanNumber = row.loanNumber.trim();
    const customerId = row.customerId.trim();
    const key = loanNumber || customerId;
    if (!key || matches.has(key)) continue;
    const href = loanSearchHref(scope, loanNumber, loanNumber ? "" : customerId);
    if (!href) continue;
    matches.set(key, {
      key,
      loanNumber,
      customerId,
      customerName: row.customerName.trim(),
      href,
    });
    if (matches.size >= 25) break;
  }
  return [...matches.values()];
}

export function alreadySent(status: string | null | undefined): boolean {
  return Boolean(status) && status !== "REVIEW";
}

export async function loadAccountTimeline(input: {
  bankId: string;
  loan?: string;
  account?: string;
  mobile?: string;
  technical?: boolean;
  sentOnly?: boolean;
}): Promise<AccountTimeline | null> {
  const scope = requiredBankId(input.bankId);
  const loan = (input.loan ?? "").trim();
  const account = (input.account ?? "").trim();
  const mobile = (input.mobile ?? "").trim();
  if (scope === NO_BANK || (!loan && !account && !mobile)) return null;

  if (loan || account) {
    const where = loan ? { bankId: scope, loanNumber: loan } : { bankId: scope, customerId: account };
    const sent = input.sentOnly ? { campaign: { status: { not: "REVIEW" as const } } } : {};
    const [notices, deliveries, consignments] = await Promise.all([
      prisma.publicNotice.findMany({ where: { ...where, ...sent }, orderBy: { createdAt: "asc" } }),
      prisma.campaignDelivery.findMany({
        where: { ...where, ...sent },
        include: {
          campaign: { select: { id: true, templateName: true, createdAt: true, confirmedAt: true, mode: true, status: true } },
        },
        orderBy: { campaign: { createdAt: "asc" } },
      }),
      prisma.speedPostConsignment.findMany({
        where: { ...where, ...sent },
        include: { events: { orderBy: { occurredAt: "asc" } } },
      }),
    ]);
    return assembleTimeline({
      bankId: scope,
      loan,
      account,
      notices,
      deliveries: deliveries.filter((row) => !input.sentOnly || alreadySent(row.campaign.status)),
      consignments,
      technical: input.technical,
      viewOnly: input.sentOnly,
    });
  }

  const tail = mobile.replace(/\D/g, "").slice(-10);
  if (tail.length < 10) {
    return assembleTimeline({
      bankId: scope,
      loan: "",
      account: "",
      notices: [],
      deliveries: [],
      consignments: [],
      technical: input.technical,
      viewOnly: input.sentOnly,
    });
  }
  const candidates = await prisma.campaignDelivery.findMany({
    where: {
      bankId: scope,
      mobile: { contains: tail },
      ...(input.sentOnly ? { campaign: { status: { not: "REVIEW" } } } : {}),
    },
    include: {
      campaign: { select: { id: true, templateName: true, createdAt: true, confirmedAt: true, mode: true, status: true } },
    },
    orderBy: { campaign: { createdAt: "asc" } },
    take: 200,
  });
  const deliveries = candidates.filter(
    (row) =>
      row.mobile.replace(/\D/g, "").slice(-10) === tail &&
      (!input.sentOnly || alreadySent(row.campaign.status)),
  );
  const noticeNumbers = [...new Set(deliveries.map((row) => row.noticeNumber).filter(Boolean))];
  const loans = [...new Set(deliveries.map((row) => row.loanNumber).filter(Boolean))];
  const postalOr = [
    noticeNumbers.length ? { noticeNumber: { in: noticeNumbers } } : null,
    loans.length ? { loanNumber: { in: loans } } : null,
  ].filter((item): item is { noticeNumber: { in: string[] } } | { loanNumber: { in: string[] } } => Boolean(item));
  const [notices, consignments] = await Promise.all([
    noticeNumbers.length
      ? prisma.publicNotice.findMany({
          where: {
            bankId: scope,
            noticeNumber: { in: noticeNumbers },
            ...(input.sentOnly ? { campaign: { status: { not: "REVIEW" } } } : {}),
          },
        })
      : Promise.resolve([]),
    postalOr.length
      ? prisma.speedPostConsignment.findMany({
          where: {
            bankId: scope,
            OR: postalOr,
            ...(input.sentOnly ? { campaign: { status: { not: "REVIEW" } } } : {}),
          },
          include: { events: { orderBy: { occurredAt: "asc" } } },
        })
      : Promise.resolve([]),
  ]);
  return assembleTimeline({
    technical: input.technical,
    viewOnly: input.sentOnly,
    bankId: scope,
    loan: loans.length === 1 ? loans[0] : "",
    account: "",
    notices,
    deliveries,
    consignments,
  });
}

type NoticeRow = {
  id: string;
  noticeNumber: string;
  customerName: string;
  loanNumber: string;
  customerId: string;
  createdAt: Date;
  linkOpenedAt: Date | null;
  linkLastViewedAt: Date | null;
  linkViewCount: number;
};

type DeliveryRow = {
  id: string;
  customerName: string;
  loanNumber: string;
  customerId: string;
  channel: string;
  status: string;
  detail: string;
  noticeNumber: string;
  openedAt: Date | null;
  campaign: {
    id: string;
    templateName: string;
    createdAt: Date;
    confirmedAt: Date | null;
    mode: string;
  };
};

type ConsignmentRow = {
  id: string;
  customerName: string;
  loanNumber: string;
  customerId: string;
  articleNumber: string;
  noticeNumber: string;
  events: Array<{ id: string; status: string; note: string; occurredAt: Date; source: string }>;
};

export function assembleTimeline(input: {
  technical?: boolean;
  viewOnly?: boolean;
  bankId: string;
  loan: string;
  account: string;
  notices: NoticeRow[];
  deliveries: DeliveryRow[];
  consignments: ConsignmentRow[];
}): AccountTimeline {
  const events: TimelineEvent[] = [];
  for (const notice of input.notices) {
    events.push({
      id: `notice-${notice.id}`,
      at: notice.createdAt,
      kind: "notice",
      title: "Notice created",
      detail: notice.noticeNumber,
      href: noticePageHref(notice.noticeNumber),
      hrefLabel: "Open notice",
    });
    if (notice.linkOpenedAt) {
      events.push({
        id: `link-open-${notice.id}`,
        at: notice.linkOpenedAt,
        kind: "link",
        title: "Notice link opened",
        detail: notice.linkViewCount > 0 ? `${notice.linkViewCount} ${notice.linkViewCount === 1 ? "view" : "views"}` : "",
        href: noticePageHref(notice.noticeNumber),
        hrefLabel: "Open notice",
      });
    }
    if (
      notice.linkLastViewedAt &&
      notice.linkViewCount > 1 &&
      (!notice.linkOpenedAt || notice.linkLastViewedAt.getTime() !== notice.linkOpenedAt.getTime())
    ) {
      events.push({
        id: `link-last-${notice.id}`,
        at: notice.linkLastViewedAt,
        kind: "link",
        title: "Notice link viewed again",
        detail: `${notice.linkViewCount} views`,
        href: noticePageHref(notice.noticeNumber),
        hrefLabel: "Open notice",
      });
    }
  }

  for (const row of input.deliveries) {
    const channel = sendChannelLabel(row.channel);
    const when = row.campaign.confirmedAt ?? row.campaign.createdAt;
    events.push({
      id: `delivery-${row.id}`,
      at: when,
      kind: "channel",
      title: `${channel} · ${deliveryStatusLabel(row.status, Boolean(input.technical))}`,
      detail: hideVendorWording(
        [row.campaign.templateName, row.detail].filter(Boolean).join(" · "),
        Boolean(input.technical),
      ),
      href: `/campaigns/${row.campaign.id}?bank=${encodeURIComponent(input.bankId)}`,
      hrefLabel: "Open send",
    });
    if (row.openedAt && row.channel !== "SMS") {
      events.push({
        id: `opened-${row.id}`,
        at: row.openedAt,
        kind: "channel",
        title: `${channel} opened`,
        detail: hideVendorWording(
          row.campaign.mode === "DRY_RUN" ? "Recorded on a dry run." : "MSG91 reported this as opened or read.",
          Boolean(input.technical),
        ),
        href: `/campaigns/${row.campaign.id}?bank=${encodeURIComponent(input.bankId)}`,
        hrefLabel: "Open send",
      });
    }
  }

  for (const consignment of input.consignments) {
    const article = consignment.articleNumber ? `Article ${consignment.articleNumber}` : "Article number not entered yet";
    for (const event of consignment.events) {
      events.push({
        id: `post-${event.id}`,
        at: event.occurredAt,
        kind: "speed-post",
        title: `Speed Post · ${postalStatusLabel(event.status)}`,
        detail: hideVendorWording(
          [article, event.note, sourceLabel(event.source)].filter(Boolean).join(" · "),
          Boolean(input.technical),
        ),
        href: input.viewOnly ? "" : `/speed-post/${consignment.id}?bank=${encodeURIComponent(input.bankId)}`,
        hrefLabel: input.viewOnly ? "" : "Open consignment",
      });
    }
  }

  events.sort((left, right) => left.at.getTime() - right.at.getTime() || left.title.localeCompare(right.title));
  const names = [
    ...input.notices.map((row) => row.customerName),
    ...input.deliveries.map((row) => row.customerName),
    ...input.consignments.map((row) => row.customerName),
  ].map((name) => name.trim()).filter(Boolean);
  const customerIds = [
    ...input.notices.map((row) => row.customerId),
    ...input.deliveries.map((row) => row.customerId),
    ...input.consignments.map((row) => row.customerId),
  ].map((value) => value.trim()).filter(Boolean);

  return {
    customerName: names[0] ?? "This loan",
    loanNumber: input.loan,
    customerId: input.account || (new Set(customerIds).size === 1 ? customerIds[0] : ""),
    events,
  };
}

function sourceLabel(source: string): string {
  if (source === "csv") return "CSV import";
  if (source === "india-post") return "India Post API";
  if (source === "manual") return "Entered by staff";
  return "";
}
