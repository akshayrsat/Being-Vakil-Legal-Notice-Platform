import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderNoticePdf, noticePdfPageCount, NOTICE_BODY_PT, NOTICE_MARGIN_PT } from "./notice-pdf";
import { LEGAL_NOTICE_FORMAT_TEXT } from "./legal-notice-templates";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const pdfSource = readFileSync(new URL("./notice-pdf.ts", import.meta.url), "utf8");
const letter = readFileSync(new URL("../components/notice-letter.tsx", import.meta.url), "utf8");
const letterhead = readFileSync(new URL("./letterhead.ts", import.meta.url), "utf8");

test("the on-screen letter is A4, 12pt Times, and is not locked to one page", () => {
  assert.match(css, /font-family:\s*"Times New Roman", Times, serif/);
  assert.match(css, /\.notice-copy\s*\{[^}]*font-size:\s*12pt/);
  assert.match(css, /\.notice-copy\s*\{[^}]*line-height:\s*1\.45/);
  assert.match(css, /@page\s*\{[^}]*size:\s*A4/);
  assert.match(css, /margin:\s*19mm/);
  assert.match(css, /letterhead-header\.png|notice-letterhead/);
  assert.equal(css.includes("font-size: 9.4pt"), false);
  assert.equal(css.includes("font-size: 8.5pt"), false);
  assert.equal(css.includes("max-height: 18mm"), false);
  assert.equal(/(?<!min-)height:\s*297mm/.test(css), false);
  const sheet = css.slice(css.indexOf(".notice-sheet {"), css.indexOf(".notice-letterhead"));
  assert.equal(sheet.includes("overflow: hidden"), false);
  assert.equal(/(?<!min-)height:\s*297mm/.test(sheet), false);
  assert.match(sheet, /min-height:\s*297mm/);
  assert.match(sheet, /overflow:\s*visible/);
  const print = css.slice(css.indexOf("@media print"));
  const sheetStart = print.indexOf(".notice-sheet {");
  const printSheet = print.slice(sheetStart, print.indexOf("}", sheetStart));
  assert.equal(printSheet.includes("break-inside: avoid"), false);
  assert.equal(printSheet.includes("page-break-after: avoid"), false);
  assert.match(printSheet, /height:\s*auto/);
  assert.match(letter, /\/branding\/letterhead-header\.png/);
  assert.match(letter, /\/branding\/letterhead-footer\.png/);
  assert.match(letter, /FIRM_TAGLINE/);
  assert.match(letterhead, /Being Vakil Associates/);
  assert.match(letterhead, /Empowering You, Protecting You, Being Vakil!/);
});

test("a long notice PDF stays on A4 at 12pt and continues onto another page", async () => {
  const paragraph =
    "Under instructions from our client Meridian Co-operative Bank, you are called upon to pay the overdue amount on the loan facility. This paragraph is the full wording and is not shortened to fit a single sheet.";
  const filledBody = Array.from({ length: 28 }, (_, index) => `${index + 1}. ${paragraph}`).join("\n\n");
  const pdf = await renderNoticePdf({
    documentFormat: LEGAL_NOTICE_FORMAT_TEXT,
    filledBody,
    customerName: "Ajit Dhoble",
    address: "12 Linking Road, Mumbai 400050",
    outstandingAmount: "125000",
    loanNumber: "MCB-88421",
    bankName: "Meridian Co-operative Bank",
    loanType: "Personal loan",
    referenceNumber: "9T7JZC57PS76",
    collectionManager: "",
    collectionManagerMobile: "",
    bankWebsite: "",
    noticeNumber: "9T7JZC57PS76",
    dated: new Date("2026-09-01T00:00:00+05:30"),
    grievance: {
      officerName: "",
      officerPhone: "",
      officerEmail: "",
      ombudsman: "",
      wordingApprovedOn: "",
    },
  });
  assert.equal(NOTICE_BODY_PT, 12);
  assert.ok(NOTICE_MARGIN_PT >= 54 && NOTICE_MARGIN_PT <= 72);
  assert.ok(noticePdfPageCount(pdf) >= 2);
  assert.match(pdf.toString("latin1"), /\/MediaBox \[0 0 595\.28 841\.89\]/);
  assert.equal(pdfSource.includes("fontSize(9)"), false);
  assert.equal(pdfSource.includes("fontSize(10)"), false);
  assert.equal(pdfSource.includes("fontSize(11)"), false);
  assert.equal(pdfSource.includes("fit: [499, 110]"), false);
  assert.equal(pdfSource.includes("fit: [499, 90]"), false);
  assert.match(pdfSource, /letterhead-header\.png/);
  assert.match(pdfSource, /letterhead-footer\.png/);
});
