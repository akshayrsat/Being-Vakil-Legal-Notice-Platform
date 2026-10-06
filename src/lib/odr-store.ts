// Reads the ODR switch and the owner settings. Notice live send is a different row.

import type { PrismaClient } from "@prisma/client";
import { prisma } from "./db";
import { ODR_LIVE_SEND_SETTING_ID, effectiveOdrLiveSend } from "./odr-live";
import { ODR_SETTINGS_ID, parseTemplateMap, type OdrTemplateMap } from "./odr-templates";
import { DEFAULT_SEND_WINDOW_END, DEFAULT_SEND_WINDOW_START, parseSendClock, validSendWindow } from "./send-window";

export type OdrRules = {
  templates: OdrTemplateMap;
  reminderDaysBefore: number;
  reminderHoursBefore: number;
  reminderDayOn: boolean;
  reminderHourOn: boolean;
  maxNoShow: number;
  autoRescheduleDays: number;
  sendWindowStart: string;
  sendWindowEnd: string;
  maxRemindersPerHearing: number;
  maxMessagesPerDay: number;
  liveStored: boolean;
  live: boolean;
};

const DEFAULT_RULES: Omit<OdrRules, "templates" | "live" | "liveStored"> = {
  reminderDaysBefore: 1,
  reminderHoursBefore: 1,
  reminderDayOn: true,
  reminderHourOn: true,
  maxNoShow: 3,
  autoRescheduleDays: 0,
  sendWindowStart: DEFAULT_SEND_WINDOW_START,
  sendWindowEnd: DEFAULT_SEND_WINDOW_END,
  maxRemindersPerHearing: 1,
  maxMessagesPerDay: 1,
};

export async function readOdrRules(db: PrismaClient = prisma): Promise<OdrRules> {
  const [liveRow, settings] = await Promise.all([
    db.odrLiveSendSetting.findUnique({ where: { id: ODR_LIVE_SEND_SETTING_ID } }),
    db.odrSettings.findUnique({ where: { id: ODR_SETTINGS_ID } }),
  ]);
  const liveStored = liveRow?.enabled === true;
  return {
    templates: parseTemplateMap(settings?.templatesJson),
    reminderDaysBefore: clamp(settings?.reminderDaysBefore, 1, 14, DEFAULT_RULES.reminderDaysBefore),
    reminderHoursBefore: clamp(settings?.reminderHoursBefore, 1, 48, DEFAULT_RULES.reminderHoursBefore),
    reminderDayOn: settings?.reminderDayOn ?? DEFAULT_RULES.reminderDayOn,
    reminderHourOn: settings?.reminderHourOn ?? DEFAULT_RULES.reminderHourOn,
    maxNoShow: clamp(settings?.maxNoShow, 1, 10, DEFAULT_RULES.maxNoShow),
    autoRescheduleDays: clamp(settings?.autoRescheduleDays, 0, 60, DEFAULT_RULES.autoRescheduleDays),
    sendWindowStart: clockOr(settings?.sendWindowStart, DEFAULT_RULES.sendWindowStart),
    sendWindowEnd: clockOr(settings?.sendWindowEnd, DEFAULT_RULES.sendWindowEnd),
    maxRemindersPerHearing: clamp(settings?.maxRemindersPerHearing, 1, 5, DEFAULT_RULES.maxRemindersPerHearing),
    maxMessagesPerDay: clamp(settings?.maxMessagesPerDay, 1, 5, DEFAULT_RULES.maxMessagesPerDay),
    liveStored,
    live: effectiveOdrLiveSend(liveRow?.enabled ?? null),
  };
}

function clockOr(value: string | null | undefined, fallback: string): string {
  const clock = parseSendClock(value ?? "", fallback);
  if (!clock) return fallback;
  return clock;
}

export function sendWindowFromRules(rules: Pick<OdrRules, "sendWindowStart" | "sendWindowEnd">): { start: string; end: string } {
  const start = clockOr(rules.sendWindowStart, DEFAULT_RULES.sendWindowStart);
  const end = clockOr(rules.sendWindowEnd, DEFAULT_RULES.sendWindowEnd);
  if (!validSendWindow(start, end)) return { start: DEFAULT_RULES.sendWindowStart, end: DEFAULT_RULES.sendWindowEnd };
  return { start, end };
}

function clamp(value: number | null | undefined, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isInteger(value)) return fallback;
  if (value < min || value > max) return fallback;
  return value;
}
