// Loads Approved wording from every bank, plus drafts written for the working bank.
// Other banks' drafts are not loaded. Spreadsheets and people are not loaded.

import { requiredBankId } from "./bank-data";
import { prisma } from "./db";
import { TEMPLATE_APPROVED } from "./templates";
import {
  approvedTemplatesForBank,
  otherBankApprovedSummary,
  type OtherBankApproved,
} from "./template-library";

const bankLabel = { select: { name: true, code: true } } as const;

export async function loadTemplateLibrary(bankId: string, includeOtherBanks: boolean) {
  const id = requiredBankId(bankId);
  const [own, approvedElsewhere] = await Promise.all([
    prisma.noticeTemplate.findMany({
      where: { bankId: id },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      include: { bank: bankLabel },
    }),
    prisma.noticeTemplate.findMany({
      where: { status: TEMPLATE_APPROVED, NOT: { bankId: id } },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      include: { bank: bankLabel },
    }),
  ]);
  const templates = [...own, ...approvedElsewhere];
  const approved = approvedTemplatesForBank(templates, id);
  let elsewhere: OtherBankApproved[] = [];

  if (includeOtherBanks) {
    elsewhere = otherBankApprovedSummary(
      approvedElsewhere.map((row) => ({ bankId: row.bankId, status: row.status, name: row.name })),
      approvedElsewhere.map((row) => ({
        id: row.bankId,
        name: row.bank.name,
        code: row.bank.code,
      })),
      id,
    );
  }

  return { templates, approved, elsewhere };
}
