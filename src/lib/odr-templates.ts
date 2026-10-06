// ODR message slots. Each name can be filled in Settings or by an environment variable.
// Empty means that channel is not sent. The approved first-hearing wording is fixed text.

import { odrMatterLabel } from "./odr-status";

export const ODR_TEMPLATE_KINDS = ["first", "next", "reminder"] as const;
export type OdrTemplateKind = (typeof ODR_TEMPLATE_KINDS)[number];

export type OdrChannelTemplates = {
  smsFlowId: string;
  emailTemplateId: string;
  whatsappTemplate: string;
};

export type OdrTemplateMap = Record<string, OdrChannelTemplates>;

export const ODR_SETTINGS_ID = "odr-settings";
export const ODR_WHATSAPP_LANGUAGE = "en";
export const DEFAULT_ODR_WHATSAPP_FROM = "919653331393";

export const FIRST_HEARING_EMAIL_SUBJECT =
  "First Arbitration Hearing: {{bank}} vs. {{customer}} and ors, Ref. {{number}}";

export const FIRST_HEARING_EMAIL_TEXT = [
  "Dear {{customer}},",
  "",
  "We are Being Vakil Associates, representing {{bank}} in the following arbitration matter:",
  "",
  "{{bank}} vs. {{customer}} and ors",
  "Arbitration Ref.: {{number}}",
  "",
  "Please note that the first hearing in the above matter is scheduled on {{date}} at {{time}} and will be conducted online through Google Meet.",
  "",
  "Hearing Link: {{link}}",
  "",
  "You are requested to remain present for the hearing at the scheduled time. You may join from your mobile phone or computer using the link above.",
  "",
  "Your private case page: {{case}}",
  "",
  "For any queries, please contact us at +91 9653331393 or contact@beingvakil.in.",
  "",
  "Regards,",
  "Being Vakil Associates",
].join("\n");

export const FIRST_HEARING_WHATSAPP_TEXT = [
  "Dear {{1}},",
  "",
  "We are Being Vakil Associates, representing {{2}} in the arbitration matter:",
  "",
  "{{3}} vs. {{4}} and ors",
  "Arbitration Ref.: {{5}}",
  "",
  "Please note that the first hearing is scheduled on {{6}} at {{7}} through Google Meet.",
  "",
  "Hearing Link: {{8}}",
  "",
  "You are requested to remain present for the hearing.",
  "",
  "Regards,",
  "Being Vakil Associates",
].join("\n");

const SLOT_ENV: Record<string, { sms: string; email: string; whatsapp: string }> = {
  "arbitration.first": {
    sms: "ODR_SMS_FLOW_ID",
    email: "ODR_EMAIL_TEMPLATE_ID",
    whatsapp: "ODR_WHATSAPP_TEMPLATE",
  },
  "arbitration.next": {
    sms: "ODR_NEXT_SMS_FLOW_ID",
    email: "ODR_NEXT_EMAIL_TEMPLATE_ID",
    whatsapp: "ODR_NEXT_WHATSAPP_TEMPLATE",
  },
  "arbitration.reminder": {
    sms: "ODR_REMINDER_SMS_FLOW_ID",
    email: "ODR_REMINDER_EMAIL_TEMPLATE_ID",
    whatsapp: "ODR_REMINDER_WHATSAPP_TEMPLATE",
  },
  "mediation.first": {
    sms: "ODR_MEDIATION_SMS_FLOW_ID",
    email: "ODR_MEDIATION_EMAIL_TEMPLATE_ID",
    whatsapp: "ODR_MEDIATION_WHATSAPP_TEMPLATE",
  },
  "mediation.next": {
    sms: "ODR_MEDIATION_NEXT_SMS_FLOW_ID",
    email: "ODR_MEDIATION_NEXT_EMAIL_TEMPLATE_ID",
    whatsapp: "ODR_MEDIATION_NEXT_WHATSAPP_TEMPLATE",
  },
  "mediation.reminder": {
    sms: "ODR_MEDIATION_REMINDER_SMS_FLOW_ID",
    email: "ODR_MEDIATION_REMINDER_EMAIL_TEMPLATE_ID",
    whatsapp: "ODR_MEDIATION_REMINDER_WHATSAPP_TEMPLATE",
  },
};

export function odrTemplateSlots(): string[] {
  return Object.keys(SLOT_ENV);
}

export function templateSlot(matterType: string, kind: OdrTemplateKind): string {
  const matter = matterType === "MEDIATION" ? "mediation" : "arbitration";
  return `${matter}.${kind}`;
}

export function slotLabel(slot: string): string {
  const [matter, kind] = slot.split(".");
  const matterLabel = matter === "mediation" ? "Mediation" : "Arbitration";
  const kindLabel = kind === "next" ? "Next hearing" : kind === "reminder" ? "Reminder" : "First hearing";
  return `${matterLabel} · ${kindLabel}`;
}

function envSlot(name: string, env: Record<string, string | undefined>): string {
  return (env[name] ?? "").trim();
}

export function defaultTemplateMap(env: Record<string, string | undefined> = process.env): OdrTemplateMap {
  const map: OdrTemplateMap = {};
  for (const [slot, names] of Object.entries(SLOT_ENV)) {
    map[slot] = {
      smsFlowId: envSlot(names.sms, env),
      emailTemplateId:
        envSlot(names.email, env) || (slot === "arbitration.first" ? "arbitration_first_hearing" : ""),
      whatsappTemplate:
        envSlot(names.whatsapp, env) || (slot === "arbitration.first" ? "arbitration_first_hearing" : ""),
    };
  }
  return map;
}

export function parseTemplateMap(raw: string | null | undefined, env: Record<string, string | undefined> = process.env): OdrTemplateMap {
  const base = defaultTemplateMap(env);
  if (!raw) return base;
  try {
    const parsed = JSON.parse(raw) as Record<string, Partial<OdrChannelTemplates>>;
    for (const slot of Object.keys(base)) {
      const row = parsed[slot];
      if (!row || typeof row !== "object") continue;
      if (typeof row.smsFlowId === "string") base[slot].smsFlowId = row.smsFlowId.trim();
      if (typeof row.emailTemplateId === "string") base[slot].emailTemplateId = row.emailTemplateId.trim();
      if (typeof row.whatsappTemplate === "string") base[slot].whatsappTemplate = row.whatsappTemplate.trim();
    }
  } catch {
    return base;
  }
  return base;
}

export function templatesFor(
  map: OdrTemplateMap,
  matterType: string,
  kind: OdrTemplateKind,
): OdrChannelTemplates {
  return map[templateSlot(matterType, kind)] ?? { smsFlowId: "", emailTemplateId: "", whatsappTemplate: "" };
}

export function whatsAppFrom(env: Record<string, string | undefined> = process.env): string {
  return (env.ODR_WHATSAPP_FROM ?? "").trim() || DEFAULT_ODR_WHATSAPP_FROM;
}

export function smsSender(env: Record<string, string | undefined> = process.env): string {
  return (env.ODR_SMS_SENDER_ID ?? "").trim() || (env.MSG91_SENDER_ID ?? "").trim() || "BVAKIL";
}

export type HearingMessageInput = {
  customer: string;
  bank: string;
  number: string;
  date: string;
  time: string;
  meetLink: string;
  caseLink: string;
  ordinal: string;
  matterType: string;
  kind: OdrTemplateKind;
};

export function hearingMessageText(input: HearingMessageInput): string {
  if (input.matterType === "MEDIATION") return mediationMessageText(input);
  const matter = odrMatterLabel(input.matterType);
  if (input.kind === "first" && input.matterType !== "MEDIATION") {
    return FIRST_HEARING_EMAIL_TEXT.replaceAll("{{customer}}", input.customer)
      .replaceAll("{{bank}}", input.bank)
      .replaceAll("{{number}}", input.number)
      .replaceAll("{{date}}", input.date)
      .replaceAll("{{time}}", input.time)
      .replaceAll("{{link}}", input.meetLink)
      .replaceAll("{{case}}", input.caseLink);
  }
  const heading =
    input.kind === "reminder"
      ? `Reminder: your ${input.ordinal} ${matter.toLowerCase()} hearing`
      : `Your ${input.ordinal} ${matter.toLowerCase()} hearing`;
  return [
    `Dear ${input.customer},`,
    "",
    `We are Being Vakil Associates, representing ${input.bank} in the ${matter.toLowerCase()} matter:`,
    "",
    `${input.bank} vs. ${input.customer} and ors`,
    `${matter} Ref.: ${input.number}`,
    "",
    `${heading} is scheduled on ${input.date} at ${input.time} through Google Meet.`,
    "",
    `Hearing Link: ${input.meetLink}`,
    `Your private case page: ${input.caseLink}`,
    "",
    "You are requested to remain present for the hearing.",
    "",
    "Regards,",
    "Being Vakil Associates",
  ].join("\n");
}

function mediationMessageText(input: HearingMessageInput): string {
  const heading = input.kind === "reminder"
    ? "Reminder: you are invited to a voluntary mediation session"
    : "Invitation to a voluntary mediation session";
  return [
    `Dear ${input.customer},`,
    "",
    `Being Vakil Associates is writing for ${input.bank} to invite you to a voluntary mediation session.`,
    "",
    `${input.bank} and ${input.customer}`,
    `Mediation ref.: ${input.number}`,
    "",
    `${heading} on ${input.date} at ${input.time}.`,
    "You may join or decline. A settlement is recorded only if the people who join agree.",
    "",
    `Session link: ${input.meetLink}`,
    `Your private page: ${input.caseLink}`,
    "",
    "Regards,",
    "Being Vakil Associates",
  ].join("\n");
}

export function unconfiguredDetail(channel: string): string {
  if (channel === "SMS") return "SMS template not configured";
  if (channel === "EMAIL") return "Email template not configured";
  if (channel === "WHATSAPP") return "WhatsApp template not configured";
  return "Template not configured";
}

export function approvedWording(slot: string): string {
  if (slot === "arbitration.first") {
    return [`Subject: ${FIRST_HEARING_EMAIL_SUBJECT}`, "", FIRST_HEARING_EMAIL_TEXT, "", "WhatsApp:", FIRST_HEARING_WHATSAPP_TEXT].join(
      "\n",
    );
  }
  return "This template is not approved yet. Set the template id when it is ready. Until then this channel is not sent.";
}
