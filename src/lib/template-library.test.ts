import assert from "node:assert/strict";
import test from "node:test";
import { backToSpreadsheet, prepareSendBack } from "./desk-back";
import {
  approvedTemplatesForBank,
  otherBankApprovedSummary,
  sortTemplatesByName,
  templateDetailCard,
  templateLibraryNotes,
  templateMissingCopy,
  templatesEmptyLibrary,
  templatesListCard,
  templatesListIntro,
  type BankTemplateRow,
} from "./template-library";

function row(partial: Partial<BankTemplateRow> & Pick<BankTemplateRow, "id" | "name">): BankTemplateRow {
  return {
    bankId: "test-bank",
    status: "APPROVED",
    ...partial,
  };
}

test("approved templates for the working bank stay listed in name order", () => {
  const saved: BankTemplateRow[] = [
    row({ id: "z", name: "Zebra notice" }),
    row({ id: "draft", name: "Alpha draft", status: "DRAFT" }),
    row({ id: "other", name: "Northwind only", bankId: "nwh", status: "APPROVED" }),
    row({ id: "b", name: "borrower email", status: " approved " }),
    row({ id: "a", name: "Loan recall" }),
    row({ id: "old", name: "Demand notice", status: "Approved" }),
  ];

  const approved = approvedTemplatesForBank(saved, "test-bank");
  assert.deepEqual(
    approved.map((template) => template.id),
    ["b", "old", "a", "other", "z"],
  );
  assert.equal(approved.length, 5);
  assert.equal(saved.length, 6);
});

test("fifteen approved templates all remain selectable, sorted A to Z", () => {
  const names = [
    "Notice 10",
    "Notice 2",
    "alpha",
    "Bravo",
    "charlie",
    "Delta",
    "Echo",
    "foxtrot",
    "Golf",
    "hotel",
    "India",
    "juliet",
    "Kilo",
    "lima",
    "Mike",
  ];
  const saved = names.map((name, index) => row({ id: `id-${index}`, name }));
  saved.push(row({ id: "draft", name: "AAA draft", status: "DRAFT" }));
  saved.push(row({ id: "else", name: "Other bank", bankId: "other" }));

  const approved = approvedTemplatesForBank(saved, "test-bank");
  assert.equal(approved.length, 16);
  assert.deepEqual(
    approved.map((template) => template.name),
    sortTemplatesByName(saved.filter((template) => template.id !== "draft")).map((template) => template.name),
  );
  assert.equal(approved[0]?.name.toLowerCase(), "alpha");
  assert.equal(approved.at(-1)?.name, "Other bank");
});

test("other banks keep their approved names, and this bank is left out of that note", () => {
  const elsewhere = otherBankApprovedSummary(
    [
      { bankId: "nwh", status: "APPROVED", name: "Northwind ledger notice" },
      { bankId: "nwh", status: "DRAFT", name: "Hidden draft" },
      { bankId: "test-bank", status: "APPROVED", name: "Test Bank notice" },
      { bankId: "mcb", status: "APPROVED", name: "Meridian notice" },
    ],
    [
      { id: "nwh", name: "Northwind Housing Finance", code: "NWH" },
      { id: "mcb", name: "Meridian Co-operative Bank", code: "MCB" },
      { id: "test-bank", name: "Test Bank (MH)", code: "MH" },
    ],
    "test-bank",
  );

  assert.deepEqual(
    elsewhere.map((bank) => bank.bankCode),
    ["MCB", "NWH"],
  );
  assert.deepEqual(elsewhere[1]?.names, ["Northwind ledger notice"]);
  assert.equal(
    elsewhere.some((bank) => bank.names.includes("Test Bank notice")),
    false,
  );
});

test("firm library rows are not described as wording from Northwind", () => {
  const elsewhere = otherBankApprovedSummary(
    [
      {
        bankId: "nwh",
        status: "APPROVED",
        name: "Legal notice (SMS)",
        seedKey: "nwh-loan-recall-sms",
        dltTemplateId: "6abf5af2e9226c340a0548e2",
      },
      {
        bankId: "nwh",
        status: "APPROVED",
        name: "Legal notice (email)",
        seedKey: "nwh-borrower-email",
        dltTemplateId: "legal_notice_non_payment",
      },
      {
        bankId: "nwh",
        status: "APPROVED",
        name: "Legal notice (WhatsApp)",
        seedKey: "msg91-legal-notice-whatsapp",
        dltTemplateId: "legal_notice_link",
      },
    ],
    [
      { id: "nwh", name: "Northwind Housing Finance", code: "NWH" },
      { id: "test-bank", name: "Test Bank", code: "MH" },
    ],
    "test-bank",
  );
  assert.deepEqual(elsewhere, []);
  const notes = templateLibraryNotes({
    bankName: "Test Bank",
    savedCount: 3,
    approvedCount: 3,
    elsewhere,
  });
  assert.doesNotMatch(notes.join(" "), /Northwind|Meridian|Harbour/);
});

test("an empty working bank explains the upload and lists approved wording from another bank", () => {
  const notes = templateLibraryNotes({
    bankName: "Test Bank (MH)",
    savedCount: 0,
    approvedCount: 0,
    elsewhere: [
      {
        bankId: "nwh",
        bankName: "Northwind Housing Finance",
        bankCode: "NWH",
        count: 1,
        names: ["Legal notice (SMS)"],
      },
    ],
  });
  const text = notes.join(" ");
  assert.match(text, /does not save notice wording/);
  assert.match(text, /Test Bank \(MH\)/);
  assert.match(text, /Northwind Housing Finance \(NWH\)/);
  assert.match(text, /Legal notice \(SMS\)/);
  assert.match(text, /already listed/);
  assert.doesNotMatch(text, /Switch to that bank/);
});

test("an empty library does not ask staff to write a template", () => {
  const notes = templateLibraryNotes({
    bankName: "Test Bank",
    savedCount: 0,
    approvedCount: 0,
    elsewhere: [],
  });
  const text = notes.join(" ");
  assert.match(text, /does not save notice wording/);
  assert.match(text, /approved notice templates/);
  assert.match(text, /does not write a template/);
  assert.doesNotMatch(text, /Write a template|New template|saved draft|MSG91|DLT|Facebook/);
});

test("bank users and coordinators see the template name and channel, and the owner sees the reference", () => {
  const intro = templatesListIntro("Test Bank", false);
  const card = templatesListCard(false);
  const detail = templateDetailCard(false);
  const plain = [intro, card, detail, templatesEmptyLibrary(), templateMissingCopy()].join(" ");
  assert.match(intro, /Test Bank/);
  assert.match(intro, /does not write a template/);
  assert.match(card, /name and the channel/);
  assert.doesNotMatch(plain, /MSG91|DLT|Facebook|legal_notice_|6abf5af2/);
  const owner = [templatesListIntro("Test Bank", true), templatesListCard(true), templateDetailCard(true)].join(" ");
  assert.match(owner, /MSG91 or Facebook/);
  assert.match(owner, /approved on DLT/);
  assert.match(owner, /reference id/);
});

test("prepare-send back returns to the spreadsheet when one was opened, and ignores a bad id", () => {
  assert.deepEqual(prepareSendBack("batch_1"), [
    { href: "/uploads/batch_1", label: "Back to spreadsheet" },
    { href: "/campaigns", label: "Back to campaigns" },
  ]);
  assert.deepEqual(prepareSendBack(""), [{ href: "/campaigns", label: "Back to campaigns" }]);
  assert.deepEqual(prepareSendBack("../admin"), [{ href: "/campaigns", label: "Back to campaigns" }]);
  assert.equal(backToSpreadsheet("batch_1").href, "/uploads/batch_1");
});
