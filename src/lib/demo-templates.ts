import { EMAIL_TEMPLATE_BODY, WHATSAPP_TEMPLATE_BODY } from "./msg91";
import { smsApprovedTemplateBody } from "./notice-link";

// Firm Approved library. These three rows match the live MSG91 templates staff send today.
// A template row has to belong to some bank, so a missing row is stored on the bank marked
// forViewer. That bank is not the author. The templates page lists these three for every
// bank and does not print "Written for" that bank.
// Starting the site again puts this wording back. Templates you add yourself are left alone.
//
// Live send still uses the ids in src/lib/msg91.ts: SMS uses MSG91_SMS_FLOW_ID,
// email uses EMAIL_TEMPLATE_SLUG (or MSG91_EMAIL_TEMPLATE_ID), and WhatsApp uses
// WHATSAPP_TEMPLATE_NAME. Those ids are not rewritten here. The body on each row is
// the approved message, with the variables left where that template reads them.
//
// seedKey nwh-loan-recall-sms and nwh-borrower-email are kept on purpose. A re-seed
// updates those existing rows instead of leaving the old practice names Approved.
// The WhatsApp row is a new seedKey because the old library had no WhatsApp-only template.

export const FIRM_LIBRARY_STATUS = "APPROVED";

export type DemoTemplate = {
  seedKey: string;
  name: string;
  dltTemplateId: string;
  channels: string[];
  status: typeof FIRM_LIBRARY_STATUS;
  body: string;
};

/** MSG91 SMS > Templates id for Legal_Notice_12092026, sender BVAKIL. */
export const MSG91_SMS_FLOW_ID = "6abf5af2e9226c340a0548e2";

/** Slug passed as MSG91 email template_id. Matches EMAIL_TEMPLATE_SLUG in msg91.ts. */
export const MSG91_EMAIL_TEMPLATE_ID = "legal_notice_non_payment";

/** MSG91 WhatsApp template name. Matches WHATSAPP_TEMPLATE_NAME in msg91.ts. */
export const MSG91_WHATSAPP_TEMPLATE_ID = "legal_notice_link";

export const RETIRED_PRACTICE_TEMPLATE_NAMES = [
  "Loan recall notice (SMS)",
  "Borrower email notice",
] as const;

export const RETIRED_PRACTICE_DLT_IDS = [
  "1107165400000000001",
  "1107165400000000002",
] as const;

const SMS_BODY = smsApprovedTemplateBody();
const EMAIL_BODY = EMAIL_TEMPLATE_BODY;
const WHATSAPP_BODY = WHATSAPP_TEMPLATE_BODY;

export const DEMO_TEMPLATES: DemoTemplate[] = [
  {
    seedKey: "nwh-loan-recall-sms",
    name: "Legal notice (SMS)",
    dltTemplateId: MSG91_SMS_FLOW_ID,
    channels: ["SMS"],
    status: FIRM_LIBRARY_STATUS,
    body: SMS_BODY,
  },
  {
    seedKey: "nwh-borrower-email",
    name: "Legal notice (email)",
    dltTemplateId: MSG91_EMAIL_TEMPLATE_ID,
    channels: ["EMAIL"],
    status: FIRM_LIBRARY_STATUS,
    body: EMAIL_BODY,
  },
  {
    seedKey: "msg91-legal-notice-whatsapp",
    name: "Legal notice (WhatsApp)",
    dltTemplateId: MSG91_WHATSAPP_TEMPLATE_ID,
    channels: ["WHATSAPP"],
    status: FIRM_LIBRARY_STATUS,
    body: WHATSAPP_BODY,
  },
];

export function firmLibraryTemplateWhere(): {
  status: typeof FIRM_LIBRARY_STATUS;
  OR: Array<
    | { seedKey: { in: string[] } }
    | { dltTemplateId: { in: string[] } }
    | { name: { in: string[] } }
  >;
} {
  return {
    status: FIRM_LIBRARY_STATUS,
    OR: [
      { seedKey: { in: DEMO_TEMPLATES.map((template) => template.seedKey) } },
      { dltTemplateId: { in: DEMO_TEMPLATES.map((template) => template.dltTemplateId) } },
      { name: { in: DEMO_TEMPLATES.map((template) => template.name) } },
    ],
  };
}

export function demoTemplateWrite(template: DemoTemplate) {
  return {
    name: template.name,
    dltTemplateId: template.dltTemplateId,
    channels: JSON.stringify(template.channels),
    body: template.body,
    status: template.status,
  };
}

export function matchesRetiredPracticeIdentity(template: {
  name: string;
  dltTemplateId: string;
}): boolean {
  const name = template.name.trim();
  const dlt = template.dltTemplateId.trim();
  return (
    (RETIRED_PRACTICE_TEMPLATE_NAMES as readonly string[]).includes(name) ||
    (RETIRED_PRACTICE_DLT_IDS as readonly string[]).includes(dlt)
  );
}

export function isRetiredPracticeTemplate(template: {
  name: string;
  dltTemplateId: string;
  status: string;
}): boolean {
  if (template.status.trim().toUpperCase() !== FIRM_LIBRARY_STATUS) return false;
  return matchesRetiredPracticeIdentity(template);
}

// The firm library is the three live MSG91 rows. Staff should recognise them by name
// and by the live id, and the page must not credit the bank row that stores them.
export function isFirmLibraryTemplate(template: {
  seedKey?: string | null;
  dltTemplateId?: string | null;
  name?: string | null;
}): boolean {
  const seed = (template.seedKey ?? "").trim();
  if (seed && DEMO_TEMPLATES.some((item) => item.seedKey === seed)) return true;
  const dlt = (template.dltTemplateId ?? "").trim();
  if (dlt && DEMO_TEMPLATES.some((item) => item.dltTemplateId === dlt)) return true;
  const name = (template.name ?? "").trim();
  return Boolean(name) && DEMO_TEMPLATES.some((item) => item.name === name);
}

// The message shown for a firm template. A stored note that only says live send
// ignores free text is replaced by the approved wording.
export function firmTemplateMessage(template: {
  seedKey?: string | null;
  dltTemplateId?: string | null;
  name?: string | null;
  body?: string | null;
}): string {
  if (!isFirmLibraryTemplate(template)) return template.body ?? "";
  const seed = (template.seedKey ?? "").trim();
  const dlt = (template.dltTemplateId ?? "").trim();
  const name = (template.name ?? "").trim();
  const match =
    DEMO_TEMPLATES.find((item) => seed && item.seedKey === seed) ??
    DEMO_TEMPLATES.find((item) => dlt && item.dltTemplateId === dlt) ??
    DEMO_TEMPLATES.find((item) => name && item.name === name);
  return match?.body ?? template.body ?? "";
}
