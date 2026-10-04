import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { demandNoticePlainText } from "./demand-notice";
import { buildNoticeDraft } from "./public-notice";
import {
  draftLegalNoticeTemplate,
  fillLegalNoticeDocument,
  LEGAL_NOTICE_FORMAT_DEMAND,
  LEGAL_NOTICE_STARTER_NAME,
  legalNoticeChoiceLabel,
  legalNoticeParagraphs,
  sortLegalNotices,
  starterLegalNoticeBody,
  usesStructuredDemand,
} from "./legal-notice-templates";
import { ROLE_BANK_USER, ROLE_COORDINATOR, ROLE_OWNER } from "./roles";
import { workspaceNav } from "./send-notice";

const DATED = new Date("2026-06-15T12:00:00+05:30");

const PERSON = {
  customerName: "Asha Patel",
  mobiles: "[]",
  email: "",
  address: "14, Hill Road",
  loanNumber: "LN10021",
  customerId: "CUST1",
  loanAmount: "500000",
  outstandingAmount: "125000",
  loanType: "Home Loan",
  referenceNumber: "REF1",
  collectionManager: "",
  collectionManagerMobile: "",
  bankWebsite: "",
  coBorrowerName: "",
  coBorrowerMobile: "",
  coBorrowerEmail: "",
  guarantorName: "",
  guarantorMobile: "",
  guarantorEmail: "",
};

test("the starter legal notice is the notice the app already sends", () => {
  const fromBuilder = demandNoticePlainText({
    customerName: "{{customer_name}}",
    address: "{{address}}",
    outstandingAmount: "{{outstanding_amount}}",
    loanNumber: "{{loan_number}}",
    bankName: "{{bank_name}}",
    loanType: "{{loan_type}}",
    referenceNumber: "{{reference_number}}",
    collectionManager: "{{collection_manager}}",
    collectionManagerMobile: "{{collection_manager_mobile}}",
    bankWebsite: "{{bank_website}}",
    noticeNumber: "{{notice_number}}",
    dated: DATED,
  }).replace(/^Date : .+$/m, "Date : {{notice_date}}");

  const starter = starterLegalNoticeBody(DATED);
  assert.equal(starter, fromBuilder);
  assert.equal(LEGAL_NOTICE_STARTER_NAME, "Legal notice");
  assert.doesNotMatch(starter, /northwind/i);
  assert.match(starter, /Under instructions from our client \{\{bank_name\}\}/);
  assert.match(starter, /Date : \{\{notice_date\}\}/);
  assert.match(starter, /LEGAL NOTICE/);

  const live = demandNoticePlainText({
    customerName: "Asha Patel",
    address: "14, Hill Road",
    outstandingAmount: "125000",
    loanNumber: "LN10021",
    bankName: "Example Bank",
    loanType: "Home Loan",
    referenceNumber: "REF1",
    collectionManager: "",
    collectionManagerMobile: "",
    bankWebsite: "",
    noticeNumber: "N1",
    dated: DATED,
  });
  assert.match(live, /Under instructions from our client Example Bank/);
  assert.match(live, /Rs\. 1,25,000\/-/);
});

test("a filled legal notice uses the template wording", () => {
  const filled = fillLegalNoticeDocument(
    "To {{customer_name}}\n\nPay {{outstanding_amount}} to {{bank_name}}.\nNotice {{notice_number}} dated {{notice_date}}.",
    PERSON,
    "Example Bank",
    "ABC123",
    DATED,
  );
  assert.match(filled, /To Asha Patel/);
  assert.match(filled, /Pay 125000 to Example Bank/);
  assert.match(filled, /Notice ABC123 dated /);
  assert.doesNotMatch(filled, /\{\{customer_name\}\}/);
  assert.equal(usesStructuredDemand(LEGAL_NOTICE_FORMAT_DEMAND), true);
  assert.equal(usesStructuredDemand(""), true);
  assert.equal(usesStructuredDemand("text"), false);
  assert.equal(legalNoticeParagraphs(filled).length, 2);
});

test("choosing a legal notice is what the filled notice stores", () => {
  const row = { ...PERSON, id: "row1" };
  const custom = buildNoticeDraft(row, "Example Bank", "ABC123", {
    format: "text",
    body: "Hello {{customer_name}} from {{bank_name}}.",
  });
  assert.equal(custom.documentFormat, "text");
  assert.equal(custom.body, "Hello Asha Patel from Example Bank.");

  const starter = buildNoticeDraft(row, "Example Bank", "ABC123", {
    format: "demand",
    body: "ignored",
  });
  assert.equal(starter.documentFormat, "demand");
  assert.match(starter.body, /Under instructions from our client Example Bank/);
  assert.doesNotMatch(starter.body, /ignored/);

  const legacy = buildNoticeDraft(row, "Example Bank", "ABC123");
  assert.equal(legacy.documentFormat, "");
  assert.match(legacy.body, /LEGAL NOTICE/);
});

test("staff can add a named legal notice, and a one-bank name is refused", () => {
  const ok = draftLegalNoticeTemplate({
    name: "  Section 138 notice  ",
    body: "Under instructions from our client {{bank_name}}, pay the overdue amount on loan {{loan_number}}.",
    existingNames: ["Legal notice"],
  });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.name, "Section 138 notice");

  const duplicate = draftLegalNoticeTemplate({
    name: "legal notice",
    body: "Under instructions from our client {{bank_name}}, this is a different notice about loan {{loan_number}} today.",
    existingNames: ["Legal notice"],
  });
  assert.equal(duplicate.ok, false);

  const namedBank = draftLegalNoticeTemplate({
    name: "Northwind recall",
    body: "Under instructions from our client {{bank_name}}, pay the overdue amount on loan {{loan_number}}.",
    existingNames: [],
  });
  assert.equal(namedBank.ok, false);

  const ordered = sortLegalNotices([
    { name: "Zebra notice", seedKey: null },
    { name: "Legal notice", seedKey: "firm-legal-notice" },
    { name: "Alpha notice", seedKey: null },
  ]);
  assert.deepEqual(
    ordered.map((row) => row.name),
    ["Legal notice", "Alpha notice", "Zebra notice"],
  );
  assert.equal(legalNoticeChoiceLabel({ name: "Legal notice", seedKey: "firm-legal-notice" }), "Legal notice (current notice)");
});

test("legal notice templates are a separate place for the owner and the legal coordinator", () => {
  for (const role of [ROLE_OWNER, ROLE_COORDINATOR]) {
    const link = workspaceNav(role).find((item) => item.href === "/legal-notices");
    assert.equal(link?.label, "Legal notice templates");
  }
  assert.equal(workspaceNav(ROLE_BANK_USER).some((item) => item.href === "/legal-notices"), false);

  const page = readFileSync(new URL("../app/legal-notices/page.tsx", import.meta.url), "utf8");
  const action = readFileSync(new URL("../app/actions/legal-notices.ts", import.meta.url), "utf8");
  const send = readFileSync(new URL("../app/send/page.tsx", import.meta.url), "utf8");
  const form = readFileSync(new URL("../components/campaign-form.tsx", import.meta.url), "utf8");
  assert.match(page, /Legal notice templates/);
  assert.match(page, /isBankUser/);
  assert.match(page, /canSendNotices/);
  assert.doesNotMatch(page, /MSG91|DLT|flow id|Northwind/);
  assert.match(action, /canSendNotices/);
  assert.match(form, /Choose the legal notice/);
  assert.match(form, /legalNoticeTemplateId/);
  assert.match(send, /choose the legal notice/i);
  assert.doesNotMatch(form, /MSG91|DLT/);
});
