// Printed legal notices for the firm. Not the SMS, email, or WhatsApp message.
// The starter is the notice the app already sends. Staff can add more.

import type { PrismaClient } from "@prisma/client";
import { demandNoticePlainText, noticeDateLabel } from "./demand-notice";
import { fillNotice, noticePlainText, valuesForRecipient, type NoticeRecipient } from "./merge-notice";
import { noticePublicUrl } from "./notice-link";

export const LEGAL_NOTICE_STARTER_KEY = "firm-legal-notice";
export const LEGAL_NOTICE_STARTER_NAME = "Legal notice";
export const LEGAL_NOTICE_FORMAT_DEMAND = "demand";
export const LEGAL_NOTICE_FORMAT_TEXT = "text";

const NAME_MAX = 80;
const BODY_MAX = 12000;
const BODY_MIN = 40;

type LegalNoticeStore = Pick<PrismaClient, "legalNoticeTemplate">;

export function isDemandLegalNotice(format: string): boolean {
  return format === LEGAL_NOTICE_FORMAT_DEMAND;
}

export function isTextLegalNotice(format: string): boolean {
  return format === LEGAL_NOTICE_FORMAT_TEXT;
}

// Older notices have no format. They keep the letter the app already draws.
export function usesStructuredDemand(format: string): boolean {
  return format !== LEGAL_NOTICE_FORMAT_TEXT;
}

export function starterLegalNoticeBody(dated = new Date("2026-01-15T00:00:00+05:30")): string {
  const text = demandNoticePlainText({
    customerName: "{{customer_name}}",
    address: "{{address}}",
    outstandingAmount: "{{outstanding_amount}}",
    loanNumber: "{{loan_number}}",
    bankName: "{{bank_name}}",
    loanType: "{{loan_type}}",
    referenceNumber: "{{reference_number}}",
    collectionManager: "{{collection_manager}}",
    collectionManagerMobile: "{{collection_manager_mobile}}",
    bankWebsite: "{{bank_website}}",
    noticeNumber: "{{notice_number}}",
    dated,
  });
  return text.replace(/^Date : .+$/m, "Date : {{notice_date}}");
}

export async function ensureStarterLegalNotice(db: LegalNoticeStore): Promise<void> {
  const body = starterLegalNoticeBody();
  await db.legalNoticeTemplate.upsert({
    where: { seedKey: LEGAL_NOTICE_STARTER_KEY },
    update: {
      name: LEGAL_NOTICE_STARTER_NAME,
      body,
      format: LEGAL_NOTICE_FORMAT_DEMAND,
    },
    create: {
      name: LEGAL_NOTICE_STARTER_NAME,
      body,
      format: LEGAL_NOTICE_FORMAT_DEMAND,
      seedKey: LEGAL_NOTICE_STARTER_KEY,
    },
  });
}

export function sortLegalNotices<T extends { name: string; seedKey: string | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const aStarter = a.seedKey === LEGAL_NOTICE_STARTER_KEY ? 0 : 1;
    const bStarter = b.seedKey === LEGAL_NOTICE_STARTER_KEY ? 0 : 1;
    if (aStarter !== bStarter) return aStarter - bStarter;
    return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
  });
}

export function legalNoticeChoiceLabel(template: { name: string; seedKey: string | null }): string {
  if (template.seedKey === LEGAL_NOTICE_STARTER_KEY) return `${template.name} (current notice)`;
  return template.name;
}

export function legalNoticeParagraphs(body: string): string[] {
  return body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export function fillLegalNoticeDocument(
  body: string,
  row: NoticeRecipient,
  bankName: string,
  noticeNumber: string,
  dated: Date,
): string {
  const values = {
    ...valuesForRecipient(row, bankName),
    notice_number: noticeNumber.trim(),
    notice_link: noticeNumber.trim() ? noticePublicUrl(noticeNumber.trim()) : "",
    notice_date: noticeDateLabel(dated),
  };
  return noticePlainText(fillNotice(body, values)).trim();
}

export function draftLegalNoticeTemplate(input: {
  name: string;
  body: string;
  existingNames: string[];
}): { ok: true; name: string; body: string } | { ok: false; error: string } {
  const name = input.name.replace(/\s+/g, " ").trim();
  const body = input.body.replace(/\r\n/g, "\n").trim();
  if (name.length < 2 || name.length > NAME_MAX) {
    return { ok: false, error: "Enter a name, between 2 and 80 characters." };
  }
  if (namesOneBank(name) || namesOneBank(body)) {
    return {
      ok: false,
      error: "This template is for every bank. Use {{bank_name}} where the bank should appear.",
    };
  }
  if (body.length < BODY_MIN) {
    return { ok: false, error: "Enter the notice wording. It needs to be long enough to be a legal notice." };
  }
  if (body.length > BODY_MAX) {
    return { ok: false, error: "That notice is too long for one page. Shorten it and try again." };
  }
  const taken = new Set(input.existingNames.map((item) => item.trim().toLowerCase()));
  if (taken.has(name.toLowerCase())) {
    return { ok: false, error: "A legal notice with that name is already in the list. Use a different name." };
  }
  return { ok: true, name, body };
}

function namesOneBank(text: string): boolean {
  return /northwind/i.test(text);
}
