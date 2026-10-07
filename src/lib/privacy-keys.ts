// Keys used to match a person. Empty values never match.

import { indianMobileDigits } from "./contact";

export const ACCESS_LOG_KEEP_DAYS = 365;

export type HoldKey = { accountKey: string; mobileKey: string; emailKey: string };

export function privacyMobileKey(value: string): string {
  return indianMobileDigits(value) ?? "";
}

export function privacyEmailKey(value: string): string {
  const text = value.trim().toLowerCase();
  if (!text.includes("@")) return "";
  return text.slice(0, 160);
}

export function privacyAccountKey(value: string): string {
  return value.trim().replace(/\s+/g, "").toUpperCase().slice(0, 80);
}

export function personMatchesHold(
  holds: HoldKey[],
  value: { account?: string; mobile?: string; email?: string },
): boolean {
  const account = privacyAccountKey(value.account ?? "");
  const mobile = privacyMobileKey(value.mobile ?? "");
  const email = privacyEmailKey(value.email ?? "");
  return holds.some((hold) => {
    if (hold.accountKey && account && hold.accountKey === account) return true;
    if (hold.mobileKey && mobile && hold.mobileKey === mobile) return true;
    if (hold.emailKey && email && hold.emailKey === email) return true;
    return false;
  });
}

export function retentionCutoff(now: Date, days: number): Date | null {
  if (!Number.isInteger(days) || days < 1) return null;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export function accessLogExpired(createdAt: Date, now: Date): boolean {
  return now.getTime() - createdAt.getTime() >= ACCESS_LOG_KEEP_DAYS * 24 * 60 * 60 * 1000;
}

export function parseRetentionDays(raw: string): number | null {
  const text = raw.trim();
  if (!/^\d+$/.test(text)) return null;
  const days = Number(text);
  if (days > 3650) return null;
  return days;
}

export function confirmWord(value: string, expected: "ERASE" | "CORRECT" | "HOLD"): boolean {
  return value.trim() === expected;
}

export function eraseAuditSummary(counts: Record<string, number>): string {
  const parts = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([kind, count]) => `${count} ${kind}`);
  const what = parts.length > 0 ? parts.join(", ") : "no rows";
  return `Erased personal data (${what}). The erased values were not stored in this log.`;
}

export function correctAuditSummary(kind: string): string {
  return `Corrected one field on a ${kind}. The old and new values were not stored in this log.`;
}

export type SearchNeedles = {
  text: string;
  mobile: string;
  email: string;
  accounts: string[];
  mobiles: string[];
};

export function searchNeedles(query: string): SearchNeedles {
  const text = query.trim().slice(0, 160);
  const email = privacyEmailKey(text);
  const mobile = privacyMobileKey(text);
  const account = privacyAccountKey(text);
  const accounts = [...new Set([text, text.toUpperCase(), text.toLowerCase(), account].filter((item) => item.length >= 4))];
  const mobiles = mobile ? [mobile, `91${mobile}`, `+91${mobile}`, `0${mobile}`] : [];
  return { text, mobile, email, accounts, mobiles };
}
