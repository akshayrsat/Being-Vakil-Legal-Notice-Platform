import assert from "node:assert/strict";
import test from "node:test";
import {
  readReportFilters,
  reportCampaignWhere,
  reportFileId,
  reportFileLabel,
  reportFiltersApplied,
  reportFiltersToSearch,
} from "./desk-reports";

test("a download waits until a channel or a date is applied", () => {
  assert.equal(reportFiltersApplied({ channel: "", from: "", to: "" }), false);
  assert.equal(reportFiltersApplied(readReportFilters(new URLSearchParams("bank=bank-a"))), false);
  assert.equal(reportFiltersApplied(readReportFilters(new URLSearchParams("channel="))), false);
  assert.equal(reportFiltersApplied(readReportFilters(new URLSearchParams("channel=PIGEON&from=not-a-date"))), false);

  assert.equal(reportFiltersApplied(readReportFilters(new URLSearchParams("channel=sms"))), true);
  assert.equal(reportFiltersApplied(readReportFilters(new URLSearchParams("channel=SPEED_POST"))), true);
  assert.equal(reportFiltersApplied(readReportFilters(new URLSearchParams("from=2026-10-01"))), true);
  assert.equal(reportFiltersApplied(readReportFilters(new URLSearchParams("to=2026-10-03"))), true);
  assert.equal(reportFiltersApplied(readReportFilters(new URLSearchParams("file=cmusaim530000js1rxftik03r"))), true);
  assert.equal(reportFileId("../other-bank"), "");
  assert.equal(reportFileId("file with spaces"), "");
});

test("the download address keeps the filter from Apply", () => {
  const filters = readReportFilters(new URLSearchParams("channel=email&from=2026-10-01&to=2026-10-02"));
  assert.equal(reportFiltersApplied(filters), true);
  const search = new URLSearchParams(reportFiltersToSearch(filters, "bank-a"));
  assert.equal(search.get("bank"), "bank-a");
  assert.equal(search.get("channel"), "EMAIL");
  assert.equal(search.get("from"), "2026-10-01");
  assert.equal(search.get("to"), "2026-10-02");

  const datesOnly = readReportFilters(new URLSearchParams("from=2026-10-01"));
  const dates = new URLSearchParams(reportFiltersToSearch(datesOnly, "bank-a"));
  assert.equal(dates.get("channel"), null);
  assert.equal(dates.get("from"), "2026-10-01");
  assert.equal(dates.get("to"), null);

  const fileOnly = readReportFilters(
    new URLSearchParams("file=cmusaim530000js1rxftik03r&channel=sms&from=2026-10-01"),
  );
  const filed = new URLSearchParams(reportFiltersToSearch(fileOnly, "bank-a"));
  assert.equal(filed.get("file"), "cmusaim530000js1rxftik03r");
  assert.equal(filed.get("channel"), "SMS");
  assert.equal(filed.get("from"), "2026-10-01");
  assert.equal(filed.get("bank"), "bank-a");
});

test("a file filter stays on this bank, with the channel dates", () => {
  const where = reportCampaignWhere(
    "bank-a",
    { file: "cmusaim530000js1rxftik03r", from: "2026-10-01", to: "2026-10-02" },
    true,
  );
  assert.equal(where.bankId, "bank-a");
  assert.deepEqual(where.batch, { bankId: "bank-a", id: "cmusaim530000js1rxftik03r" });
  assert.equal(JSON.stringify(where).includes("bank-b"), false);
  assert.equal(reportFileLabel("people.xlsx", new Date("2026-10-01T18:30:00.000Z"), false), "people.xlsx");
  assert.match(reportFileLabel("people.xlsx", new Date("2026-10-01T18:30:00.000Z"), true), /^people\.xlsx · /);
});
