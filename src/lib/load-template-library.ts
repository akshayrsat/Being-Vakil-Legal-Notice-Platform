// Loads the working bank's saved templates, then the Approved ones in name order.
// Other banks are counted only for an Admin, so a viewer never sees another client's wording.

import { requiredBankId } from "./bank-data";
import { prisma } from "./db";
import {
  approvedTemplatesForBank,
  otherBankApprovedSummary,
  type OtherBankApproved,
} from "./template-library";

export async function loadTemplateLibrary(bankId: string, includeOtherBanks: boolean) {
  const templates = await prisma.noticeTemplate.findMany({
    where: { bankId: requiredBankId(bankId) },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  const approved = approvedTemplatesForBank(templates, bankId);
  let elsewhere: OtherBankApproved[] = [];

  if (includeOtherBanks) {
    const [rows, banks] = await Promise.all([
      prisma.noticeTemplate.findMany({
        where: { bankId: { not: bankId } },
        select: { bankId: true, status: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.bank.findMany({
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
      }),
    ]);
    elsewhere = otherBankApprovedSummary(rows, banks, bankId);
  }

  return { templates, approved, elsewhere };
}
