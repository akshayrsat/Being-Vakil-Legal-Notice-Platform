// Which bank a page or download is allowed to use.
// One bank at a time. Rows from bank A are never mixed into bank B.
//
// Bank Viewer: the bank on their login.
// Admin: the bank they switched to on Banks ("Use this bank"), stored as selectedBankId.
// A ?bank= address cannot open a different bank. Uploads, recipient rows, campaigns,
// tracking, bank-owned templates, Speed Post, loans, and reports all use this id.
// Switch banks on the Banks page first.
//
// Public notice links (/notice-<id>) stay unauthenticated on purpose. They show
// that one notice and no other customer's row. Staff lists do not use that path.

import type { SignedInUser } from "./auth";
import type { BankSnapshot } from "./banks";

export function scopedBankId(user: SignedInUser, explicitBankId?: string | null): string | null {
  const working = user.bank?.id?.trim() || null;
  if (!working) return null;
  const explicit = (explicitBankId ?? "").trim();
  // A link may repeat the working bank. Any other id stays on the working bank.
  if (explicit && explicit !== working) return working;
  return working;
}

export function canReadBank(user: SignedInUser, bankId: string, explicitBankId?: string | null): boolean {
  if (!bankId) return false;
  const scope = scopedBankId(user, explicitBankId);
  return Boolean(scope) && scope === bankId;
}

export function withBank(path: string, bankId: string): string {
  const splitAt = path.indexOf("?");
  const base = splitAt === -1 ? path : path.slice(0, splitAt);
  const params = new URLSearchParams(splitAt === -1 ? "" : path.slice(splitAt + 1));
  params.set("bank", bankId);
  const text = params.toString();
  return text ? `${base}?${text}` : base;
}

export async function resolveReportBank(
  user: SignedInUser,
  requestedBankId: string,
): Promise<BankSnapshot | null> {
  const working = user.bank;
  if (!working) return null;
  const wanted = requestedBankId.trim();
  if (wanted && wanted !== working.id) return working;
  return working;
}
