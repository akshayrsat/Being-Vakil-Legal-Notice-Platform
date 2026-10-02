// Which bank a status report is allowed to use.
// A Bank Viewer cannot switch this, even if the address names another bank.

import type { SignedInUser } from "./auth";
import type { BankSnapshot } from "./banks";
import { toBankSnapshot } from "./banks";
import { prisma } from "./db";
import { ROLE_ADMIN } from "./roles";

export function canReadBank(user: SignedInUser, bankId: string): boolean {
  if (user.role === ROLE_ADMIN) return true;
  return user.bank?.id === bankId;
}

export async function resolveReportBank(
  user: SignedInUser,
  requestedBankId: string,
): Promise<BankSnapshot | null> {
  if (user.role !== ROLE_ADMIN) {
    return user.bank;
  }

  const wanted = requestedBankId.trim();
  if (wanted) {
    const bank = await prisma.bank.findUnique({ where: { id: wanted } });
    return toBankSnapshot(bank);
  }
  return user.bank;
}
