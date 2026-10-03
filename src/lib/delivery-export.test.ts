import assert from "node:assert/strict";
import test from "node:test";
import {
  DELIVERY_EXPORT_COLUMNS,
  deliveryExportCsv,
  deliveryExportWhere,
  deliveryStatusWord,
  formatIstTimestamp,
  type DeliveryExportRow,
} from "./delivery-export";
import { indiaDayRange } from "./india-day";

const BANK = { id: "bank-a", name: "Northwind Housing Finance" };

function sample(overrides: Partial<DeliveryExportRow> = {}): DeliveryExportRow {
  return {
    bankId: "bank-a",
    campaignBankId: "bank-a",
    batchBankId: "bank-a",
    uploadFileName: "northwind-oct.csv",
    uploadedAt: new Date("2026-10-01T18:30:00.000Z"),
    customerName: "Asha Rao",
    loanNumber: "LN-10021",
    mobile: "9811111111",
    email: "asha@example.com",
    channel: "SMS",
    campaignName: "Legal notice",
    status: "SIMULATED_SENT",
    openedAt: null,
    linkOpenedAt: null,
    linkViewCount: 0,
    noticeNumber: "DEMO-LN10021",
    noticeUrl: "https://www.notice.beingvakil.in/notice-DEMO-LN10021",
    ...overrides,
  };
}

function parseCsv(text: string): string[][] {
  assert.equal(text.charCodeAt(0), 0xfeff);
  const lines = text.slice(1).split("\r\n").filter((line) => line.length > 0);
  return lines.map(parseLine);
}

function parseLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index] ?? "";
    if (quoted) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === ",") {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

function column(table: string[][], name: string): number {
  const index = table[0]?.indexOf(name) ?? -1;
  assert.notEqual(index, -1, name);
  return index;
}

test("delivery status words match the export vocabulary", () => {
  assert.equal(deliveryStatusWord("QUEUED"), "queued");
  assert.equal(deliveryStatusWord("SENT"), "sent");
  assert.equal(deliveryStatusWord("DELIVERED"), "delivered");
  assert.equal(deliveryStatusWord("FAILED"), "failed");
  assert.equal(deliveryStatusWord("SKIPPED"), "skipped");
  assert.equal(deliveryStatusWord("SIMULATED_SENT"), "dry run");
  assert.equal(deliveryStatusWord("SIMULATED_SENT", false), "not sent");
  assert.equal(deliveryStatusWord("READ"), "read");
});

test("timestamps are India time, not UTC", () => {
  assert.equal(formatIstTimestamp(new Date("2026-10-01T18:30:00.000Z")), "02-10-2026 00:00 IST");
  assert.equal(formatIstTimestamp(new Date("2026-10-02T18:29:00.000Z")), "02-10-2026 23:59 IST");
});

test("delivery CSV columns and one row per person and channel", () => {
  const opened = new Date("2026-10-02T04:15:00.000Z");
  const linkOpened = new Date("2026-10-02T05:45:00.000Z");
  const csv = deliveryExportCsv(BANK, [
    sample(),
    sample({
      channel: "EMAIL",
      status: "DELIVERED",
      openedAt: opened,
      linkOpenedAt: linkOpened,
      linkViewCount: 3,
    }),
    sample({
      customerName: "Ravi Shah",
      loanNumber: "LN-10022",
      channel: "WHATSAPP",
      status: "FAILED",
      mobile: "9822222222",
      email: "ravi@example.com",
      noticeNumber: "DEMO-LN10022",
      noticeUrl: "https://www.notice.beingvakil.in/notice-DEMO-LN10022",
    }),
  ]);
  const table = parseCsv(csv);
  assert.deepEqual(table[0], [...DELIVERY_EXPORT_COLUMNS]);
  assert.equal(table.length, 4);

  const file = column(table, "Upload file");
  const uploaded = column(table, "Uploaded at (IST)");
  const name = column(table, "Customer name");
  const loan = column(table, "Loan number");
  const mobile = column(table, "Mobile");
  const email = column(table, "Email");
  const channel = column(table, "Channel");
  const campaign = column(table, "Notice");
  const status = column(table, "Delivery status");
  const openedAt = column(table, "Opened at (IST)");
  const msg91 = column(table, "MSG91 open or read");
  const linkAt = column(table, "Notice link opened at (IST)");
  const views = column(table, "Notice link views");
  const notice = column(table, "Notice number");
  const url = column(table, "Notice URL");

  const ashaSms = table.find((row) => row[name] === "Asha Rao" && row[channel] === "SMS");
  const ashaEmail = table.find((row) => row[name] === "Asha Rao" && row[channel] === "Email");
  const ravi = table.find((row) => row[name] === "Ravi Shah");
  assert.ok(ashaSms && ashaEmail && ravi);

  assert.equal(ashaSms[file], "northwind-oct.csv");
  assert.equal(ashaSms[uploaded], "02-10-2026 00:00 IST");
  assert.equal(ashaSms[loan], "LN-10021");
  assert.equal(ashaSms[mobile], "9811111111");
  assert.equal(ashaSms[email], "");
  assert.equal(ashaSms[campaign], "Legal notice");
  assert.equal(ashaSms[status], "dry run");
  assert.equal(ashaSms[openedAt], "");
  assert.equal(ashaSms[msg91], "");
  assert.equal(ashaSms[linkAt], "");
  assert.equal(ashaSms[views], "");
  assert.equal(ashaSms[notice], "DEMO-LN10021");
  assert.equal(ashaSms[url], "https://www.notice.beingvakil.in/notice-DEMO-LN10021");

  assert.equal(ashaEmail[mobile], "");
  assert.equal(ashaEmail[email], "asha@example.com");
  assert.equal(ashaEmail[status], "delivered");
  assert.equal(ashaEmail[openedAt], "02-10-2026 09:45 IST");
  assert.equal(ashaEmail[msg91], "open");
  assert.equal(ashaEmail[linkAt], "02-10-2026 11:15 IST");
  assert.equal(ashaEmail[views], "3");

  assert.equal(ravi[channel], "WhatsApp");
  assert.equal(ravi[status], "failed");
  assert.equal(ravi[mobile], "9822222222");
  assert.equal(ravi[email], "");
});

test("a read receipt is marked read, and another bank is left out", () => {
  const csv = deliveryExportCsv(BANK, [
    sample({
      channel: "EMAIL",
      status: "READ",
      openedAt: new Date("2026-10-02T04:15:00.000Z"),
      customerName: "Asha Rao",
    }),
    sample({
      bankId: "bank-b",
      campaignBankId: "bank-b",
      batchBankId: "bank-b",
      uploadFileName: "meridian-secret.xlsx",
      customerName: "Priya Otherbank",
      loanNumber: "OTHER-LOAN",
      mobile: "9900000000",
      email: "priya@otherbank.test",
      campaignName: "Meridian template",
      noticeNumber: "OTHER-NOTICE",
      noticeUrl: "https://www.notice.beingvakil.in/notice-OTHER-NOTICE",
    }),
    sample({
      batchBankId: "bank-b",
      customerName: "Leaked Batch",
      loanNumber: "LEAK-LOAN",
      uploadFileName: "wrong-batch.xlsx",
    }),
    sample({
      campaignBankId: "bank-b",
      customerName: "Leaked Campaign",
      loanNumber: "LEAK-CAMPAIGN",
    }),
  ]);
  const table = parseCsv(csv);
  assert.equal(table.length, 2);
  const status = column(table, "Delivery status");
  const msg91 = column(table, "MSG91 open or read");
  const bank = column(table, "Bank");
  assert.equal(table[1]?.[status], "read");
  assert.equal(table[1]?.[msg91], "read");
  assert.equal(table[1]?.[bank], "Northwind Housing Finance");
  assert.equal(csv.includes("Priya Otherbank"), false);
  assert.equal(csv.includes("OTHER-LOAN"), false);
  assert.equal(csv.includes("priya@otherbank.test"), false);
  assert.equal(csv.includes("meridian-secret.xlsx"), false);
  assert.equal(csv.includes("OTHER-NOTICE"), false);
  assert.equal(csv.includes("Meridian"), false);
  assert.equal(csv.includes("Leaked Batch"), false);
  assert.equal(csv.includes("LEAK-LOAN"), false);
  assert.equal(csv.includes("wrong-batch.xlsx"), false);
  assert.equal(csv.includes("Leaked Campaign"), false);
  assert.equal(csv.includes("bank-b"), false);
});

test("an empty bank id exports a header and no rows", () => {
  const table = parseCsv(deliveryExportCsv({ id: "  ", name: "Northwind Housing Finance" }, [sample()]));
  assert.equal(table.length, 1);
  assert.equal(csvHasCustomer(table, "Asha Rao"), false);
});

test("names that look like formulas are escaped", () => {
  const csv = deliveryExportCsv(BANK, [sample({ customerName: '=HYPERLINK("http://evil")', loanNumber: "LN,1" })]);
  assert.match(csv, /"'=HYPERLINK\(""http:\/\/evil""\)"/);
  assert.match(csv, /"LN,1"/);
});

test("newer uploads come first, then the person, then SMS before email", () => {
  const older = new Date("2026-10-01T18:30:00.000Z");
  const newer = new Date("2026-10-02T18:30:00.000Z");
  const table = parseCsv(
    deliveryExportCsv(BANK, [
      sample({ customerName: "Zara", channel: "EMAIL", uploadedAt: older, uploadFileName: "old.csv" }),
      sample({ customerName: "Asha Rao", channel: "EMAIL", uploadedAt: newer, uploadFileName: "new.csv" }),
      sample({ customerName: "Asha Rao", channel: "SMS", uploadedAt: newer, uploadFileName: "new.csv" }),
    ]),
  );
  const name = column(table, "Customer name");
  const channel = column(table, "Channel");
  const file = column(table, "Upload file");
  assert.deepEqual(
    table.slice(1).map((row) => [row[file], row[name], row[channel]]),
    [
      ["new.csv", "Asha Rao", "SMS"],
      ["new.csv", "Asha Rao", "Email"],
      ["old.csv", "Zara", "Email"],
    ],
  );
});

test("the delivery query is locked to one bank, channel, and India day", () => {
  const where = deliveryExportWhere("bank-a", { channel: "EMAIL", from: "2026-10-02", to: "2026-10-02" });
  assert.ok(where);
  assert.equal(where.bankId, "bank-a");
  assert.equal(where.channel, "EMAIL");
  assert.deepEqual(where.campaign, {
    bankId: "bank-a",
    batch: { bankId: "bank-a" },
    createdAt: indiaDayRange("2026-10-02", "2026-10-02"),
  });
  assert.equal(JSON.stringify(where).includes("bank-b"), false);

  const allChannels = deliveryExportWhere(" bank-a ", { channel: "", from: "", to: "" });
  assert.equal(allChannels?.bankId, "bank-a");
  assert.equal(allChannels?.channel, undefined);
  assert.equal(deliveryExportWhere("bank-a", { channel: "NOT_A_CHANNEL", from: "", to: "" })?.channel, undefined);
  assert.equal(deliveryExportWhere("bank-a", { channel: "SPEED_POST", from: "", to: "" }), null);
  assert.equal(deliveryExportWhere("  ", { channel: "SMS", from: "", to: "" }), null);
});

function csvHasCustomer(table: string[][], customer: string): boolean {
  const name = column(table, "Customer name");
  return table.slice(1).some((row) => row[name] === customer);
}
