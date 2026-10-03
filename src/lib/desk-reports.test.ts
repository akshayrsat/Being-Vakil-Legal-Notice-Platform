import assert from "node:assert/strict";
import test from "node:test";
import { readReportFilters, reportFiltersApplied, reportFiltersToSearch } from "./desk-reports";

test("a download waits until a channel or a date is applied", () => {
  assert.equal(reportFiltersApplied({ channel: "", from: "", to: "" }), false);
  assert.equal(reportFiltersApplied(readReportFilters(new URLSearchParams("bank=bank-a"))), false);
  assert.equal(reportFiltersApplied(readReportFilters(new URLSearchParams("channel="))), false);
  assert.equal(reportFiltersApplied(readReportFilters(new URLSearchParams("channel=PIGEON&from=not-a-date"))), false);

  assert.equal(reportFiltersApplied(readReportFilters(new URLSearchParams("channel=sms"))), true);
  assert.equal(reportFiltersApplied(readReportFilters(new URLSearchParams("channel=SPEED_POST"))), true);
  assert.equal(reportFiltersApplied(readReportFilters(new URLSearchParams("from=2026-10-01"))), true);
  assert.equal(reportFiltersApplied(readReportFilters(new URLSearchParams("to=2026-10-03"))), true);
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
});
