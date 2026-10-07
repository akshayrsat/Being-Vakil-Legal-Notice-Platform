// List screens and downloaded reports show a short form.
// The case page and the message that is actually sent keep the full value.

export function maskMobile(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!value.trim()) return "";
  if (digits.length < 4) return "••••";
  return `••••••${digits.slice(-4)}`;
}

export function maskEmail(value: string): string {
  const text = value.trim();
  const at = text.indexOf("@");
  if (at < 1) return text ? "••••" : "";
  return `${text.slice(0, 1)}•••${text.slice(at)}`;
}

export function maskContact(mobile: string, email: string): string {
  if (mobile.trim()) return maskMobile(mobile);
  if (email.trim()) return maskEmail(email);
  return "—";
}
