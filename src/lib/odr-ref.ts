// Reference numbers, hearing labels, and the India date of a hearing.

import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { INDIA_TIME_ZONE } from "./india-day";

const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function matterPrefix(matterType: string): string {
  return matterType === "MEDIATION" ? "MED" : "ARB";
}

export function generateRefNo(matterType: string, taken: Set<string>, year = new Date().getFullYear()): string {
  const prefix = matterPrefix(matterType);
  for (let attempt = 0; attempt < 40; attempt += 1) {
    let suffix = "";
    for (let index = 0; index < 6; index += 1) {
      suffix += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
    }
    const ref = `${prefix}-${year}-${suffix}`;
    if (!taken.has(ref)) {
      taken.add(ref);
      return ref;
    }
  }
  throw new Error("Could not generate a reference number.");
}

export function normalizeRefNo(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "").slice(0, 40);
}

export function hearingOrdinal(number: number): string {
  const n = Math.trunc(number);
  if (n <= 0) return "hearing";
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  if (n % 10 === 1) return `${n}st`;
  if (n % 10 === 2) return `${n}nd`;
  if (n % 10 === 3) return `${n}rd`;
  return `${n}th`;
}

export function hearingTitle(input: {
  bank: string;
  customer: string;
  refNo: string;
  number: number;
}): string {
  const bank = input.bank.trim() || "Bank";
  const customer = input.customer.trim() || "Customer";
  const ref = input.refNo.trim() || "Ref";
  return `${bank} vs ${customer} - Ref ${ref} - Hearing ${input.number}`.slice(0, 180);
}

export function indiaDateTime(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (!/^\d{2}:\d{2}$/.test(time)) return null;
  const value = new Date(`${date}T${time}:00.000+05:30`);
  if (Number.isNaN(value.getTime())) return null;
  return value;
}

export function formatHearingDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: INDIA_TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatHearingTime(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: INDIA_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function indiaDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function addIndiaDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function accountLast4(account: string): string {
  const digits = account.replace(/\D/g, "");
  if (digits.length < 4) return "";
  return digits.slice(-4);
}

export function last4Matches(account: string, attempt: string): boolean {
  const expected = accountLast4(account);
  const got = attempt.replace(/\D/g, "");
  if (expected.length !== 4 || got.length !== 4) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(got));
}

export function newPublicToken(): string {
  return randomBytes(32).toString("base64url");
}

export function newGrantToken(): string {
  return randomBytes(32).toString("base64url");
}

export function durationMinutes(value: string): number | null {
  const minutes = Number(value);
  if (!Number.isInteger(minutes) || minutes < 15 || minutes > 240) return null;
  return minutes;
}

export function googleCalendarUrl(input: {
  title: string;
  start: Date;
  end: Date;
  details: string;
  location: string;
}): string {
  const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title,
    dates: `${stamp(input.start)}/${stamp(input.end)}`,
    details: input.details.slice(0, 1500),
    location: input.location.slice(0, 300),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
