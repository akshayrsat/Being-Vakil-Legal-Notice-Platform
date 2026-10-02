// Optional staff entry code. Unset means the practice sign-in page stays open.
// The code itself is never stored in the cookie and never written to the audit log.

import { createHmac, timingSafeEqual } from "node:crypto";

export const ENTRY_COOKIE = "noticedesk_entry";
const ENTRY_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export function entryCode(): string {
  // Dynamic lookup so a production build does not bake in an empty code.
  return (process.env["NOTICE_DESK_ENTRY_CODE"] ?? "").trim();
}

export function entryGateEnabled(): boolean {
  return entryCode().length > 0;
}

export function entryToken(): string {
  return createHmac("sha256", entryCode()).update("notice-desk-staff-entry").digest("hex");
}

export function entryCookieMatches(provided: string | undefined): boolean {
  if (!entryGateEnabled()) return true;
  const expected = entryToken();
  const left = Buffer.from(provided ?? "");
  const right = Buffer.from(expected);
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function submittedCodeMatches(provided: string): boolean {
  const expected = entryCode();
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (!expected || left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function entryCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ENTRY_MAX_AGE_SECONDS,
  };
}

export function isStaffPath(pathname: string): boolean {
  if (pathname === "/") return false;
  if (pathname === "/enter") return false;
  if (pathname === "/notice" || pathname.startsWith("/notice-") || pathname.startsWith("/n/")) return false;
  if (pathname.startsWith("/api/msg91/")) return false;
  if (pathname.startsWith("/branding/")) return false;
  return true;
}

export function safeNextPath(raw: string | null): string {
  const value = (raw ?? "").trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/login";
  if (value.startsWith("/enter")) return "/login";
  return value;
}
