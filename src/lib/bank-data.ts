// Staff lists of one bank's own rows.
// Prisma drops a filter whose value is undefined, and that would list every bank.
// A missing id is therefore a value that matches no row.

export const NO_BANK = "\u0000no-bank";

export function requiredBankId(bankId: string | null | undefined): string {
  const id = (bankId ?? "").trim();
  return id || NO_BANK;
}

export function uploadBatchWhere(bankId: string | null | undefined): { bankId: string } {
  return { bankId: requiredBankId(bankId) };
}

export function recipientRowWhere(
  bankId: string | null | undefined,
  batchId?: string,
): { bankId: string; batchId?: string } {
  const where: { bankId: string; batchId?: string } = { bankId: requiredBankId(bankId) };
  const batch = (batchId ?? "").trim();
  if (batch) where.batchId = batch;
  return where;
}

export function campaignWhere(
  bankId: string | null | undefined,
  id?: string,
): { bankId: string; id?: string } {
  const where: { bankId: string; id?: string } = { bankId: requiredBankId(bankId) };
  const campaignId = (id ?? "").trim();
  if (campaignId) where.id = campaignId;
  return where;
}

export function onlyThisBank<T extends { bankId: string }>(
  rows: T[],
  bankId: string | null | undefined,
): T[] {
  const id = requiredBankId(bankId);
  return rows.filter((row) => row.bankId === id);
}
