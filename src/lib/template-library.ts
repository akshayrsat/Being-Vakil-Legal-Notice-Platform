// Which saved templates a bank can select.
// Approved wording is the firm library: every bank can select it.
// A draft stays on the bank it was written for.
// A spreadsheet upload is a list of people. It does not create a template.

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
  rows: Array<{ bankId: string; status: string; name: string }>,
  banks: Array<{ id: string; name: string; code: string }>,
  workingBankId: string,
): OtherBankApproved[] {
  const namesByBank = new Map<string, string[]>();
  for (const row of rows) {
    if (row.bankId === workingBankId || !isApprovedTemplateStatus(row.status)) continue;
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
  canWrite: boolean;
}): string[] {
  const notes: string[] = [];
  const drafts = Math.max(0, input.savedCount - input.approvedCount);

  if (input.approvedCount === 0) {
    notes.push(
      input.canWrite
        ? `Uploading a spreadsheet saves the people for ${input.bankName}. It does not save notice wording. Write a template and mark it Approved. Approved wording can be selected for every bank.`
        : `${input.bankName} has no Approved template yet. Notice wording is saved by the firm. A spreadsheet upload does not add a template.`,
    );
    if (input.canWrite && drafts > 0) {
      notes.push(
        drafts === 1
          ? `${input.bankName} has 1 saved draft. Mark it Approved to select it for a send.`
          : `${input.bankName} has ${drafts} saved drafts. Mark one Approved to select it for a send.`,
      );
    }
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
