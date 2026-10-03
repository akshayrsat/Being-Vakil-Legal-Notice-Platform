// Which saved templates a bank can select.
// Approved wording is the firm library: every bank can select it.
// A draft stays on the bank it was written for.
// A spreadsheet upload is a list of people. It does not create a template.

import { isFirmLibraryTemplate } from "./demo-templates";
import { isApprovedTemplateStatus } from "./templates";

export type NamedTemplate = {
  id: string;
  name: string;
};

export type BankTemplateRow = NamedTemplate & {
  bankId: string;
  status: string;
};

export type OtherBankApproved = {
  bankId: string;
  bankName: string;
  bankCode: string;
  count: number;
  names: string[];
};

export function sortTemplatesByName<T extends NamedTemplate>(templates: T[]): T[] {
  return [...templates].sort((a, b) => {
    const byName = a.name.localeCompare(b.name, "en", { sensitivity: "base" });
    if (byName !== 0) return byName;
    return a.id.localeCompare(b.id);
  });
}

export function approvedTemplatesForBank<T extends BankTemplateRow>(templates: T[], bankId: string): T[] {
  // bankId is the bank being worked on. Approved wording from every bank is selectable.
  void bankId;
  return sortTemplatesByName(templates.filter((template) => isApprovedTemplateStatus(template.status)));
}

export function otherBankApprovedSummary(
  rows: Array<{
    bankId: string;
    status: string;
    name: string;
    seedKey?: string | null;
    dltTemplateId?: string | null;
  }>,
  banks: Array<{ id: string; name: string; code: string }>,
  workingBankId: string,
): OtherBankApproved[] {
  const namesByBank = new Map<string, string[]>();
  for (const row of rows) {
    if (row.bankId === workingBankId || !isApprovedTemplateStatus(row.status)) continue;
    // Firm MSG91 rows are not "wording from another bank".
    if (isFirmLibraryTemplate(row)) continue;
    const names = namesByBank.get(row.bankId) ?? [];
    names.push(row.name);
    namesByBank.set(row.bankId, names);
  }

  const bankById = new Map(banks.map((bank) => [bank.id, bank]));
  const summaries: OtherBankApproved[] = [];
  for (const [bankId, names] of namesByBank) {
    const bank = bankById.get(bankId);
    const sorted = [...names].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
    summaries.push({
      bankId,
      bankName: bank?.name ?? "Another bank",
      bankCode: bank?.code ?? "",
      count: sorted.length,
      names: sorted,
    });
  }
  summaries.sort((a, b) => a.bankName.localeCompare(b.bankName, "en", { sensitivity: "base" }));
  return summaries;
}

export function templateLibraryNotes(input: {
  bankName: string;
  savedCount: number;
  approvedCount: number;
  elsewhere: OtherBankApproved[];
}): string[] {
  const notes: string[] = [];

  if (input.approvedCount === 0) {
    notes.push(
      `Uploading a spreadsheet saves the people for ${input.bankName}. It does not save notice wording. The list is the firm’s approved notice templates. This site does not write a template.`,
    );
  }

  if (input.elsewhere.length > 0) {
    const where = input.elsewhere
      .map((bank) => {
        const code = bank.bankCode ? ` (${bank.bankCode})` : "";
        return `${bank.bankName}${code}: ${bank.names.join(", ")}`;
      })
      .join("; ");
    notes.push(
      `Approved wording from another bank is already listed for ${input.bankName}: ${where}. Spreadsheets and people stay on ${input.bankName}.`,
    );
  }

  return notes;
}

export function templatesListIntro(bankName: string, showVendorDetail: boolean): string {
  const shared = `These are the firm’s approved notice templates. Every bank, including ${bankName}, can select them.`;
  const vendor = showVendorDetail
    ? " SMS templates are approved on DLT. WhatsApp templates are created on MSG91 or Facebook."
    : "";
  return `${shared}${vendor} This page does not write a template. Spreadsheets and the people in them stay on ${bankName}.`;
}

export function templatesListCard(showVendorDetail: boolean): string {
  if (showVendorDetail) {
    return "Approved templates are listed A to Z, with the channel and the reference id. Open one to read it. The same three are available for every bank.";
  }
  return "Approved templates are listed A to Z. Each row shows the name and the channel. Open one to read it. The same three are available for every bank.";
}

export function templatesEmptyLibrary(): string {
  return "No approved template is in the library yet.";
}

export function templateDetailCard(showVendorDetail: boolean): string {
  if (showVendorDetail) {
    return "The name, the channel, the template reference, and the message. This page does not change them.";
  }
  return "The name, the channel, and the message. This page does not change the template.";
}

export function templateMissingCopy(): string {
  return "That template is not one of the firm’s approved notice templates.";
}
