// Reads the ODR switch and the owner settings. Notice live send is a different row.

import type { PrismaClient } from "@prisma/client";
import { prisma } from "./db";
import { ODR_LIVE_SEND_SETTING_ID, effectiveOdrLiveSend } from "./odr-live";
import { ODR_SETTINGS_ID, parseTemplateMap, type OdrTemplateMap } from "./odr-templates";

export type OdrRules = {
  templates: OdrTemplateMap;
  reminderDaysBefore: number;
  reminderHoursBefore: number;
  reminderDayOn: boolean;
  reminderHourOn: boolean;
  maxNoShow: number;
  autoRescheduleDays: number;
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
    liveStored,
    live: effectiveOdrLiveSend(liveRow?.enabled ?? null),
  };
}

function clamp(value: number | null | undefined, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isInteger(value)) return fallback;
  if (value < min || value > max) return fallback;
  return value;
}
