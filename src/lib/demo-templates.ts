// Firm Approved library. These three rows match the live MSG91 templates staff send today.
// They are stored on the bank marked forViewer (Northwind) and marked Approved, so every
// bank can select the wording. They are not copied onto each bank.
// Starting the site again puts this wording back. Templates you add yourself are left alone.
//
// Live MSG91 send does not read these dltTemplateId values. SMS uses MSG91_SMS_FLOW_ID,
// email uses EMAIL_TEMPLATE_SLUG (or MSG91_EMAIL_TEMPLATE_ID), and WhatsApp uses
// WHATSAPP_TEMPLATE_NAME in src/lib/msg91.ts. The ids here are what staff see in the library.
//
// seedKey nwh-loan-recall-sms and nwh-borrower-email are kept on purpose. A re-seed
// updates those existing rows instead of leaving the old practice names Approved.
// The WhatsApp row is a new seedKey because the old library had no WhatsApp-only template.

import { TEMPLATE_APPROVED } from "./templates";

export type DemoTemplate = {
  seedKey: string;
  name: string;
  dltTemplateId: string;
  channels: string[];
  status: typeof TEMPLATE_APPROVED;
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

const SMS_BODY = [
  "Legal notice (SMS). Live SMS uses the MSG91 flow Legal_Notice_12092026 (sender BVAKIL), not this free text.",
  "Merge variables: customer_name {{customer_name}}, bank_name {{bank_name}}, notice_number {{notice_number}}.",
].join(" ");

const EMAIL_BODY = [
  "Legal notice (email). Live email uses the MSG91 template legal_notice_non_payment, not this free text.",
  "Variables: contact_name {{customer_name}}, loan_account {{loan_number}}, notice_id {{notice_link}}, notice_link {{notice_link}}.",
].join(" ");

const WHATSAPP_BODY = [
  "Legal notice (WhatsApp). Live WhatsApp uses the MSG91 template legal_notice_link, not this free text.",
  "Variables: customer name {{customer_name}}, bank name {{bank_name}}, notice path notice-{{notice_number}} for https://www.notice.beingvakil.in/ (the first URL variable).",
].join(" ");

export const DEMO_TEMPLATES: DemoTemplate[] = [
  {
    seedKey: "nwh-loan-recall-sms",
    name: "Legal notice (SMS)",
    dltTemplateId: MSG91_SMS_FLOW_ID,
    channels: ["SMS"],
    status: TEMPLATE_APPROVED,
    body: SMS_BODY,
  },
  {
    seedKey: "nwh-borrower-email",
    name: "Legal notice (email)",
    dltTemplateId: MSG91_EMAIL_TEMPLATE_ID,
    channels: ["EMAIL"],
    status: TEMPLATE_APPROVED,
    body: EMAIL_BODY,
  },
  {
    seedKey: "msg91-legal-notice-whatsapp",
    name: "Legal notice (WhatsApp)",
    dltTemplateId: MSG91_WHATSAPP_TEMPLATE_ID,
    channels: ["WHATSAPP"],
    status: TEMPLATE_APPROVED,
    body: WHATSAPP_BODY,
  },
];

export function demoTemplateWrite(template: DemoTemplate) {
  return {
    name: template.name,
    dltTemplateId: template.dltTemplateId,
    channels: JSON.stringify(template.channels),
    body: template.body,
    status: template.status,
  };
}

export function isRetiredPracticeTemplate(template: {
  name: string;
  dltTemplateId: string;
  status: string;
}): boolean {
  if (template.status.trim().toUpperCase() !== TEMPLATE_APPROVED) return false;
  const name = template.name.trim();
  const dlt = template.dltTemplateId.trim();
  return (
    (RETIRED_PRACTICE_TEMPLATE_NAMES as readonly string[]).includes(name) ||
    (RETIRED_PRACTICE_DLT_IDS as readonly string[]).includes(dlt)
  );
}
