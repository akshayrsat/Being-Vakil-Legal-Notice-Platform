import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  approvedNameTaken,
  draftNameTaken,
  listTemplatesForBank,
  selectableApprovedTemplates,
  sendScope,
  staffTemplateLibraryView,
  templateChoiceLabel,
  templateListedForBank,
  templatePageKicker,
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
    name: "Legal notice (email)",
    status: TEMPLATE_APPROVED,
    body: "contact_name {{customer_name}}",
    dltTemplateId: "legal_notice_non_payment",
    channels: '["EMAIL"]',
    seedKey: "nwh-borrower-email",
  },
  {
    id: "sms",
    bankId: NORTHWIND,
    name: "Legal notice (SMS)",
    status: TEMPLATE_APPROVED,
    body: "Dear {{customer_name}}",
    dltTemplateId: "6abf5af2e9226c340a0548e2",
    channels: '["SMS"]',
    seedKey: "nwh-loan-recall-sms",
  },
  {
    id: "whatsapp",
    bankId: NORTHWIND,
    name: "Legal notice (WhatsApp)",
    status: TEMPLATE_APPROVED,
    body: "Dear {{customer_name}}",
    dltTemplateId: "legal_notice_link",
    channels: '["WHATSAPP"]',
    seedKey: "msg91-legal-notice-whatsapp",
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
    ["email", "sms", "whatsapp", "mh-draft"],
  );
  const northwindDraft = stored.find((template) => template.id === "nwh-draft");
  assert.ok(northwindDraft);
  assert.equal(templateListedForBank(northwindDraft, TEST_BANK), false);
  assert.equal(templateListedForBank(stored[0], TEST_BANK), true);

  const choices = selectableApprovedTemplates(listed);
  assert.deepEqual(
    choices.map((template) => template.name),
    ["Legal notice (email)", "Legal notice (SMS)", "Legal notice (WhatsApp)"],
  );
  assert.equal(
    templateChoiceLabel(
      {
        name: choices[0].name,
        bankId: NORTHWIND,
        bankName: "Northwind Housing Finance",
        seedKey: "nwh-borrower-email",
        dltTemplateId: "legal_notice_non_payment",
      },
      TEST_BANK,
    ),
    "Legal notice (email)",
  );
  assert.equal(
    templateChoiceLabel(
      {
        name: "Branch circular",
        bankId: "mcb",
        bankName: "Meridian Co-operative Bank",
        seedKey: null,
        dltTemplateId: "bank-specific",
      },
      TEST_BANK,
    ),
    "Branch circular (Meridian Co-operative Bank)",
  );

  assert.deepEqual(stored, before);
  assert.equal(stored[0].seedKey, "nwh-borrower-email");
  assert.equal(stored[0].bankId, NORTHWIND);
});

test("a new bank with no templates of its own still sees Approved wording", () => {
  const listed = listTemplatesForBank(stored, NEW_BANK);
  assert.deepEqual(
    listed.map((template) => template.id),
    ["email", "sms", "whatsapp"],
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
    name: "Legal notice (email)",
    body: "contact_name {{customer_name}}",
    dltTemplateId: "legal_notice_non_payment",
    channels: '["EMAIL"]',
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
  assert.equal(approvedNameTaken(stored, "legal notice (email)", ""), true);
  assert.equal(approvedNameTaken(stored, "legal notice (email)", "email"), false);
  assert.equal(draftNameTaken(stored, TEST_BANK, "Test Bank draft", ""), true);
  assert.equal(draftNameTaken(stored, TEST_BANK, "Legal notice (email)", ""), false);
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

test("Test Bank staff see only the three live notices and no practice bank", () => {
  const view = staffTemplateLibraryView(
    [
      ...stored.map((template) => ({
        ...template,
        bankName: template.bankId === NORTHWIND ? "Northwind Housing Finance" : "Test Bank",
      })),
      {
        id: "branch",
        bankId: TEST_BANK,
        bankName: "Test Bank",
        name: "Branch circular",
        status: TEMPLATE_APPROVED,
        body: "Local wording",
        dltTemplateId: "bank-specific",
        channels: '["EMAIL"]',
        seedKey: null,
      },
    ],
    TEST_BANK,
  );
  assert.deepEqual(view.choiceLabels, [
    "Legal notice (email)",
    "Legal notice (SMS)",
    "Legal notice (WhatsApp)",
  ]);
  assert.deepEqual(
    view.saved.map((row) => row.name),
    ["Legal notice (email)", "Legal notice (SMS)", "Legal notice (WhatsApp)"],
  );
  assert.deepEqual(
    view.saved.map((row) => row.detail),
    [
      "Approved · Email · DLT legal_notice_non_payment · Available for every bank",
      "Approved · SMS · DLT 6abf5af2e9226c340a0548e2 · Available for every bank",
      "Approved · WhatsApp · DLT legal_notice_link · Available for every bank",
    ],
  );
  const visible = JSON.stringify(view);
  assert.doesNotMatch(visible, /Northwind|Meridian|Harbour|Written for|Test Bank draft|Branch circular/);
  assert.equal(
    templatePageKicker({
      workingBankName: "Test Bank",
      workingBankId: TEST_BANK,
      templateBankId: NORTHWIND,
      templateBankName: "Northwind Housing Finance",
      seedKey: "nwh-loan-recall-sms",
      dltTemplateId: "6abf5af2e9226c340a0548e2",
      name: "Legal notice (SMS)",
    }),
    "Available for every bank",
  );
});

test("there is no page or action for writing a template", () => {
  assert.equal(existsSync(new URL("../app/templates/new/page.tsx", import.meta.url)), false);
  assert.equal(existsSync(new URL("../app/actions/templates.ts", import.meta.url)), false);
  assert.equal(existsSync(new URL("../components/template-form.tsx", import.meta.url)), false);
  const page = readFileSync(new URL("../app/templates/page.tsx", import.meta.url), "utf8");
  const campaigns = readFileSync(new URL("../app/campaigns/new/page.tsx", import.meta.url), "utf8");
  const preview = readFileSync(new URL("../components/notice-merge-preview.tsx", import.meta.url), "utf8");
  for (const source of [page, campaigns, preview]) {
    assert.doesNotMatch(source, /New template/);
    assert.doesNotMatch(source, /templates\/new/);
    assert.doesNotMatch(source, /saveTemplate/);
  }
  assert.match(page, /does not write a template/);
  assert.match(page, /MSG91 or Facebook/);
});
