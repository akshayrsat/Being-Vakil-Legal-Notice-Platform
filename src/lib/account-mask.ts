// Last 4 digits of a loan or card account. The rest is not printed in an email.

export function maskAccountLast4(account: string): string {
  const digits = account.replace(/\D/g, "");
  if (digits.length < 4) return "";
  return `XXXX${digits.slice(-4)}`;
}
