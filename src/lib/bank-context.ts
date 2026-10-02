// Which bank later work belongs to.
// Admin: the bank they chose on the Banks page (selectedBankId).
// Bank Viewer: the one bank on their login. Never another bank.
// Spreadsheets, notices, and messages added later must store this bank's id.

import type { SignedInUser } from "./auth";
import type { BankSnapshot } from "./banks";

export function workingBank(user: SignedInUser): BankSnapshot | null {
  return user.bank;
}
