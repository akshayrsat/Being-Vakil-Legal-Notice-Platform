// Existing hearings that already occupy an arbitrator. A panel member is busy too.

import type { PrismaClient } from "@prisma/client";
import { prisma } from "./db";
import { joinNames, parsePanel, type PanelMember } from "./odr-panel";
import { planSeats, rulesFromSchedule, type BusyInterval, type ScheduleInput, type SlotCustomer } from "./odr-slots";

export async function busyByNeutral(
  ids: string[],
  from: Date,
  db: PrismaClient = prisma,
): Promise<Map<string, BusyInterval[]>> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  const map = new Map<string, BusyInterval[]>(unique.map((id) => [id, []]));
  if (unique.length === 0) return map;
  const rows = await db.odrHearing.findMany({
    where: {
      scheduledAt: {
        gte: new Date(from.getTime() - 24 * 60 * 60 * 1000),
        lt: new Date(from.getTime() + 400 * 24 * 60 * 60 * 1000),
      },
    },
    select: {
      scheduledAt: true,
      durationMinutes: true,
      case: { select: { neutralId: true, panelJson: true } },
    },
  });
  for (const row of rows) {
    const onCase = new Set<string>();
    if (row.case.neutralId) onCase.add(row.case.neutralId);
    for (const member of parsePanel(row.case.panelJson)) {
      if (member.id) onCase.add(member.id);
    }
    const interval = {
      start: row.scheduledAt,
      end: new Date(row.scheduledAt.getTime() + row.durationMinutes * 60 * 1000),
    };
    for (const id of onCase) map.get(id)?.push(interval);
  }
  return map;
}

export type BatchSchedule = {
  hearingAt: Date;
  durationMinutes: number;
  windowStart: string;
  windowEnd: string;
  gapMinutes: number;
  skipSundays: boolean;
  holidays: string;
  breakStart: string;
  breakEnd: string;
  arbitratorMode: string;
  neutralIds: string;
  neutralId: string;
};

export type PlannedSeatView = {
  start: Date;
  end: Date;
  panel: PanelMember[];
  primary: PanelMember;
  name: string;
  memberIndex: number;
};

export function scheduleFromBatch(batch: BatchSchedule): ScheduleInput {
  return {
    start: batch.hearingAt,
    durationMinutes: batch.durationMinutes,
    windowStart: batch.windowStart || "10:00",
    windowEnd: batch.windowEnd || "18:00",
    gapMinutes: Number.isInteger(batch.gapMinutes) ? batch.gapMinutes : 15,
    skipSundays: batch.skipSundays,
    holidays: storedStrings(batch.holidays),
    breakStart: batch.breakStart || "13:30",
    breakEnd: batch.breakEnd || "14:30",
  };
}

export function storedNeutralIds(batch: { neutralIds: string; neutralId: string }): string[] {
  const ids = storedStrings(batch.neutralIds);
  if (ids.length > 0) return ids;
  return batch.neutralId ? [batch.neutralId] : [];
}

export async function planBatchHearings(
  batch: BatchSchedule,
  customers: SlotCustomer[],
  db: PrismaClient = prisma,
): Promise<
  | { ok: true; summary: string; days: number; members: PanelMember[]; mode: "SPLIT" | "PANEL"; seatFor: (key: string) => PlannedSeatView }
  | { ok: false; error: string }
> {
  const ids = storedNeutralIds(batch);
  const found = await db.odrNeutral.findMany({ where: { id: { in: ids } } });
  const members: PanelMember[] = ids.flatMap((id) => {
    const neutral = found.find((item) => item.id === id);
    if (!neutral) return [];
    return [{ id: neutral.id, name: neutral.name, qualification: neutral.qualification, enrolment: neutral.enrolmentNo }];
  });
  if (members.length !== ids.length || members.length < 1) {
    return { ok: false, error: "The arbitrator or mediator on this sheet is no longer on the list." };
  }
  const rules = rulesFromSchedule(scheduleFromBatch(batch));
  if (!rules) return { ok: false, error: "The hearing window on this sheet could not be read." };
  const mode = batch.arbitratorMode === "PANEL" ? "PANEL" : "SPLIT";
  const busy = await busyByNeutral(members.map((member) => member.id), rules.start, db);
  const planned = planSeats(customers, mode, rules, members.map((member) => busy.get(member.id) ?? []));
  if (!planned.ok) return planned;
  const byKey = new Map(planned.seats.map((seat) => [seat.key, seat]));
  return {
    ok: true,
    summary: planned.summary,
    days: planned.days,
    members,
    mode,
    seatFor(key: string): PlannedSeatView {
      const seat = byKey.get(key);
      const panel = !seat || seat.memberIndex < 0 ? members : [members[seat.memberIndex] ?? members[0]!];
      const primary = panel[0] ?? { id: "", name: "", qualification: "", enrolment: "" };
      return {
        start: seat?.start ?? rules.start,
        end: seat?.end ?? rules.start,
        panel,
        primary,
        name: mode === "PANEL" ? joinNames(panel.map((member) => member.name)) : primary.name,
        memberIndex: seat?.memberIndex ?? 0,
      };
    },
  };
}

function storedStrings(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string" && item.trim() !== "");
  } catch {
    return [];
  }
}
