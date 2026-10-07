import assert from "node:assert/strict";
import test from "node:test";
import { closedCaseExpired, keepMappedColumns, redactCell, redactSheet, sheetExpired } from "./data-min";

test("a full Aadhaar or card number is not kept", () => {
  assert.equal(redactCell("2345 6789 0123"), "XXXX-XXXX-0123");
  assert.equal(redactCell("4111111111111111"), "XXXX XXXX XXXX 1111");
  assert.equal(redactCell("919876543210"), "XXXX-XXXX-3210");
  assert.equal(redactCell("919876543210", { phone: true }), "919876543210");
  assert.equal(redactCell("Ravi Shah"), "Ravi Shah");
  const sheet = redactSheet(["Aadhaar", "Name", "Mobile"], [["234567890123", "Ravi", "919876543210"]]);
  assert.equal(sheet.rows[0]?.[2], "919876543210");
  assert.equal(sheet.rows[0]?.[0], "XXXX-XXXX-0123");
});

test("only mapped columns are kept, and raw sheets expire after the retention", () => {
  const kept = keepMappedColumns(
    ["Name", "Aadhaar", "Mobile"],
    [["Ravi", "234567890123", "9876543210"]],
    ["Name", "Mobile"],
  );
  assert.deepEqual(kept.headers, ["Name", "Mobile"]);
  assert.deepEqual(kept.rows, [["Ravi", "9876543210"]]);
  const created = new Date("2026-09-01T00:00:00.000Z");
  const now = new Date("2026-10-06T00:00:00.000Z");
  assert.equal(sheetExpired(created, now, 30), true);
  assert.equal(sheetExpired(now, now, 30), false);
  assert.equal(closedCaseExpired(created, now, 0), false);
  assert.equal(closedCaseExpired(created, now, 30), true);
});
