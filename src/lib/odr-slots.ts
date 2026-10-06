// Hearing times for a batch of customers. Every time is India (Asia/Kolkata).
// Customer 1 starts at the chosen time. The next start is the previous start
// plus the hearing length plus the gap. A hearing must finish by the end of
// the daily window. Nothing may overlap the lunch break. A full day continues
// on the next working day at the window start.

import { formatHearingDate, formatHearingTime, indiaDateKey, indiaDateTime } from "./odr-ref";

export type BusyInterval = { start: Date; end: Date };

export type HearingRules = {
  start: Date;
  windowStart: number;
  windowEnd: number;
  durationMinutes: number;
  gapMinutes: number;
  skipSundays: boolean;
  holidays: ReadonlySet<string>;
  breakStart: number;
  breakEnd: number;
};

export type HearingSlot = { start: Date; end: Date };

export type SlotCustomer = { key: string; label: string };

export type PlannedSeat = SlotCustomer & {
  memberIndex: number;
  start: Date;
  end: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAYS = 370;

export function parseClock(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function clockText(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function parseHolidayList(raw: string): { dates: string[]; error: string } {
  const dates: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(/[\s,;]+/)) {
    const date = part.trim();
    if (!date) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !indiaDateTime(date, "12:00")) {
      return { dates: [], error: "Holiday dates must look like 2026-10-02, one per line." };
    }
    if (seen.has(date)) continue;
    seen.add(date);
    dates.push(date);
  }
  return { dates, error: "" };
}

export function assignHearingSlots(count: number, rules: HearingRules, busy: BusyInterval[] = []): { ok: true; slots: HearingSlot[] } | { ok: false; error: string } {
  if (!Number.isInteger(count) || count < 1) return { ok: false, error: "There is nobody to schedule." };
  if (!Number.isInteger(rules.durationMinutes) || rules.durationMinutes < 15 || rules.durationMinutes > 240) {
    return { ok: false, error: "Hearing length must be between 15 and 240 minutes." };
  }
  if (!Number.isInteger(rules.gapMinutes) || rules.gapMinutes < 0 || rules.gapMinutes > 180) {
    return { ok: false, error: "The gap between hearings must be between 0 and 180 minutes." };
  }
  if (rules.windowStart < 0 || rules.windowEnd > 24 * 60 || rules.windowEnd - rules.windowStart < rules.durationMinutes) {
    return { ok: false, error: "The daily window must be long enough for one hearing." };
  }
  if (rules.breakStart < 0 || rules.breakEnd > 24 * 60 || rules.breakEnd <= rules.breakStart) {
    return { ok: false, error: "The lunch break needs a start and a later end." };
  }

  const startParts = istParts(rules.start);
  if (!startParts) return { ok: false, error: "Enter the first hearing date and time." };
  if (!isWorkingDay(startParts.date, rules)) {
    return {
      ok: false,
      error: rules.skipSundays && isSunday(startParts.date)
        ? "That date is a Sunday. Choose another day, or turn off Skip Sundays."
        : "That date is a holiday. Choose another day, or remove it from the holiday list.",
    };
  }
  if (startParts.minutes < rules.windowStart) {
    return { ok: false, error: "The start time is before the daily window." };
  }
  if (startParts.minutes + rules.durationMinutes > rules.windowEnd) {
    return { ok: false, error: "The first hearing must end by the close of the daily window." };
  }

  const step = rules.durationMinutes + rules.gapMinutes;
  const slots: HearingSlot[] = [];
  let date = startParts.date;
  let minutes = startParts.minutes;
  let daysWalked = 0;
  let guard = 0;
  while (slots.length < count) {
    guard += 1;
    if (guard > count * 500 || daysWalked > MAX_DAYS) {
      return { ok: false, error: "There is not enough open hearing time in the next year." };
    }
    if (!isWorkingDay(date, rules)) {
      date = addDays(date, 1);
      minutes = rules.windowStart;
      daysWalked += 1;
      continue;
    }
    if (minutes < rules.windowStart) minutes = rules.windowStart;
    if (minutes + rules.durationMinutes > rules.windowEnd) {
      date = addDays(date, 1);
      minutes = rules.windowStart;
      daysWalked += 1;
      continue;
    }
    if (overlapsClock(minutes, minutes + rules.durationMinutes, rules.breakStart, rules.breakEnd)) {
      if (rules.breakEnd + rules.durationMinutes <= rules.windowEnd && rules.breakEnd >= rules.windowStart) {
        minutes = rules.breakEnd;
        continue;
      }
      date = addDays(date, 1);
      minutes = rules.windowStart;
      daysWalked += 1;
      continue;
    }
    const start = atIst(date, minutes);
    const end = new Date(start.getTime() + rules.durationMinutes * 60 * 1000);
    const taken = busy.some((item) => overlapsMs(start, end, item.start, item.end))
      || slots.some((item) => overlapsMs(start, end, item.start, item.end));
    if (taken) {
      minutes += step;
      continue;
    }
    slots.push({ start, end });
    minutes += step;
  }
  return { ok: true, slots };
}

export function planSeats(
  customers: SlotCustomer[],
  mode: "SPLIT" | "PANEL",
  rules: HearingRules,
  busyByMember: BusyInterval[][],
): { ok: true; seats: PlannedSeat[]; summary: string; days: number } | { ok: false; error: string } {
  if (customers.length === 0) return { ok: false, error: "No row has a customer name and an account number with at least 4 digits." };
  if (busyByMember.length < 1 || busyByMember.length > 3) {
    return { ok: false, error: "Choose one, two, or three arbitrators." };
  }
  if (mode === "PANEL") {
    const busy = busyByMember.flat();
    const assigned = assignHearingSlots(customers.length, rules, busy);
    if (!assigned.ok) return assigned;
    const seats = customers.map((customer, index) => ({
      ...customer,
      memberIndex: -1,
      start: assigned.slots[index]!.start,
      end: assigned.slots[index]!.end,
    }));
    return { ok: true, seats, ...summarizeSlots(seats.map((seat) => seat.start)) };
  }

  const buckets: SlotCustomer[][] = busyByMember.map(() => []);
  customers.forEach((customer, index) => {
    buckets[index % busyByMember.length]!.push(customer);
  });
  const placed = new Map<string, HearingSlot & { memberIndex: number }>();
  for (let member = 0; member < buckets.length; member += 1) {
    const group = buckets[member] ?? [];
    if (group.length === 0) continue;
    const assigned = assignHearingSlots(group.length, rules, busyByMember[member] ?? []);
    if (!assigned.ok) return assigned;
    group.forEach((customer, index) => {
      const slot = assigned.slots[index];
      if (!slot) return;
      placed.set(customer.key, { ...slot, memberIndex: member });
    });
  }
  const seats: PlannedSeat[] = [];
  for (const customer of customers) {
    const slot = placed.get(customer.key);
    if (!slot) return { ok: false, error: "A hearing time could not be placed." };
    seats.push({ ...customer, memberIndex: slot.memberIndex, start: slot.start, end: slot.end });
  }
  return { ok: true, seats, ...summarizeSlots(seats.map((seat) => seat.start)) };
}

export function summarizeSlots(starts: Date[]): { summary: string; days: number } {
  const days = new Set(starts.map((start) => indiaDateKey(start))).size;
  const last = starts.reduce((latest, start) => (start.getTime() > latest.getTime() ? start : latest));
  const customers = starts.length === 1 ? "1 customer" : `${starts.length} customers`;
  const dayLabel = days === 1 ? "1 day" : `${days} days`;
  return {
    days,
    summary: `${customers} over ${dayLabel}, last hearing on ${formatHearingDate(last)} ${formatHearingTime(last)}`,
  };
}

function overlapsClock(start: number, end: number, busyStart: number, busyEnd: number): boolean {
  return start < busyEnd && busyStart < end;
}

function overlapsMs(start: Date, end: Date, busyStart: Date, busyEnd: Date): boolean {
  return start.getTime() < busyEnd.getTime() && busyStart.getTime() < end.getTime();
}

function isWorkingDay(date: string, rules: HearingRules): boolean {
  if (rules.skipSundays && isSunday(date)) return false;
  return !rules.holidays.has(date);
}

function isSunday(date: string): boolean {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1)).getUTCDay() === 0;
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function atIst(date: string, minutes: number): Date {
  const value = indiaDateTime(date, clockText(minutes));
  if (!value) throw new Error("Hearing time could not be read.");
  return value;
}

function istParts(date: Date): { date: string; minutes: number } | null {
  if (Number.isNaN(date.getTime())) return null;
  const key = indiaDateKey(date);
  const clock = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  const minutes = parseClock(clock);
  if (minutes === null) return null;
  return { date: key, minutes };
}

export type ScheduleInput = {
  start: Date;
  durationMinutes: number;
  windowStart: string;
  windowEnd: string;
  gapMinutes: number;
  skipSundays: boolean;
  holidays: string[];
  breakStart: string;
  breakEnd: string;
};

export function readScheduleInput(formData: FormData): { ok: true; schedule: ScheduleInput } | { ok: false; error: string } {
  const start = indiaDateTime(String(formData.get("hearingDate") ?? ""), String(formData.get("hearingTime") ?? ""));
  if (!start) return { ok: false, error: "Enter the first hearing date and time." };
  const durationMinutes = Number(formData.get("duration") ?? "");
  if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 240) {
    return { ok: false, error: "Hearing length must be between 15 and 240 minutes." };
  }
  const gapMinutes = Number(formData.get("gapMinutes") ?? "");
  if (!Number.isInteger(gapMinutes) || gapMinutes < 0 || gapMinutes > 180) {
    return { ok: false, error: "The gap between hearings must be between 0 and 180 minutes." };
  }
  const windowStart = String(formData.get("windowStart") ?? "");
  const windowEnd = String(formData.get("windowEnd") ?? "");
  const breakStart = String(formData.get("breakStart") ?? "");
  const breakEnd = String(formData.get("breakEnd") ?? "");
  if (parseClock(windowStart) === null || parseClock(windowEnd) === null) {
    return { ok: false, error: "Enter the daily window as a start and an end." };
  }
  if (parseClock(breakStart) === null || parseClock(breakEnd) === null) {
    return { ok: false, error: "Enter the lunch break as a start and an end." };
  }
  const holidays = parseHolidayList(String(formData.get("holidays") ?? ""));
  if (holidays.error) return { ok: false, error: holidays.error };
  return {
    ok: true,
    schedule: {
      start,
      durationMinutes,
      windowStart,
      windowEnd,
      gapMinutes,
      skipSundays: formData.get("skipSundays") === "on",
      holidays: holidays.dates,
      breakStart,
      breakEnd,
    },
  };
}

export function rulesFromSchedule(schedule: ScheduleInput): HearingRules | null {
  const windowStart = parseClock(schedule.windowStart);
  const windowEnd = parseClock(schedule.windowEnd);
  const breakStart = parseClock(schedule.breakStart);
  const breakEnd = parseClock(schedule.breakEnd);
  if (windowStart === null || windowEnd === null || breakStart === null || breakEnd === null) return null;
  return {
    start: schedule.start,
    windowStart,
    windowEnd,
    durationMinutes: schedule.durationMinutes,
    gapMinutes: schedule.gapMinutes,
    skipSundays: schedule.skipSundays,
    holidays: new Set(schedule.holidays),
    breakStart,
    breakEnd,
  };
}

export function readArbitratorChoice(formData: FormData): { ok: true; mode: "SPLIT" | "PANEL"; ids: string[] } | { ok: false; error: string } {
  const count = Number(formData.get("arbitratorCount") ?? "1");
  if (count !== 1 && count !== 2 && count !== 3) return { ok: false, error: "Choose one, two, or three arbitrators." };
  const modeValue = String(formData.get("arbitratorMode") ?? "SPLIT");
  const mode = modeValue === "PANEL" ? "PANEL" : modeValue === "SPLIT" ? "SPLIT" : null;
  if (!mode) return { ok: false, error: "Choose split customers or a panel." };
  const ids = [0, 1, 2].slice(0, count).map((index) => String(formData.get(index === 0 ? "neutralId" : `neutralId${index + 1}`) ?? "").trim());
  if (ids.some((id) => !id)) return { ok: false, error: "Choose each arbitrator or mediator." };
  if (new Set(ids).size !== ids.length) return { ok: false, error: "Choose a different person for each place." };
  return { ok: true, mode, ids };
}

export { DAY_MS };
