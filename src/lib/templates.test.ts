import assert from "node:assert/strict";
import test from "node:test";
import {
  approvedNameTaken,
  draftNameTaken,
  listTemplatesForBank,
  selectableApprovedTemplates,
  sendScope,
  templateChoiceLabel,
  templateFormNote,
  templateListedForBank,
  templateWording,
  templateWordingSelect,
  visibleTemplatesWhere,
  TEMPLATE_APPROVED,
  TEMPLATE_DRAFT,
} from "./templates";

const NORTHWIND = "nwh";
const TEST_BANK = "mh";
const NEW_BANK = "new";

const stored = [
  {
    id: "email",
    bankId: NORTHWIND,
    name: "Borrower email notice",
    status: TEMPLATE_APPROVED,
    body: "To {{customer_name}}",
    dltTemplateId: "1107165400000000002",
    channels: '["EMAIL","WHATSAPP"]',
    seedKey: "nwh-borrower-email",
  },
  {
    id: "sms",
    bankId: NORTHWIND,
    name: "Loan recall notice (SMS)",
    status: TEMPLATE_APPROVED,
    body: "Dear {{customer_name}}",
    dltTemplateId: "1107165400000000001",
    channels: '["SMS"]',
    seedKey: "nwh-loan-recall-sms",
  },
  {
    id: "nwh-draft",
    bankId: NORTHWIND,
    name: "Northwind private draft",
    status: TEMPLATE_DRAFT,
    body: "Draft for Northwind only",
    dltTemplateId: "",
    channels: '["SMS"]',
    seedKey: null,
  },
  {
    id: "mh-draft",
    bankId: TEST_BANK,
    name: "Test Bank draft",
    status: TEMPLATE_DRAFT,
    body: "Draft for Test Bank only",
    dltTemplateId: "",
    channels: '["EMAIL"]',
    seedKey: null,
  },
];

test("Test Bank lists Northwind Approved wording and hides Northwind drafts", () => {
  const before = stored.map((template) => ({ ...template }));
  const listed = listTemplatesForBank(stored, TEST_BANK);
  assert.deepEqual(
    listed.map((template) => template.id),
    ["email", "sms", "mh-draft"],
  );
  assert.equal(templateListedForBank(stored[2], TEST_BANK), false);
  assert.equal(templateListedForBank(stored[0], TEST_BANK), true);

  const choices = selectableApprovedTemplates(listed);
  assert.deepEqual(
    choices.map((template) => template.name),
    ["Borrower email notice", "Loan recall notice (SMS)"],
  );
  assert.equal(
    templateChoiceLabel(
      { name: choices[0].name, bankId: NORTHWIND, bankName: "Northwind Housing Finance" },
      TEST_BANK,
    ),
    "Borrower email notice (Northwind Housing Finance)",
  );

  assert.deepEqual(stored, before);
  assert.equal(stored[0].seedKey, "nwh-borrower-email");
  assert.equal(stored[0].bankId, NORTHWIND);
});

test("a new bank with no templates of its own still sees Approved wording", () => {
  const listed = listTemplatesForBank(stored, NEW_BANK);
  assert.deepEqual(
    listed.map((template) => template.id),
    ["email", "sms"],
  );
  assert.equal(listed.some((template) => template.bankId === NEW_BANK), false);
});

test("visible query is Approved wording or drafts of this bank", () => {
  assert.deepEqual(visibleTemplatesWhere(TEST_BANK), {
    OR: [
      { status: TEMPLATE_APPROVED },
      { bankId: TEST_BANK, status: TEMPLATE_DRAFT },
    ],
  });
});

test("shared template payload is wording only", () => {
  const polluted = {
    ...stored[0],
    customerName: "Asha Patel",
    mobile: "9811111111",
    email: "asha@example.com",
    address: "12 Hill Road",
    loanNumber: "LN10021",
    customerId: "C-9",
  };
  const wording = templateWording(polluted);
  assert.deepEqual(wording, {
    id: "email",
    name: "Borrower email notice",
    body: "To {{customer_name}}",
    dltTemplateId: "1107165400000000002",
    channels: '["EMAIL","WHATSAPP"]',
    status: TEMPLATE_APPROVED,
  });
  assert.equal("customerName" in wording, false);
  assert.equal("mobile" in wording, false);
  assert.equal("email" in wording, false);
  assert.equal("address" in wording, false);
  assert.equal("loanNumber" in wording, false);
  assert.deepEqual(Object.keys(templateWordingSelect).sort(), [
    "body",
    "channels",
    "dltTemplateId",
    "id",
    "name",
    "status",
  ]);
});

test("same-name Approved wording is not overwritten", () => {
  assert.equal(approvedNameTaken(stored, "borrower email notice", ""), true);
  assert.equal(approvedNameTaken(stored, "borrower email notice", "email"), false);
  assert.equal(draftNameTaken(stored, TEST_BANK, "Test Bank draft", ""), true);
  assert.equal(draftNameTaken(stored, TEST_BANK, "Borrower email notice", ""), false);
  assert.equal(draftNameTaken(stored, NORTHWIND, "Northwind private draft", "nwh-draft"), false);
});

test("Northwind wording can be used on Test Bank only with Test Bank people", () => {
  const approved = { status: TEMPLATE_APPROVED };
  const draft = { status: TEMPLATE_DRAFT };

  assert.deepEqual(
    sendScope({
      workingBankId: TEST_BANK,
      template: approved,
      batch: { bankId: NORTHWIND },
      rows: [{ bankId: NORTHWIND }],
    }),
    { ok: false, reason: "batch" },
  );
  assert.deepEqual(
    sendScope({
      workingBankId: TEST_BANK,
      template: approved,
      batch: { bankId: TEST_BANK },
      rows: [{ bankId: TEST_BANK }, { bankId: NORTHWIND }],
    }),
    { ok: false, reason: "rows" },
  );
  assert.deepEqual(
    sendScope({
      workingBankId: TEST_BANK,
      template: approved,
      batch: { bankId: TEST_BANK },
      rows: [],
    }),
    { ok: false, reason: "rows" },
  );
  assert.deepEqual(
    sendScope({
      workingBankId: TEST_BANK,
      template: draft,
      batch: { bankId: TEST_BANK },
      rows: [{ bankId: TEST_BANK }],
    }),
    { ok: false, reason: "template" },
  );
  assert.deepEqual(
    sendScope({
      workingBankId: TEST_BANK,
      template: approved,
      batch: { bankId: TEST_BANK },
      rows: [{ bankId: TEST_BANK }],
    }),
    { ok: true },
  );
});

test("the form tells staff that only wording is shared", () => {
  const note = templateFormNote({
    isNew: false,
    status: TEMPLATE_APPROVED,
    homeBankName: "Northwind Housing Finance",
  });
  assert.match(note, /every bank can select this wording/);
  assert.match(note, /People, spreadsheets, and sends stay on their own bank/);
});
