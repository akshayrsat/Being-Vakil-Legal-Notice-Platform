// Loads the firm’s approved MSG91 templates. Drafts and templates written in this
// app are not listed. Spreadsheets and people are not loaded.

import { requiredBankId } from "./bank-data";
import { prisma } from "./db";
import { firmLibraryTemplateWhere } from "./demo-templates";
import { approvedTemplatesForBank, type OtherBankApproved } from "./template-library";

const bankLabel = { select: { name: true, code: true } } as const;

export async function loadTemplateLibrary(bankId: string, _includeOtherBanks = false) {
  const id = requiredBankId(bankId);
  void _includeOtherBanks;
  const templates = await prisma.noticeTemplate.findMany({
    where: firmLibraryTemplateWhere(),
    orderBy: [{ name: "asc" }, { id: "asc" }],
    include: { bank: bankLabel },
  });
  const approved = approvedTemplatesForBank(templates, id);
  const elsewhere: OtherBankApproved[] = [];
  return { templates, approved, elsewhere };
}
