import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { formatIndiaDateTime } from "./india-day";
import {
  NOT_SENT,
  PERSON_EXCEL_COLUMNS,
  accountOrLoanLabel,
  buildPersonNoticeRows,
  personExcelFilename,
  personExcelHref,
  personNoticeWorkbook,
  type PersonDeliverySource,
  type PersonNoticeSource,
} from "./person-excel";

const BANK = "bank-a";
const WHEN = new Date("2026-10-03T11:06:00.000Z");
const LATER = new Date("2026-10-03T11:08:00.000Z");

function notice(overrides: Partial<PersonNoticeSource> = {}): PersonNoticeSource {
  return {
    bankId: BANK,
    noticeNumber: "NTG6VFF6GPL6",
    customerName: "Ajit Dhoble",
    loanNumber: "",
    customerId: "1468",
    createdAt: WHEN,
    ...overrides,
  };
}

function delivery(overrides: Partial<PersonDeliverySource> = {}): PersonDeliverySource {
  return {
    bankId: BANK,
    campaignBankId: BANK,
    batchBankId: BANK,
    customerName: "Ajit Dhoble",
    loanNumber: "",
    customerId: "1468",
    channel: "EMAIL",
    status: "READ",
    noticeNumber: "NTG6VFF6GPL6",
    sentAt: LATER,
    ...overrides,
  };
}

test("one row per notice carries SMS, email, and WhatsApp for that person only", () => {
  const rows = buildPersonNoticeRows({
    bankId: BANK,
    account: "1468",
    notices: [
      notice(),
      notice({
        noticeNumber: "LMUF6P5F2FWB",
        createdAt: LATER,
      }),
      notice({
        bankId: "bank-b",
        noticeNumber: "OTHERBANK",
        customerName: "Ajit Dhoble",
      }),
      notice({
        noticeNumber: "OTHERPERSON",
        customerName: "Meera Shah",
        loanNumber: "LN9",
        customerId: "9999",
      }),
    ],
    deliveries: [
      delivery(),
      delivery({
        noticeNumber: "LMUF6P5F2FWB",
        channel: "SMS",
        status: "DELIVERED",
      }),
      delivery({
        noticeNumber: "LMUF6P5F2FWB",
        channel: "WHATSAPP",
        status: "READ",
        batchBankId: "bank-b",
      }),
      delivery({
        noticeNumber: "OTHERPERSON",
        customerName: "Meera Shah",
        loanNumber: "LN9",
        customerId: "9999",
        channel: "SMS",
        status: "DELIVERED",
      }),
      delivery({
        bankId: "bank-b",
        campaignBankId: "bank-b",
        batchBankId: "bank-b",
        noticeNumber: "OTHERBANK",
        channel: "SMS",
        status: "DELIVERED",
      }),
    ],
  });

  assert.deepEqual(
    rows.map((row) => row.noticeNumber),
    ["NTG6VFF6GPL6", "LMUF6P5F2FWB"],
  );
  assert.deepEqual(rows[0], {
    name: "Ajit Dhoble",
    accountOrLoan: "1468",
    noticeNumber: "NTG6VFF6GPL6",
    date: formatIndiaDateTime(WHEN),
    sms: NOT_SENT,
    email: "Read",
    whatsapp: NOT_SENT,
  });
  assert.equal(rows[1]?.sms, "Delivered");
  assert.equal(rows[1]?.email, NOT_SENT);
  assert.equal(rows[1]?.whatsapp, NOT_SENT);
  assert.equal(rows.some((row) => row.name === "Meera Shah"), false);
  assert.equal(rows.some((row) => row.noticeNumber === "OTHERBANK"), false);
});

test("a loan search does not include another account, and the latest channel status wins", () => {
  const rows = buildPersonNoticeRows({
    bankId: BANK,
    loan: "LN10021",
    notices: [
      notice({
        loanNumber: "LN10021",
        customerId: "CUST501",
        customerName: "Akshay Sathe",
        noticeNumber: "DEMO-LN10021",
      }),
    ],
    deliveries: [
      delivery({
        loanNumber: "LN10021",
        customerId: "CUST501",
        customerName: "Akshay Sathe",
        noticeNumber: "DEMO-LN10021",
        channel: "SMS",
        status: "DELIVERED",
        sentAt: WHEN,
      }),
      delivery({
        loanNumber: "LN10021",
        customerId: "CUST501",
        customerName: "Akshay Sathe",
        noticeNumber: "DEMO-LN10021",
        channel: "SMS",
        status: "READ",
        sentAt: LATER,
      }),
      delivery({
        loanNumber: "LN10021",
        customerId: "CUST501",
        customerName: "Akshay Sathe",
        noticeNumber: "DEMO-LN10021",
        channel: "EMAIL",
        status: "SIMULATED_SENT",
        sentAt: LATER,
      }),
      delivery({
        loanNumber: "LN9",
        customerId: "9999",
        customerName: "Meera Shah",
        noticeNumber: "OTHERPERSON",
        channel: "WHATSAPP",
        status: "DELIVERED",
      }),
    ],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.accountOrLoan, accountOrLoanLabel("LN10021", "CUST501"));
  assert.equal(rows[0]?.sms, "Read");
  assert.equal(rows[0]?.email, NOT_SENT);
  assert.equal(rows[0]?.whatsapp, NOT_SENT);
  assert.equal(accountOrLoanLabel("LN10021", "CUST501"), "Loan LN10021 · Account CUST501");
});

test("a delivery tied to this notice is kept when the account number was left blank", () => {
  const rows = buildPersonNoticeRows({
    bankId: BANK,
    account: "1468",
    notices: [notice({ noticeNumber: "NTG6VFF6GPL6" })],
    deliveries: [
      delivery({
        customerId: "",
        loanNumber: "",
        channel: "WHATSAPP",
        status: "SENT",
        noticeNumber: "NTG6VFF6GPL6",
      }),
    ],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.whatsapp, "Delivered");
  assert.equal(rows[0]?.sms, NOT_SENT);
});

test("an empty lookup and a missing bank return no rows", () => {
  assert.deepEqual(
    buildPersonNoticeRows({ bankId: BANK, notices: [notice()], deliveries: [] }),
    [],
  );
  assert.deepEqual(
    buildPersonNoticeRows({ bankId: "", account: "1468", notices: [notice()], deliveries: [] }),
    [],
  );
});

test("the download address is the person on screen and is not fetched as a file name", () => {
  assert.equal(personExcelHref(BANK, "", "1468"), "/loans/export?bank=bank-a&account=1468");
  assert.equal(personExcelHref(BANK, "LN10021", "1468"), "/loans/export?bank=bank-a&loan=LN10021");
  assert.equal(personExcelHref(BANK, "", ""), null);
  assert.equal(personExcelFilename("1468"), "person-1468.xlsx");
  assert.equal(personExcelFilename("LN 10021"), "person-LN-10021.xlsx");
});

test("the workbook is a real xlsx file for this person and nobody else", async () => {
  const rows = buildPersonNoticeRows({
    bankId: BANK,
    account: "1468",
    notices: [notice({ customerName: "=Ajit Dhoble" })],
    deliveries: [delivery({ channel: "SMS", status: "DELIVERED" })],
  });
  const bytes = await personNoticeWorkbook(rows);
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
  const packed = Buffer.from(bytes).toString("latin1");
  assert.match(packed, /xl\/workbook\.xml/);
  assert.match(packed, /\[Content_Types\]\.xml/);
  assert.doesNotMatch(packed, /MSG91/i);
  assert.doesNotMatch(packed, /Meera Shah/);
  assert.doesNotMatch(Buffer.from(bytes).toString("utf8").slice(0, 20), /Name,/);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as Parameters<ExcelJS.Xlsx["load"]>[0]);
  const sheet = workbook.worksheets[0];
  assert.ok(sheet);
  assert.equal(sheet.name, "Notices");
  const header = PERSON_EXCEL_COLUMNS.map((_, index) => String(sheet.getRow(1).getCell(index + 1).value ?? ""));
  assert.deepEqual(header, [...PERSON_EXCEL_COLUMNS]);
  const values = PERSON_EXCEL_COLUMNS.map((_, index) => String(sheet.getRow(2).getCell(index + 1).value ?? ""));
  assert.equal(values[0], "'=Ajit Dhoble");
  assert.equal(values[1], "1468");
  assert.equal(values[2], "NTG6VFF6GPL6");
  assert.equal(values[4], "Delivered");
  assert.equal(values[5], NOT_SENT);
  assert.equal(values[6], NOT_SENT);
  assert.equal(sheet.rowCount, 2);
});
