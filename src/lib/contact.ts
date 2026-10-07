// Mobile and email checks for a spreadsheet row.
// An empty value is allowed. A value that is present must be usable.

export function indianMobileDigits(raw: string): string | null {
  const compact = raw.trim().replace(/[\s-]/g, "");
  const digits = compact.replace(/\D/g, "");
  let national = digits;
  if (digits.length === 12 && digits.startsWith("91")) national = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) national = digits.slice(1);
  else if (digits.length === 13 && digits.startsWith("091")) national = digits.slice(3);
  if (!/^[6-9]\d{9}$/.test(national)) return null;
  return national;
}

export function validEmail(raw: string): boolean {
  const value = raw.trim();
  if (!value || value.length > 160 || /\s/.test(value)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function mobileProblem(value: string): string {
  if (!value.trim()) return "";
  if (!indianMobileDigits(value)) return "Mobile number needs 10 digits.";
  return "";
}

export function emailProblem(value: string): string {
  if (!value.trim()) return "";
  if (!validEmail(value)) return "Email address is not valid.";
  return "";
}

export function contactProblems(mobile: string, email: string): string[] {
  return [mobileProblem(mobile), emailProblem(email)].filter(Boolean);
}
