// Saves and loads one public notice. The page shows only the row that matches the number.

import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { logDesk } from "./desk-log";
import { prisma } from "./db";
import { tooManyAttempts } from "./rate-limit";
import { demandNoticePlainText } from "./demand-notice";
import type { NoticeRecipient } from "./merge-notice";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const NOTICE_NUMBER_PATTERN = /^[A-Z0-9-]{1,40}$/;

export type PublicNoticeView = {
  noticeNumber: string;
  customerName: string;
  address: string;
  loanAmount: string;
  outstandingAmount: string;
  loanNumber: string;
  customerId: string;
  loanType: string;
  referenceNumber: string;
  collectionManager: string;
  collectionManagerMobile: string;
  bankWebsite: string;
  bankName: string;
  body: string;
  createdAt: Date;
};

export type NoticeDraft = {
  noticeNumber: string;
  recipientRowId: string;
  customerName: string;
  address: string;
  loanAmount: string;
  outstandingAmount: string;
  loanNumber: string;
  customerId: string;
  loanType: string;
  referenceNumber: string;
  collectionManager: string;
  collectionManagerMobile: string;
  bankWebsite: string;
  bankName: string;
  body: string;
};

type NoticeRow = NoticeRecipient & { id: string };

export function newNoticeNumber(): string {
  const bytes = randomBytes(12);
  let out = "";
  for (let index = 0; index < 12; index += 1) {
    out += ALPHABET[(bytes[index] ?? 0) % ALPHABET.length];
  }
  return out;
}

export function normalizeNoticeNumber(raw: string | undefined | null): string {
  const value = (raw ?? "").trim().toUpperCase();
  if (!NOTICE_NUMBER_PATTERN.test(value)) return "";
  return value;
}

export function buildNoticeDraft(
  row: NoticeRow,
  bankName: string,
  noticeNumber: string,
): NoticeDraft {
  const letter = {
    customerName: row.customerName,
    address: row.address,
    outstandingAmount: row.outstandingAmount,
    loanNumber: row.loanNumber,
    bankName,
    loanType: row.loanType,
    referenceNumber: row.referenceNumber,
    collectionManager: row.collectionManager,
    collectionManagerMobile: row.collectionManagerMobile,
    bankWebsite: row.bankWebsite,
    noticeNumber,
    dated: new Date(),
  };
  return {
    noticeNumber,
    recipientRowId: row.id,
    customerName: row.customerName,
    address: row.address,
    loanAmount: row.loanAmount,
    outstandingAmount: row.outstandingAmount,
    loanNumber: row.loanNumber,
    customerId: row.customerId,
    loanType: row.loanType,
    referenceNumber: row.referenceNumber,
    collectionManager: row.collectionManager,
    collectionManagerMobile: row.collectionManagerMobile,
    bankWebsite: row.bankWebsite,
    bankName,
    body: demandNoticePlainText(letter),
  };
}

export async function assignNoticeNumbers(
  db: Prisma.TransactionClient,
  count: number,
): Promise<string[]> {
  if (count === 0) return [];
  const chosen: string[] = [];
  const seen = new Set<string>();
  while (chosen.length < count) {
    const candidate = newNoticeNumber();
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    chosen.push(candidate);
  }

  const existing = await db.publicNotice.findMany({
    where: { noticeNumber: { in: chosen } },
    select: { noticeNumber: true },
  });
  if (existing.length === 0) return chosen;

  const taken = new Set(existing.map((row) => row.noticeNumber));
  const free: string[] = [];
  for (const number of chosen) {
    if (!taken.has(number)) {
      free.push(number);
      continue;
    }
    free.push(await freshNoticeNumber(db, seen));
  }
  return free;
}

async function freshNoticeNumber(db: Prisma.TransactionClient, seen: Set<string>): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = newNoticeNumber();
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    const existing = await db.publicNotice.findUnique({
      where: { noticeNumber: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  throw new Error("Could not assign a notice number.");
}

export type NoticeLinkOpen = {
  linkOpenedAt: Date | null;
  linkLastViewedAt: Date | null;
  linkViewCount: number;
};

// Obvious crawlers, link-preview fetchers, and health checks. A normal browser,
// including the WhatsApp in-app browser, does not match.
const NOTICE_VIEW_BOT =
  /(?:^whatsapp\/\d|facebookexternalhit|telegrambot|slackbot|twitterbot|linkedinbot|discordbot|googlehc|kube-probe|googlebot|bingbot|duckduckbot|baiduspider|yandexbot|applebot|petalbot|bytespider|ahrefsbot|semrushbot|dotbot|embedly|pinterest|vkshare|iframely|skypeuripreview|bingpreview)|bot\b|crawler|spider|slurp|headless|phantomjs|curl\/|wget\/|python-requests|go-http-client|scrapy|pingdom|statuscake|uptimerobot|health[- ]?check|monitoring/i;

export function shouldRecordNoticeView(headerList: { get(name: string): string | null }): boolean {
  // Next.js hides next-router-prefetch from headers(). In-app notice links set prefetch={false}.
  // Purpose / Sec-Purpose still catches browser speculative prefetches.
  if (headerList.get("next-router-prefetch") || headerList.get("next-router-segment-prefetch")) {
    return false;
  }
  const purpose = `${headerList.get("purpose") ?? ""} ${headerList.get("sec-purpose") ?? ""}`.toLowerCase();
  if (purpose.includes("prefetch")) return false;
  const userAgent = (headerList.get("user-agent") ?? "").trim();
  if (!userAgent) return false;
  if (NOTICE_VIEW_BOT.test(userAgent)) return false;
  return true;
}

// Keeps the first open, and counts later views of the same notice page.
export async function recordPublicNoticeOpen(noticeNumber: string): Promise<void> {
  if (tooManyAttempts(`notice-view:${noticeNumber}`, 40, 60 * 1000)) return;
  const now = new Date();
  try {
    await prisma.$transaction([
      prisma.publicNotice.updateMany({
        where: { noticeNumber, linkOpenedAt: null },
        data: { linkOpenedAt: now },
      }),
      prisma.publicNotice.updateMany({
        where: { noticeNumber },
        data: { linkLastViewedAt: now, linkViewCount: { increment: 1 } },
      }),
    ]);
  } catch (error) {
    logDesk("notice.open.error", {
      message: error instanceof Error ? error.message.slice(0, 160) : "failed",
    });
  }
}

export async function noticeLinkOpensByNumber(
  noticeNumbers: Iterable<string>,
): Promise<Map<string, NoticeLinkOpen>> {
  const unique = [...new Set([...noticeNumbers].map((value) => value.trim()).filter(Boolean))];
  if (unique.length === 0) return new Map();
  const rows = await prisma.publicNotice.findMany({
    where: { noticeNumber: { in: unique } },
    select: {
      noticeNumber: true,
      linkOpenedAt: true,
      linkLastViewedAt: true,
      linkViewCount: true,
    },
  });
  return new Map(
    rows.map((row) => [
      row.noticeNumber,
      {
        linkOpenedAt: row.linkOpenedAt,
        linkLastViewedAt: row.linkLastViewedAt,
        linkViewCount: row.linkViewCount,
      },
    ]),
  );
}

export async function findPublicNotice(raw: string | undefined | null): Promise<PublicNoticeView | null> {
  const noticeNumber = normalizeNoticeNumber(raw);
  if (!noticeNumber) return null;
  return prisma.publicNotice.findUnique({
    where: { noticeNumber },
    select: {
      noticeNumber: true,
      customerName: true,
      address: true,
      loanAmount: true,
      outstandingAmount: true,
      loanNumber: true,
      customerId: true,
      loanType: true,
      referenceNumber: true,
      collectionManager: true,
      collectionManagerMobile: true,
      bankWebsite: true,
      bankName: true,
      body: true,
      createdAt: true,
    },
  });
}
