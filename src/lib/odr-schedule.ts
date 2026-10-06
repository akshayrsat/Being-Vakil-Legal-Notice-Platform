// When a reminder is due, and when a no-show should be offered another date.

export function nowMs(): number {
  return Date.now();
}

export type ReminderRule = {
  dayOn: boolean;
  hourOn: boolean;
  daysBefore: number;
  hoursBefore: number;
};

export function dueReminderKeys(input: {
  now: Date;
  scheduledAt: Date;
  sent: string[];
  rule: ReminderRule;
}): string[] {
  if (input.now.getTime() >= input.scheduledAt.getTime()) return [];
  const due: string[] = [];
  const dayKey = `d${input.rule.daysBefore}`;
  const hourKey = `h${input.rule.hoursBefore}`;
  if (input.rule.dayOn && input.rule.daysBefore > 0) {
    const at = input.scheduledAt.getTime() - input.rule.daysBefore * 24 * 60 * 60 * 1000;
    if (input.now.getTime() >= at && !input.sent.includes(dayKey)) due.push(dayKey);
  }
  if (input.rule.hourOn && input.rule.hoursBefore > 0) {
    const at = input.scheduledAt.getTime() - input.rule.hoursBefore * 60 * 60 * 1000;
    if (input.now.getTime() >= at && !input.sent.includes(hourKey)) due.push(hourKey);
  }
  return due;
}

export function parseReminderKeys(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export function hearingHasEnded(scheduledAt: Date, durationMinutes: number, now: Date): boolean {
  return now.getTime() >= scheduledAt.getTime() + durationMinutes * 60 * 1000;
}

export function autoRescheduleAt(lastHearing: Date, days: number): Date | null {
  if (!Number.isInteger(days) || days < 1 || days > 60) return null;
  return new Date(lastHearing.getTime() + days * 24 * 60 * 60 * 1000);
}

export function needsNextHearing(input: {
  status: string;
  flaggedExParte: boolean;
  hasFutureHearing: boolean;
}): boolean {
  if (input.hasFutureHearing) return false;
  if (input.status === "SETTLED" || input.status === "AWARD_PASSED" || input.status === "CLOSED") return false;
  return input.status === "NO_SHOW" || input.flaggedExParte;
}
