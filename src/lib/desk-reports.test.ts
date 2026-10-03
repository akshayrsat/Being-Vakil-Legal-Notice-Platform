import assert from "node:assert/strict";
import test from "node:test";
import {
  channelShowsOpens,
  channelSummaryMetrics,
  readReportFilters,
  reportCampaignWhere,
  reportFileId,
  reportFileLabel,
  reportFiltersApplied,
  reportFiltersToSearch,
  reportSummaryCsv,
  type DeskReport,
} from "./desk-reports";

test("a download waits until a channel or a date is applied", () => {
  assert.equal(reportFiltersApplied({ file: "", channel: "", from: "", to: "" }), false);
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

const report: DeskReport = {
  channels: [
    {
      channel: "SMS",
      label: "SMS",
      attempted: 3,
      failed: 1,
      failureRate: "33%",
      delivered: 2,
      opened: null,
      unopened: null,
      skipped: 0,
      dryRun: 0,
    },
    {
      channel: "EMAIL",
      label: "Email",
      attempted: 2,
      failed: 0,
      failureRate: "0%",
      delivered: 1,
      opened: 1,
      unopened: 1,
      skipped: 0,
      dryRun: 0,
    },
    {
      channel: "WHATSAPP",
      label: "WhatsApp",
      attempted: 1,
      failed: 0,
      failureRate: "0%",
      delivered: 1,
      opened: 0,
      unopened: 1,
      skipped: 0,
      dryRun: 0,
    },
  ],
  linkOpened: 0,
  linkNotOpened: 1,
  speedPost: [],
  speedPostTotal: 0,
};

test("SMS summary uses Delivered and does not list opens", () => {
  assert.equal(channelShowsOpens("SMS"), false);
  assert.equal(channelShowsOpens("EMAIL"), true);
  const metrics = channelSummaryMetrics(report.channels[0]).map((row) => row.metric);
  assert.deepEqual(metrics, ["Attempted", "Failed or bounced", "Failure rate", "Delivered"]);

  const csv = reportSummaryCsv("Northwind", report);
  assert.match(csv, /Northwind,Digital,SMS,Delivered,2/);
  assert.match(csv, /Northwind,Digital,SMS,Failed or bounced,1/);
  assert.equal(csv.includes("SMS,Opened"), false);
  assert.equal(csv.includes("SMS,Not opened"), false);
  assert.equal(csv.includes("Handed over"), false);
  assert.equal(csv.includes("MSG91"), false);
  assert.match(csv, /Northwind,Digital,Email,Delivered,1/);
  assert.match(csv, /Northwind,Digital,Email,Opened,1/);
  assert.match(csv, /Northwind,Digital,Email,Not opened,1/);
  assert.match(csv, /Northwind,Digital,WhatsApp,Opened,0/);
  assert.match(csv, /Northwind,Digital,WhatsApp,Not opened,1/);
});
