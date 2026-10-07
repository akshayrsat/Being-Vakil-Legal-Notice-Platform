// The customer page cookie. The account check itself lives in odr-ref.

export const ODR_VERIFY_COOKIE = "odr_case_verify";
export const ODR_VERIFY_WINDOW_MS = 15 * 60 * 1000;
export const ODR_VERIFY_LIMIT = 8;
export const ODR_GRANT_HOURS = 12;

export function verifyRateKey(caseToken: string, ip: string): string {
  return `odr-verify:${caseToken.slice(0, 24)}:${ip.slice(0, 64)}`;
}

export function clientIp(forwardedFor: string | null): string {
  const parts = (forwardedFor ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const ip = parts[parts.length - 1] || "local";
  return ip.slice(0, 80);
}

export function clipAgent(userAgent: string | null): string {
  return (userAgent ?? "").trim().slice(0, 300);
}

export function safeDownloadName(name: string): string {
  const base = name.trim().replace(/[/\\]+/g, " ").replace(/[^\w.\- ()]+/g, "").slice(0, 120);
  return base || "document";
}

export function safePdfName(name: string): string {
  const base = name.trim().replace(/[/\\]+/g, " ").replace(/[^\w.\- ()]+/g, "").slice(0, 80);
  if (!base) return "document.pdf";
  return base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
}

export function isPdf(bytes: Uint8Array): boolean {
  if (bytes.length < 5) return false;
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}
