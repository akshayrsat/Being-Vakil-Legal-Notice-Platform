// Rules for a bank's name and short code, shared by the add-bank form and the database.

export type BankSnapshot = {
  id: string;
  name: string;
  code: string;
  active: boolean;
};

export function toBankSnapshot(
  bank: { id: string; name: string; code: string; active: boolean } | null,
): BankSnapshot | null {
  if (!bank) return null;
  return {
    id: bank.id,
    name: bank.name,
    code: bank.code,
    active: bank.active,
  };
}

export function bankStatusLabel(active: boolean): string {
  return active ? "Active" : "Inactive";
}

export function normalizeBankName(input: string): string | null {
  const name = input.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) return null;
  return name;
}

export function normalizeBankCode(input: string): string | null {
  const code = input.trim().toUpperCase();
  if (!/^[A-Z0-9]{2,8}$/.test(code)) return null;
  return code;
}
