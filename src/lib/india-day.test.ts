import assert from "node:assert/strict";
import test from "node:test";
import { csvCell, formatIndiaDateTime, indiaDayRange } from "./india-day";

test("a report day is midnight to end of day in India", () => {
  const range = indiaDayRange("2026-10-02", "2026-10-02");
  assert.equal(range?.gte?.toISOString(), "2026-10-01T18:30:00.000Z");
  assert.equal(range?.lte?.toISOString(), "2026-10-02T18:29:59.999Z");
});

test("an upload instant is shown in India, not as UTC", () => {
  // 16:57 UTC is 10:27 pm in Asia/Kolkata. A UTC server must not print 4:57 pm.
  const label = formatIndiaDateTime(new Date("2026-10-02T16:57:00.000Z"));
  assert.match(label, /2 Oct 2026/);
  assert.match(label, /10:27\s*pm/i);
  assert.doesNotMatch(label, /4:57/);
});

test("csv cells that look like formulas are escaped", () => {
  assert.equal(csvCell("=cmd"), "'=cmd");
  assert.equal(csvCell("Meera"), "Meera");
  assert.match(csvCell('=HYPERLINK("http://evil")'), /^"'=/);
});
