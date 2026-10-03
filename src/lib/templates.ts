// Approved wording is the firm library: every bank can select it.
// A draft stays on the bank it was written for.
// Spreadsheets, people, sends, and notices are not templates and stay on one bank.

import type { Prisma } from "@prisma/client";
import { isFirmLibraryTemplate } from "./demo-templates";

export const TEMPLATE_DRAFT = "DRAFT";
export const TEMPLATE_APPROVED = "APPROVED";

export const TEMPLATE_CHANNELS = [
  { id: "SMS", label: "SMS" },
  { id: "EMAIL", label: "Email" },
  { id: "WHATSAPP", label: "WhatsApp" },
] as const;

export type TemplateChannel = (typeof TEMPLATE_CHANNELS)[number]["id"];
export type TemplateStatusValue = typeof TEMPLATE_DRAFT | typeof TEMPLATE_APPROVED;

const CHANNEL_IDS = new Set<string>(TEMPLATE_CHANNELS.map((channel) => channel.id));

export function isApprovedTemplateStatus(status: string): boolean {
  return status.trim().toUpperCase() === TEMPLATE_APPROVED;
}

export function templateStatusLabel(status: string): string {
  if (isApprovedTemplateStatus(status)) return "Approved";
  if (status.trim().toUpperCase() === TEMPLATE_DRAFT) return "Draft";
  return "Draft";
}

export function parseChannels(raw: string | null | undefined): TemplateChannel[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is TemplateChannel => typeof item === "string" && CHANNEL_IDS.has(item));
  } catch {
    return [];
  }
}

export function channelsFromForm(formData: FormData): TemplateChannel[] {
  const picked = formData
    .getAll("channel")
    .map((value) => String(value).trim().toUpperCase())
    .filter((value): value is TemplateChannel => CHANNEL_IDS.has(value));
  return TEMPLATE_CHANNELS.map((channel) => channel.id).filter((id) => picked.includes(id));
}

export function channelLabels(channels: TemplateChannel[]): string {
  const labels = TEMPLATE_CHANNELS.filter((channel) => channels.includes(channel.id)).map(
    (channel) => channel.label,
  );
  return labels.join(", ");
}

export function statusFromForm(formData: FormData): TemplateStatusValue {
  return String(formData.get("status") ?? "") === TEMPLATE_APPROVED
    ? TEMPLATE_APPROVED
    : TEMPLATE_DRAFT;
}

// Fields copied onto a send. Recipient columns are intentionally absent.
export const templateWordingSelect = {
  id: true,
  name: true,
  body: true,
  dltTemplateId: true,
  channels: true,
  status: true,
} as const;

export type TemplateWording = {
  id: string;
  name: string;
  body: string;
  dltTemplateId: string;
  channels: string;
  status: string;
};

export function templateWording(template: TemplateWording): TemplateWording {
  return {
    id: template.id,
    name: template.name,
    body: template.body,
    dltTemplateId: template.dltTemplateId,
    channels: template.channels,
    status: template.status,
  };
}

// Approved rows from any bank, plus drafts written for this bank.
// Does not match uploads, recipients, campaigns, or notices.
export function visibleTemplatesWhere(bankId: string): Prisma.NoticeTemplateWhereInput {
  return {
    OR: [
      { status: TEMPLATE_APPROVED },
      { bankId, status: TEMPLATE_DRAFT },
    ],
  };
}

export function templateListedForBank(
  template: { bankId: string; status: string },
  bankId: string,
): boolean {
  if (isApprovedTemplateStatus(template.status)) return true;
  return template.status.trim().toUpperCase() === TEMPLATE_DRAFT && template.bankId === bankId;
}

export function listTemplatesForBank<T extends { bankId: string; status: string; name: string }>(
  templates: readonly T[],
  bankId: string,
): T[] {
  return templates.filter((template) => templateListedForBank(template, bankId)).sort(byLibraryOrder);
}

export function selectableApprovedTemplates<T extends { status: string; name: string }>(
  templates: readonly T[],
): T[] {
  return templates
    .filter((template) => template.status === TEMPLATE_APPROVED)
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
}

export function templateChoiceLabel(
  template: {
    name: string;
    bankId: string;
    bankName: string;
    seedKey?: string | null;
    dltTemplateId?: string | null;
  },
  workingBankId: string,
): string {
  // The firm MSG91 rows are shared wording. Do not suffix the bank that stores them.
  if (template.bankId === workingBankId || isFirmLibraryTemplate(template)) return template.name;
  const bankName = template.bankName.trim();
  return bankName ? `${template.name} (${bankName})` : template.name;
}

// Null means the row must not credit a bank. Firm library rows always return null.
export function templateBankCredit(
  template: {
    bankId: string;
    bankName: string;
    seedKey?: string | null;
    dltTemplateId?: string | null;
    name?: string | null;
  },
  workingBankId: string,
): string | null {
  if (isFirmLibraryTemplate(template)) return null;
  if (template.bankId === workingBankId) return "Written for this bank";
  const bankName = template.bankName.trim();
  return bankName ? `Written for ${bankName}` : null;
}

export function savedTemplateParts(
  template: {
    status: string;
    channels: string;
    dltTemplateId: string;
    bankId: string;
    bankName: string;
    seedKey?: string | null;
    name?: string | null;
  },
  workingBankId: string,
  showVendorDetail = false,
): string[] {
  const parts = [templateStatusLabel(template.status)];
  const channels = channelLabels(parseChannels(template.channels));
  if (channels) parts.push(channels);
  const dlt = template.dltTemplateId.trim();
  if (showVendorDetail && dlt) parts.push(`DLT ${dlt}`);
  const credit = templateBankCredit(template, workingBankId);
  if (credit) parts.push(credit);
  if (isApprovedTemplateStatus(template.status)) parts.push("Available for every bank");
  return parts;
}

export type StaffTemplateRow = {
  id: string;
  name: string;
  bankId: string;
  bankName: string;
  status: string;
  channels: string;
  dltTemplateId: string;
  seedKey?: string | null;
};

// What the templates page lists: the live firm rows only. Drafts and other wording stay off this page.
// showVendorDetail is for the owner admin. Everyone else gets the channel label only.
export function staffTemplateLibraryView(
  templates: readonly StaffTemplateRow[],
  workingBankId: string,
  options?: { showVendorDetail?: boolean },
): {
  choiceLabels: string[];
  saved: Array<{ id: string; name: string; detail: string }>;
} {
  const showVendorDetail = options?.showVendorDetail === true;
  const listed = selectableApprovedTemplates(
    listTemplatesForBank(templates, workingBankId).filter((template) => isFirmLibraryTemplate(template)),
  );
  return {
    choiceLabels: listed.map((template) =>
      templateChoiceLabel(
        {
          name: template.name,
          bankId: template.bankId,
          bankName: template.bankName,
          seedKey: template.seedKey,
          dltTemplateId: template.dltTemplateId,
        },
        workingBankId,
      ),
    ),
    saved: listed.map((template) => ({
      id: template.id,
      name: template.name,
      detail: showVendorDetail
        ? savedTemplateParts(template, workingBankId, true).join(" · ")
        : channelLabels(parseChannels(template.channels)) || "No channel",
    })),
  };
}

export function templatePageKicker(input: {
  workingBankName: string;
  workingBankId: string;
  templateBankId: string;
  templateBankName: string;
  seedKey?: string | null;
  dltTemplateId?: string | null;
  name?: string | null;
}): string {
  if (
    isFirmLibraryTemplate({
      seedKey: input.seedKey,
      dltTemplateId: input.dltTemplateId,
      name: input.name,
    })
  ) {
    return "Available for every bank";
  }
  if (input.templateBankId === input.workingBankId) return input.workingBankName;
  return `${input.workingBankName} · written for ${input.templateBankName}`;
}

export function templateNamesMatch(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export function draftNameTaken(
  templates: ReadonlyArray<{ id: string; bankId: string; name: string }>,
  bankId: string,
  name: string,
  exceptId: string,
): boolean {
  return templates.some(
    (template) =>
      template.bankId === bankId &&
      template.id !== exceptId &&
      templateNamesMatch(template.name, name),
  );
}

export function approvedNameTaken(
  templates: ReadonlyArray<{ id: string; name: string; status: string }>,
  name: string,
  exceptId: string,
): boolean {
  return templates.some(
    (template) =>
      template.status === TEMPLATE_APPROVED &&
      template.id !== exceptId &&
      templateNamesMatch(template.name, name),
  );
}

// A send may use Approved wording from any bank.
// The spreadsheet and every person on it must belong to the bank being worked on.
export function sendScope(input: {
  workingBankId: string;
  template: { status: string } | null;
  batch: { bankId: string } | null;
  rows: ReadonlyArray<{ bankId: string }>;
}): { ok: true } | { ok: false; reason: "template" | "batch" | "rows" } {
  if (!input.template || !isApprovedTemplateStatus(input.template.status)) {
    return { ok: false, reason: "template" };
  }
  if (!input.batch || input.batch.bankId !== input.workingBankId) {
    return { ok: false, reason: "batch" };
  }
  if (input.rows.length === 0 || input.rows.some((row) => row.bankId !== input.workingBankId)) {
    return { ok: false, reason: "rows" };
  }
  return { ok: true };
}

function byLibraryOrder<T extends { status: string; name: string }>(left: T, right: T): number {
  const leftRank = left.status === TEMPLATE_APPROVED ? 0 : 1;
  const rightRank = right.status === TEMPLATE_APPROVED ? 0 : 1;
  if (leftRank !== rightRank) return leftRank - rightRank;
  return left.name.localeCompare(right.name, "en");
}
