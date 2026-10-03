import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import {
  DELIVERY_EXPORT_COLUMNS,
  deliveryExportCsv,
  deliveryExportWhere,
  deliveryExportXlsx,
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

test("one person is one row, with a status column for each channel", () => {
  const csv = deliveryExportCsv(BANK, [
    sample(),
    sample({
      channel: "EMAIL",
      status: "DELIVERED",
      email: "asha@example.com",
    }),
    sample({
      channel: "WHATSAPP",
      status: "FAILED",
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
  ], true, [
    {
      bankId: "bank-a",
      campaignBankId: "bank-a",
      batchBankId: "bank-a",
      uploadFileName: "northwind-oct.csv",
      customerName: "Asha Rao",
      loanNumber: "LN-10021",
      noticeNumber: "DEMO-LN10021",
      status: "IN_TRANSIT",
      updatedAt: new Date("2026-10-02T18:30:00.000Z"),
    },
  ]);
  const table = parseCsv(csv);
  assert.deepEqual(table[0], [...DELIVERY_EXPORT_COLUMNS]);
  assert.equal(table.length, 3);
  assert.equal(csv.includes("MSG91"), false);

  const name = column(table, "Name");
  const mobile = column(table, "Mobile");
  const email = column(table, "Email address");
  const loan = column(table, "Loan or account number");
  const notice = column(table, "Notice number");
  const link = column(table, "Notice link");
  const sms = column(table, "SMS");
  const mail = column(table, "Email");
  const whatsapp = column(table, "WhatsApp");
  const post = column(table, "Speed Post");

  const asha = table.find((row) => row[name] === "Asha Rao");
  const ravi = table.find((row) => row[name] === "Ravi Shah");
  assert.ok(asha && ravi);
  assert.equal(asha[mobile], "9811111111");
  assert.equal(asha[email], "asha@example.com");
  assert.equal(asha[loan], "LN-10021");
  assert.equal(asha[notice], "DEMO-LN10021");
  assert.equal(asha[link], "https://www.notice.beingvakil.in/notice-DEMO-LN10021");
  assert.equal(asha[sms], "dry run");
  assert.equal(asha[mail], "delivered");
  assert.equal(asha[whatsapp], "failed");
  assert.equal(asha[post], "In transit");

  assert.equal(ravi[mobile], "9822222222");
  assert.equal(ravi[email], "ravi@example.com");
  assert.equal(ravi[sms], "");
  assert.equal(ravi[whatsapp], "failed");
  assert.equal(ravi[post], "");
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
  const mail = column(table, "Email");
  assert.equal(table[1]?.[mail], "read");
  assert.equal(csv.includes("MSG91"), false);
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

test("a later status for the same channel replaces an earlier one, and people sort by name", () => {
  const older = new Date("2026-10-01T18:30:00.000Z");
  const newer = new Date("2026-10-02T18:30:00.000Z");
  const table = parseCsv(
    deliveryExportCsv(BANK, [
      sample({ customerName: "Zara", channel: "EMAIL", status: "FAILED", uploadedAt: older, noticeNumber: "ZARA-1" }),
      sample({ customerName: "Asha Rao", channel: "EMAIL", status: "FAILED", uploadedAt: older }),
      sample({ customerName: "Asha Rao", channel: "EMAIL", status: "DELIVERED", uploadedAt: newer }),
      sample({ customerName: "Asha Rao", channel: "SMS", status: "SENT", uploadedAt: newer }),
    ]),
  );
  const name = column(table, "Name");
  const mail = column(table, "Email");
  const sms = column(table, "SMS");
  assert.deepEqual(
    table.slice(1).map((row) => row[name]),
    ["Asha Rao", "Zara"],
  );
  const asha = table.find((row) => row[name] === "Asha Rao");
  assert.equal(asha?.[mail], "delivered");
  assert.equal(asha?.[sms], "sent");
});

test("a channel filter keeps people who used that channel and still shows the other statuses", () => {
  const table = parseCsv(
    deliveryExportCsv(
      BANK,
      [
        sample({ channel: "SMS", status: "SENT" }),
        sample({ channel: "EMAIL", status: "DELIVERED" }),
        sample({
          customerName: "Ravi Shah",
          loanNumber: "LN-10022",
          noticeNumber: "DEMO-LN10022",
          channel: "WHATSAPP",
          status: "FAILED",
        }),
      ],
      true,
      [],
      "EMAIL",
    ),
  );
  const name = column(table, "Name");
  assert.deepEqual(
    table.slice(1).map((row) => row[name]),
    ["Asha Rao"],
  );
  assert.equal(table[1]?.[column(table, "SMS")], "sent");
  assert.equal(table[1]?.[column(table, "Email")], "delivered");
});

test("a bank user sheet does not say dry run and does not name the vendor", () => {
  const csv = deliveryExportCsv(BANK, [sample({ status: "SIMULATED_SENT" })], false);
  const table = parseCsv(csv);
  assert.equal(table[1]?.[column(table, "SMS")], "not sent");
  assert.equal(csv.includes("MSG91"), false);
  assert.equal(csv.includes("dry run"), false);
});

test("the excel sheet keeps each column separate and one person on one row", async () => {
  const buffer = await deliveryExportXlsx(BANK, [
    sample({ status: "SENT" }),
    sample({ channel: "EMAIL", status: "DELIVERED" }),
    sample({ channel: "WHATSAPP", status: "FAILED" }),
  ]);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Parameters<ExcelJS.Xlsx["load"]>[0]);
  const sheet = workbook.worksheets[0];
  assert.ok(sheet);
  assert.equal(sheet.columnCount, DELIVERY_EXPORT_COLUMNS.length);
  assert.equal(sheet.rowCount, 2);
  const header = DELIVERY_EXPORT_COLUMNS.map((_, index) => String(sheet.getRow(1).getCell(index + 1).value ?? ""));
  assert.deepEqual(header, [...DELIVERY_EXPORT_COLUMNS]);
  const person = DELIVERY_EXPORT_COLUMNS.map((_, index) => String(sheet.getRow(2).getCell(index + 1).value ?? ""));
  assert.equal(person[0], "Asha Rao");
  assert.equal(person[1], "9811111111");
  assert.equal(person[2], "asha@example.com");
  assert.equal(person[6], "sent");
  assert.equal(person[7], "delivered");
  assert.equal(person[8], "failed");
  assert.equal(person.join("").includes("MSG91"), false);
});

test("the delivery query is locked to one bank, file, and India day", () => {
  const where = deliveryExportWhere("bank-a", { channel: "EMAIL", from: "2026-10-02", to: "2026-10-02" });
  assert.ok(where);
  assert.equal(where.bankId, "bank-a");
  assert.equal(where.channel, undefined);
  assert.deepEqual(where.campaign, {
    bankId: "bank-a",
    batch: { bankId: "bank-a" },
    createdAt: indiaDayRange("2026-10-02", "2026-10-02"),
  });
  assert.equal(JSON.stringify(where).includes("bank-b"), false);

  const allChannels = deliveryExportWhere(" bank-a ", { channel: "", from: "", to: "" });
  assert.equal(allChannels?.bankId, "bank-a");
  assert.equal(allChannels?.channel, undefined);
  assert.ok(deliveryExportWhere("bank-a", { channel: "SPEED_POST", from: "", to: "" }));
  assert.equal(deliveryExportWhere("  ", { channel: "SMS", from: "", to: "" }), null);

  const filed = deliveryExportWhere("bank-a", {
    channel: "SMS",
    from: "2026-10-02",
    to: "",
    file: "cmusaim530000js1rxftik03r",
  });
  assert.equal(filed?.channel, undefined);
  assert.deepEqual(filed?.campaign, {
    bankId: "bank-a",
    batch: { bankId: "bank-a", id: "cmusaim530000js1rxftik03r" },
    createdAt: indiaDayRange("2026-10-02", ""),
  });
  assert.equal(JSON.stringify(filed).includes("bank-b"), false);
});

function csvHasCustomer(table: string[][], customer: string): boolean {
  const name = column(table, "Name");
  return table.slice(1).some((row) => row[name] === customer);
}
