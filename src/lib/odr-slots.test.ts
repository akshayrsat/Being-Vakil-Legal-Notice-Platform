import assert from "node:assert/strict";
import test from "node:test";
import { indiaDateKey } from "./odr-ref";
import { assignHearingSlots, planSeats, type BusyInterval, type HearingRules } from "./odr-slots";

function rules(overrides: Partial<HearingRules> = {}): HearingRules {
  return {
    start: ist("2026-10-05", "11:00"),
    windowStart: 10 * 60,
    windowEnd: 18 * 60,
    durationMinutes: 30,
    gapMinutes: 15,
    skipSundays: true,
    holidays: new Set<string>(),
    breakStart: 13 * 60 + 30,
    breakEnd: 14 * 60 + 30,
    ...overrides,
  };
}

function ist(date: string, time: string): Date {
  return new Date(`${date}T${time}:00.000+05:30`);
}

function clock(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

test("hearings step by length plus gap, skip lunch, and roll to the next morning", () => {
  const assigned = assignHearingSlots(8, rules());
  assert.equal(assigned.ok, true);
  if (!assigned.ok) return;
  const times = assigned.slots.map((slot) => `${indiaDateKey(slot.start)} ${clock(slot.start)}`);
  assert.deepEqual(times, [
    "2026-10-05 11:00",
    "2026-10-05 11:45",
    "2026-10-05 12:30",
    "2026-10-05 14:30",
    "2026-10-05 15:15",
    "2026-10-05 16:00",
    "2026-10-05 16:45",
    "2026-10-05 17:30",
  ]);
  const next = assignHearingSlots(9, rules());
  assert.equal(next.ok, true);
  if (!next.ok) return;
  assert.equal(indiaDateKey(next.slots[8]!.start), "2026-10-06");
  assert.equal(clock(next.slots[8]!.start), "10:00");
});

test("a hearing may end at 6:00 PM and the next one waits for the next working morning", () => {
  const assigned = assignHearingSlots(2, rules({
    start: ist("2026-10-05", "17:30"),
    breakStart: 13 * 60 + 30,
    breakEnd: 14 * 60 + 30,
  }));
  assert.equal(assigned.ok, true);
  if (!assigned.ok) return;
  assert.equal(clock(assigned.slots[0]!.start), "17:30");
  assert.equal(clock(assigned.slots[0]!.end), "18:00");
  assert.equal(indiaDateKey(assigned.slots[1]!.start), "2026-10-06");
  assert.equal(clock(assigned.slots[1]!.start), "10:00");

  const tooLate = assignHearingSlots(1, rules({ start: ist("2026-10-05", "17:45") }));
  assert.equal(tooLate.ok, false);
});

test("Sunday and a listed holiday are skipped, and the next day starts at the window", () => {
  const assigned = assignHearingSlots(2, rules({
    start: ist("2026-10-10", "17:30"),
    holidays: new Set(["2026-10-12"]),
  }));
  assert.equal(assigned.ok, true);
  if (!assigned.ok) return;
  assert.equal(indiaDateKey(assigned.slots[0]!.start), "2026-10-10");
  assert.equal(indiaDateKey(assigned.slots[1]!.start), "2026-10-13");
  assert.equal(clock(assigned.slots[1]!.start), "10:00");
  assert.equal(isSundayKey("2026-10-11"), true);

  const sunday = assignHearingSlots(1, rules({ start: ist("2026-10-11", "11:00") }));
  assert.equal(sunday.ok, false);
});

test("a slot already used by this arbitrator is skipped", () => {
  const busy: BusyInterval[] = [{ start: ist("2026-10-05", "11:00"), end: ist("2026-10-05", "11:30") }];
  const assigned = assignHearingSlots(3, rules(), busy);
  assert.equal(assigned.ok, true);
  if (!assigned.ok) return;
  assert.deepEqual(assigned.slots.map((slot) => clock(slot.start)), ["11:45", "12:30", "14:30"]);

  const middle: BusyInterval[] = [{ start: ist("2026-10-05", "11:45"), end: ist("2026-10-05", "12:15") }];
  const around = assignHearingSlots(3, rules(), middle);
  assert.equal(around.ok, true);
  if (!around.ok) return;
  assert.deepEqual(around.slots.map((slot) => clock(slot.start)), ["11:00", "12:30", "14:30"]);
});

test("a slot that would run into lunch starts at the end of the break", () => {
  const assigned = assignHearingSlots(3, rules({ start: ist("2026-10-05", "13:00") }));
  assert.equal(assigned.ok, true);
  if (!assigned.ok) return;
  assert.deepEqual(assigned.slots.map((slot) => clock(slot.start)), ["13:00", "14:30", "15:15"]);
  for (const slot of assigned.slots) {
    const start = clock(slot.start);
    const end = clock(slot.end);
    const overlapsLunch = start < "14:30" && end > "13:30";
    assert.equal(overlapsLunch, false);
  }
});

test("one hundred customers stay inside the window, off Sunday, and off lunch", () => {
  const assigned = assignHearingSlots(100, rules({ start: ist("2026-10-05", "10:00") }));
  assert.equal(assigned.ok, true);
  if (!assigned.ok) return;
  assert.equal(assigned.slots.length, 100);
  const seen = new Set<number>();
  for (const slot of assigned.slots) {
    seen.add(slot.start.getTime());
    assert.equal(slot.end.getTime() - slot.start.getTime(), 30 * 60 * 1000);
    assert.ok(clock(slot.end) <= "18:00");
    assert.equal(isSundayKey(indiaDateKey(slot.start)), false);
    const start = clock(slot.start);
    const end = clock(slot.end);
    assert.equal(start < "14:30" && end > "13:30", false);
  }
  assert.equal(seen.size, 100);
  assert.equal(indiaDateKey(assigned.slots[99]!.start), "2026-10-15");
  assert.equal(clock(assigned.slots[99]!.start), "17:30");
});

test("split mode gives each arbitrator a parallel track, and a panel shares one track", () => {
  const customers = ["A", "B", "C", "D", "E"].map((label) => ({ key: label, label }));
  const busy: BusyInterval[][] = [
    [{ start: ist("2026-10-05", "11:00"), end: ist("2026-10-05", "11:30") }],
    [],
  ];
  const split = planSeats(customers, "SPLIT", rules(), busy);
  assert.equal(split.ok, true);
  if (!split.ok) return;
  assert.equal(split.seats[0]?.memberIndex, 0);
  assert.equal(clock(split.seats[0]!.start), "11:45");
  assert.equal(split.seats[1]?.memberIndex, 1);
  assert.equal(clock(split.seats[1]!.start), "11:00");
  assert.equal(split.seats[2]?.memberIndex, 0);
  assert.equal(clock(split.seats[2]!.start), "12:30");
  assert.equal(split.seats[4]?.memberIndex, 0);
  assert.match(split.summary, /^5 customers over 1 day, last hearing on /);

  const panel = planSeats(customers.slice(0, 3), "PANEL", rules(), busy);
  assert.equal(panel.ok, true);
  if (!panel.ok) return;
  assert.deepEqual(panel.seats.map((seat) => clock(seat.start)), ["11:45", "12:30", "14:30"]);
  assert.ok(panel.seats.every((seat) => seat.memberIndex === -1));
});

function isSundayKey(date: string): boolean {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1)).getUTCDay() === 0;
}
