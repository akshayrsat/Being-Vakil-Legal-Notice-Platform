import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { indianMobileDigits, validEmail } from "./contact";
import { redactCell } from "./data-min";
import { maskEmail, maskMobile } from "./mask";
import { flagOdrDuplicates, mapOdrRows, ODR_SHEET_FIELDS, type OdrFieldMapping, type OdrMappedRow } from "./odr-fields";
import { planOdrChannels } from "./odr-plan";
import { canCorrectOrErase, canEditPrivacyRequests, canReadIncidents, canReadPrivacyRequests, requestDueAt } from "./privacy-access";
import { privacyOfficerLabel, privacyPurposeLine } from "./privacy-copy";
import { accessLogExpired, confirmWord, eraseAuditSummary, personMatchesHold, retentionCutoff } from "./privacy-keys";
import { redactRawSheet } from "./privacy-person";
import { ROLE_BANK_USER, ROLE_COORDINATOR, ROLE_OWNER } from "./roles";
import { sessionCookieSecure } from "./session-cookie";
import { lockoutAfterFailure, verifyLockMessage, PRIVACY_PHONE } from "./verify-lock";

function blankMapping(partial: Partial<OdrFieldMapping>): OdrFieldMapping {
  const mapping = Object.fromEntries(ODR_SHEET_FIELDS.map((field) => [field.key, ""])) as OdrFieldMapping;
  return { ...mapping, ...partial };
}

function row(partial: Partial<OdrMappedRow>): OdrMappedRow {
  return {
    rowNumber: 2,
    refNo: "",
    customerName: "Ravi",
    coParties: "",
    co1Name: "",
    co1Role: "",
    co1Mobile: "",
    co1Email: "",
    co1Address: "",
    co2Name: "",
    co2Role: "",
    co2Mobile: "",
    co2Email: "",
    co2Address: "",
    accountNumber: "1234567890",
    branch: "",
    mobile: "9876543210",
    email: "ravi@example.com",
    address: "",
    loanAmount: "",
    claimAmount: "",
    asOnDate: "",
    disputeSummary: "",
    problems: [],
    ...partial,
  };
}

test("session cookie is Secure in production and on an https public URL", () => {
  assert.equal(sessionCookieSecure({ nodeEnv: "production", publicBaseUrl: "http://localhost" }), true);
  assert.equal(sessionCookieSecure({ nodeEnv: "development", publicBaseUrl: "https://notice.example" }), true);
  assert.equal(sessionCookieSecure({ nodeEnv: "development", publicBaseUrl: "http://localhost:3000" }), false);
  const auth = readFileSync(new URL("../app/actions/auth.ts", import.meta.url), "utf8");
  assert.match(auth, /token:\s*hashResetToken\(token\)/);
  assert.match(auth, /sessionCookieOptions\(\{/);
});

test("five wrong last-4 tries lock the link, and the next block lasts longer", () => {
  const now = new Date("2026-10-07T10:00:00.000Z");
  let failures = 0;
  let locked: Date | null = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const next = lockoutAfterFailure({ failures, now });
    failures = next.failures;
    locked = next.lockedUntil;
    assert.equal(locked, null);
  }
  const fifth = lockoutAfterFailure({ failures, now });
  assert.equal(fifth.failures, 5);
  assert.equal(fifth.lockedUntil?.getTime(), now.getTime() + 30 * 60 * 1000);
  const tenth = lockoutAfterFailure({ failures: 9, now });
  assert.equal(tenth.lockedUntil?.getTime(), now.getTime() + 60 * 60 * 1000);
  const message = verifyLockMessage(fifth.lockedUntil ?? now);
  assert.match(message, new RegExp(PRIVACY_PHONE.replace("+", "\\+")));
  assert.match(message, /locked until/i);
});

test("a mobile must be 10 Indian digits and an email must look like an email", () => {
  assert.equal(indianMobileDigits("+91 98765 43210"), "9876543210");
  assert.equal(indianMobileDigits("09876543210"), "9876543210");
  assert.equal(indianMobileDigits("12345"), null);
  assert.equal(indianMobileDigits(""), null);
  assert.equal(validEmail("ravi@example.com"), true);
  assert.equal(validEmail("not-an-email"), false);
  assert.equal(validEmail(""), false);
  const mapped = mapOdrRows(
    ["Name", "Account", "Mobile", "Email"],
    [["Ravi", "1234567890", "12345", "not-an-email"]],
    blankMapping({ customerName: "Name", accountNumber: "Account", mobile: "Mobile", email: "Email" }),
  );
  assert.match(mapped[0]?.problems.join(" ") ?? "", /10 digits/);
  assert.match(mapped[0]?.problems.join(" ") ?? "", /not valid/);
});

test("duplicate accounts and supplied references are left out and not replaced", () => {
  const flagged = flagOdrDuplicates(
    [
      row({ accountNumber: "ACC1", refNo: "REF1" }),
      row({ rowNumber: 3, accountNumber: "ACC1", refNo: "REF2" }),
      row({ rowNumber: 4, accountNumber: "ACC2", refNo: "TAKEN" }),
      row({ rowNumber: 5, accountNumber: "OPEN1", refNo: "" }),
    ],
    { openAccounts: ["open1"], refs: ["taken"] },
  );
  assert.match(flagged[1]?.problems.join(" ") ?? "", /already in this file/);
  assert.match(flagged[2]?.problems.join(" ") ?? "", /was not replaced/);
  assert.match(flagged[3]?.problems.join(" ") ?? "", /open case/);
  assert.equal(flagged[0]?.problems.length, 0);
});

test("review passes the hearing slot and the skipped button is labelled", () => {
  const preview = readFileSync(new URL("../app/odr/uploads/[id]/preview/page.tsx", import.meta.url), "utf8");
  assert.match(preview, /templateSlot\(batch\.matterType,\s*"first"\)/);
  assert.match(preview, /planOdrChannels\(\{[^}]*\bslot\b/);
  assert.match(preview, /Left out/);
  const form = readFileSync(new URL("../components/odr-case-forms.tsx", import.meta.url), "utf8");
  assert.match(form, /Record hearings, do not send/);
  const upload = readFileSync(new URL("../components/odr-upload-form.tsx", import.meta.url), "utf8");
  assert.match(upload, /useState\(""\)/);
  assert.doesNotMatch(upload, /useState\("ARBITRATION"\)/);
  const approved = planOdrChannels({
    live: true,
    mobile: "9876543210",
    email: "ravi@example.com",
    templates: { smsFlowId: "flow", emailTemplateId: "arbitration_first_hearing", whatsappTemplate: "arbitration_first_hearing" },
    slot: "arbitration.first",
  });
  assert.equal(approved.every((item) => item.status === "QUEUED"), true);
  const unnamed = planOdrChannels({
    live: true,
    mobile: "9876543210",
    email: "ravi@example.com",
    templates: { smsFlowId: "flow", emailTemplateId: "mail", whatsappTemplate: "wa" },
  });
  assert.equal(unnamed.every((item) => item.status === "QUEUED"), true);
});

test("only the footer image avoids a page break in print", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const print = css.slice(css.indexOf("@media print"));
  assert.match(print, /\.notice-closing,\s*\n\s*\.notice-sign,\s*\n\s*\.notice-grievance\s*\{[^}]*break-inside:\s*auto/);
  assert.match(print, /\.notice-letterfoot\s*\{[^}]*break-inside:\s*avoid/);
});

test("a 12-digit value is redacted unless the column is a phone", () => {
  assert.equal(redactCell("919876543210"), "XXXX-XXXX-3210");
  assert.equal(redactCell("919876543210", { phone: true }), "919876543210");
  assert.equal(maskMobile("9876543210"), "••••••3210");
  assert.equal(maskEmail("ravi@example.com"), "r•••@example.com");
});

test("privacy permissions and the request due date", () => {
  assert.equal(canReadPrivacyRequests(ROLE_BANK_USER), true);
  assert.equal(canEditPrivacyRequests(ROLE_BANK_USER), false);
  assert.equal(canCorrectOrErase(ROLE_COORDINATOR), true);
  assert.equal(canCorrectOrErase(ROLE_BANK_USER), false);
  assert.equal(canReadIncidents(ROLE_OWNER), true);
  assert.equal(canReadIncidents(ROLE_COORDINATOR), false);
  const created = new Date("2026-10-01T00:00:00.000Z");
  assert.equal(requestDueAt(created, 30).toISOString(), "2026-10-31T00:00:00.000Z");
  assert.equal(requestDueAt(created, 0).toISOString(), "2026-10-31T00:00:00.000Z");
  assert.equal(privacyOfficerLabel(""), "Privacy officer, Being Vakil Associates");
  assert.match(privacyPurposeLine("notice"), /on behalf of the bank/);
  assert.equal(confirmWord("ERASE", "ERASE"), true);
  assert.equal(confirmWord("erase", "ERASE"), false);
  const summary = eraseAuditSummary({ case: 1 });
  assert.match(summary, /not stored in this log/);
  assert.equal(summary.includes("9876543210"), false);
});

test("retention waits a full year and a legal hold matches the person", () => {
  const now = new Date("2027-10-07T00:00:00.000Z");
  const almost = new Date("2026-10-08T00:00:00.000Z");
  const old = new Date("2026-10-06T00:00:00.000Z");
  assert.equal(accessLogExpired(almost, now), false);
  assert.equal(accessLogExpired(old, now), true);
  assert.equal(retentionCutoff(now, 0), null);
  assert.equal(
    personMatchesHold([{ accountKey: "LN1", mobileKey: "9876543210", emailKey: "" }], { account: "ln1", mobile: "+91 98765 43210" }),
    true,
  );
  assert.equal(personMatchesHold([{ accountKey: "LN1", mobileKey: "", emailKey: "" }], { mobile: "9876543210" }), false);
});

test("spreadsheet erasure removes the matched cell and keeps the rest", () => {
  const raw = JSON.stringify([["Ravi", "9876543210"], ["Asha", "9811111111"]]);
  const next = JSON.parse(redactRawSheet(raw, {
    text: "9876543210",
    mobile: "9876543210",
    email: "",
    accounts: [],
    mobiles: ["9876543210"],
  })) as string[][];
  assert.equal(next[0]?.[1], "");
  assert.equal(next[1]?.[1], "9811111111");
});

test("the privacy migration runs on SQLite and drops old session tokens", () => {
  const sql = readFileSync(new URL("../../prisma/migrations/20261007140000_privacy_and_session_hash/migration.sql", import.meta.url), "utf8");
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE "Bank" ("id" TEXT NOT NULL PRIMARY KEY);`);
  db.exec(`INSERT INTO "Bank" ("id") VALUES ('b1');`);
  db.exec(`CREATE TABLE "Session" ("id" TEXT NOT NULL PRIMARY KEY, "token" TEXT NOT NULL);`);
  db.exec(`INSERT INTO "Session" ("id", "token") VALUES ('s1', 'plaintext-token');`);
  db.exec(sql);
  const sessions = db.prepare(`SELECT COUNT(*) AS n FROM "Session"`).get() as { n: number };
  assert.equal(Number(sessions.n), 0);
  db.exec(`INSERT INTO "VerifyLock" ("id", "scope", "subject", "failures", "updatedAt") VALUES ('v1', 'notice', 'N1', 1, CURRENT_TIMESTAMP);`);
  db.exec(`INSERT INTO "BankRetention" ("bankId", "legalHold", "updatedAt") VALUES ('b1', false, CURRENT_TIMESTAMP);`);
  db.exec(`INSERT INTO "PersonLegalHold" ("id", "bankId", "active", "createdAt") VALUES ('h1', 'b1', true, CURRENT_TIMESTAMP);`);
  const hold = db.prepare(`SELECT "legalHold" AS hold FROM "BankRetention"`).get() as { hold: number | boolean };
  assert.equal(Number(hold.hold), 0);
  db.close();
});
