// Contact hours for recovery messages. 09:00–18:30 IST sits inside the 08:00–19:00 rule.
// Anything outside the window stays queued until the next opening.

import type { ChannelPlan } from "./odr-plan";

export const DEFAULT_SEND_WINDOW_START = "09:00";
export const DEFAULT_SEND_WINDOW_END = "18:30";
export const SEND_WINDOW_WAIT = "Waiting for the send window";

export type SendWindow = { start: string; end: string };

export function parseSendClock(value: string, fallback: string): string | null {
  const text = value.trim();
  const match = /^(\d{2}):(\d{2})$/.exec(text);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  if (text === fallback) return text;
  return text;
}

export function validSendWindow(start: string, end: string): boolean {
  return clockMinutes(start) < clockMinutes(end);
}

export function sendWindowOpen(now: Date, window: SendWindow): boolean {
  const minutes = istMinutes(now);
  return minutes >= clockMinutes(window.start) && minutes <= clockMinutes(window.end);
}

export function windowHold(
  now: Date,
  window: SendWindow,
): { hold: false } | { hold: true; notBefore: Date; detail: string } {
  if (sendWindowOpen(now, window)) return { hold: false };
  return {
    hold: true,
    notBefore: nextSendWindowStart(now, window),
    detail: `${SEND_WINDOW_WAIT} (${window.start}–${window.end} IST).`,
  };
}

export function dayHold(
  now: Date,
  window: SendWindow,
  usedToday: number,
  maxPerDay: number,
): { hold: false } | { hold: true; notBefore: Date; detail: string } {
  if (usedToday < maxPerDay) return { hold: false };
  return {
    hold: true,
    notBefore: nextDayWindowStart(now, window),
    detail: `Waiting until the next day. At most ${maxPerDay} message${maxPerDay === 1 ? "" : "s"} per customer per day, across every channel.`,
  };
}

export function nextSendWindowStart(now: Date, window: SendWindow): Date {
  const minutes = istMinutes(now);
  const start = clockMinutes(window.start);
  const day = minutes < start ? istDayKey(now) : addDay(istDayKey(now));
  return istDateTime(day, window.start);
}

export function nextDayWindowStart(now: Date, window: SendWindow): Date {
  return istDateTime(addDay(istDayKey(now)), window.start);
}

export function istDayBounds(now: Date): { start: Date; end: Date } {
  const day = istDayKey(now);
  return { start: istDateTime(day, "00:00"), end: istDateTime(addDay(day), "00:00") };
}

export function canQueueReminder(existing: number, maxReminders: number): boolean {
  return existing < maxReminders;
}

const REMINDER_ORDER = ["EMAIL", "SMS", "WHATSAPP"] as const;

export function pickReminderChannel(plans: ChannelPlan[]): ChannelPlan | null {
  for (const channel of REMINDER_ORDER) {
    const plan = plans.find((item) => item.channel === channel && item.status === "QUEUED");
    if (plan) return plan;
  }
  return null;
}

function clockMinutes(clock: string): number {
  const [hour, minute] = clock.split(":").map(Number);
  return hour * 60 + minute;
}

function istMinutes(now: Date): number {
  const parts = istParts(now);
  return Number(parts.hour) * 60 + Number(parts.minute);
}

export function istDayKey(now: Date): string {
  const parts = istParts(now);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function istParts(now: Date): { year: string; month: string; day: string; hour: string; minute: string } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((part) => [part.type, part.value]));
  return {
    year: parts.year ?? "1970",
    month: parts.month ?? "01",
    day: parts.day ?? "01",
    hour: parts.hour ?? "00",
    minute: parts.minute ?? "00",
  };
}

function addDay(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + 1);
  return utc.toISOString().slice(0, 10);
}

function istDateTime(date: string, clock: string): Date {
  return new Date(`${date}T${clock}:00.000+05:30`);
}
