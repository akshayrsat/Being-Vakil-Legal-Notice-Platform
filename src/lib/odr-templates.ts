// ODR message slots. Each name can be filled in Settings or by an environment variable.
// Empty means that channel is not sent. The approved first-hearing wording is fixed text.

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
  "{{order}}",
  "{{arbitrator}}",
  "",
  "Dear {{customer}},",
  "",
  "A hearing is fixed in {{bank}} vs. {{customer}}, Arbitration Ref. {{number}}.",
  "Statement of claim: {{claimRef}}",
  "Defence or reply by: {{defenceBy}}",
  "You may object to the arbitrator within 15 days of receiving this notice, under Section 13 of the Arbitration and Conciliation Act, 1996.",
  "On your case page you may accept the named arbitrator, choose one name from the panel, or say none of these / I object. That step is recorded. It does not decide the dispute.",
  "",
  "{{when}} is on {{date}} at {{time}} through Google Meet.",
  "Hearing Link: {{link}}",
  "Your private case page: {{case}}",
  "",
  "You are requested to remain present for the hearing.",
  "",
  "Being Vakil Associates",
  "Counsel for the claimant",
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
  legalRoute?: string;
  kind: OdrTemplateKind;
  panelCount?: number;
  arbitratorName?: string;
  claimReference?: string;
  defenceDeadline?: string;
};

export function tribunalOrderLine(panelCount: number): string {
  return panelCount > 1 ? "By order of the Arbitral Tribunal" : "By order of the Sole Arbitrator";
}

export function hearingMessageText(input: HearingMessageInput): string {
  if (input.legalRoute === "CONCILIATION" || (input.legalRoute === "LOK_ADALAT")) {
    return routeMessageText(input);
  }
  if (input.matterType === "MEDIATION") return mediationMessageText(input);
  const when = input.kind === "reminder" ? `Reminder: the ${input.ordinal} hearing` : `The ${input.ordinal} hearing`;
  return FIRST_HEARING_EMAIL_TEXT.replaceAll("{{order}}", tribunalOrderLine(input.panelCount ?? 1))
    .replaceAll("{{arbitrator}}", input.arbitratorName?.trim() || "The arbitrator named on the case page")
    .replaceAll("{{customer}}", input.customer)
    .replaceAll("{{bank}}", input.bank)
    .replaceAll("{{number}}", input.number)
    .replaceAll("{{claimRef}}", input.claimReference?.trim() || "the statement of claim on your case page")
    .replaceAll("{{defenceBy}}", input.defenceDeadline?.trim() || "a date the tribunal will fix")
    .replaceAll("{{when}}", when)
    .replaceAll("{{date}}", input.date)
    .replaceAll("{{time}}", input.time)
    .replaceAll("{{link}}", input.meetLink)
    .replaceAll("{{case}}", input.caseLink);
}

function routeMessageText(input: HearingMessageInput): string {
  if (input.legalRoute === "LOK_ADALAT") {
    return [
      `Dear ${input.customer},`,
      "",
      `${input.bank} is referring ${input.number} to a Lok Adalat.`,
      "A hearing is not held on this page. The sitting is at the Legal Services Authority or the DRT.",
      `Your private page: ${input.caseLink}`,
      "",
      "Regards,",
      "Being Vakil Associates",
    ].join("\n");
  }
  return [
    `Dear ${input.customer},`,
    "",
    `Being Vakil Associates is writing for ${input.bank} to invite you to conciliation under Section 62 of the Arbitration and Conciliation Act, 1996.`,
    "",
    `${input.bank} and ${input.customer}`,
    `Conciliation ref.: ${input.number}`,
    "",
    `You may accept or decline on your case page. If you do not reply within 30 days, the invitation is declined.`,
    "The conciliator does not decide the dispute. Nothing is decided if you do not join.",
    "This session is not recorded.",
    "",
    input.meetLink ? `Session link, if you accept: ${input.meetLink}` : "",
    `Your private page: ${input.caseLink}`,
    "",
    "Regards,",
    "Being Vakil Associates",
  ].filter((line) => line !== undefined).join("\n");
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
    "If you miss a session, it can be rescheduled or the matter can be closed. Nothing is decided because you were absent.",
    "This session is not recorded.",
    "",
    `Session link: ${input.meetLink}`,
    `Your private page: ${input.caseLink}`,
    "",
    "Regards,",
    "Being Vakil Associates",
  ].join("\n");
}

export const ODR_TEMPLATE_NOT_READY = "template not ready";

export function unconfiguredDetail(): string {
  return ODR_TEMPLATE_NOT_READY;
}

export function approvedWording(slot: string): string {
  if (slot === "arbitration.first") {
    return [`Subject: ${FIRST_HEARING_EMAIL_SUBJECT}`, "", FIRST_HEARING_EMAIL_TEXT, "", "WhatsApp:", FIRST_HEARING_WHATSAPP_TEXT].join(
      "\n",
    );
  }
  return "This template is not approved yet. Set the template id when it is ready. Until then this channel is not sent.";
}
