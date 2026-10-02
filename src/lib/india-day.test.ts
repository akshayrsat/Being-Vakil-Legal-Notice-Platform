import assert from "node:assert/strict";
import test from "node:test";
import { csvCell, indiaDayRange } from "./india-day";

test("a report day is midnight to end of day in India", () => {
  const range = indiaDayRange("2026-10-02", "2026-10-02");
  assert.equal(range?.gte?.toISOString(), "2026-10-01T18:30:00.000Z");
  assert.equal(range?.lte?.toISOString(), "2026-10-02T18:29:59.999Z");
});

test("csv cells that look like formulas are escaped", () => {
  assert.equal(csvCell("=cmd"), "'=cmd");
  assert.equal(csvCell("Meera"), "Meera");
  assert.match(csvCell('=HYPERLINK("http://evil")'), /^"'=/);
});
