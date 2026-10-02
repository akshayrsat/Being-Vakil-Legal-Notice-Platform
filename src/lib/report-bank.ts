// Which bank a page or download is allowed to use.
// One bank at a time. Rows from bank A are never mixed into bank B.
//
// Bank Viewer: only the bank on their login. A ?bank= parameter is ignored.
// Admin: the bank they switched to on Banks ("Use this bank"), or one bank
// named by an explicit ?bank= filter. Guessing a campaign, consignment, or
// export id does not open another bank unless that filter or switch matches it.
//
// Public notice links (/notice-<id>) stay unauthenticated on purpose. They show
// that one notice and no other customer's row. Staff lists do not use that path.

import type { SignedInUser } from "./auth";
import type { BankSnapshot } from "./banks";
import { toBankSnapshot } from "./banks";
import { prisma } from "./db";
import { ROLE_ADMIN } from "./roles";

export function scopedBankId(user: SignedInUser, explicitBankId?: string | null): string | null {
  if (user.role !== ROLE_ADMIN) return user.bank?.id ?? null;
  const explicit = (explicitBankId ?? "").trim();
  if (explicit) return explicit;
  return user.bank?.id ?? null;
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
