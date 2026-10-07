import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ROLE_BANK_USER,
  ROLE_BANK_VIEWER,
  ROLE_COORDINATOR,
  ROLE_OWNER,
} from "./roles";
import {
  confirmWarning,
  isSendNoticePath,
  legacySendEntry,
  SEND_NOTICE_LABEL,
  SEND_STEPS,
  spreadsheetAction,
  workspaceNav,
  wordingHref,
} from "./send-notice";

const FALSE_OFF = ["MSG91 switched off", "Confirming with live send off records a dry run"];

test("staff navigation has one Send notice item and no Loans, Uploads, or Campaigns tab", () => {
  for (const role of [ROLE_OWNER, ROLE_COORDINATOR]) {
    const links = workspaceNav(role);
    const labels = links.map((link) => link.label);
    assert.equal(labels.filter((label) => label === SEND_NOTICE_LABEL).length, 1);
    assert.equal(labels.includes("Loans"), false);
    assert.equal(labels.includes("Uploads"), false);
    assert.equal(labels.includes("Campaigns"), false);
    assert.equal(
      labels.some((label) => /campaign/i.test(label)),
      false,
    );
    assert.equal(links.some((link) => link.href === "/loans"), false);
    assert.equal(links.some((link) => link.href === "/uploads"), false);
    assert.equal(links.some((link) => link.href === "/campaigns"), false);
  }
  for (const role of [ROLE_BANK_USER, ROLE_BANK_VIEWER]) {
    const labels = workspaceNav(role).map((link) => link.label);
    assert.equal(labels.includes(SEND_NOTICE_LABEL), false);
    assert.equal(labels.includes("Templates"), false);
    assert.equal(labels.includes("Loans"), false);
  }
});

test("owner sees Settings, Audit, People, and Banks; a coordinator cannot change firm settings", () => {
  const owner = workspaceNav(ROLE_OWNER).map((link) => link.href);
  assert.equal(owner.includes("/settings"), true);
  assert.equal(owner.includes("/audit"), true);
  assert.equal(owner.includes("/people"), true);
  assert.equal(owner.includes("/banks"), true);

  const coordinator = workspaceNav(ROLE_COORDINATOR).map((link) => link.href);
  assert.equal(coordinator.includes("/people"), true);
  assert.equal(coordinator.includes("/banks"), true);
  assert.equal(coordinator.includes("/settings"), false);
  assert.equal(coordinator.includes("/audit"), false);

  const ownerOnly = new Set(["/settings", "/audit"]);
  assert.deepEqual(
    coordinator,
    owner.filter((href) => !ownerOnly.has(href)),
  );

  const bankUser = workspaceNav(ROLE_BANK_USER).map((link) => link.href);
  assert.equal(bankUser.includes("/people"), false);
  assert.equal(bankUser.includes("/banks"), false);
  assert.equal(bankUser.includes("/settings"), false);
  assert.equal(bankUser.includes("/audit"), false);
});

test("send steps stay in plain order and old list pages return to Send notice", () => {
  assert.deepEqual(
    SEND_STEPS.map((step) => step.title),
    [
      "Choose the spreadsheet of people",
      "Choose SMS, email, and WhatsApp",
      "Choose the legal notice",
      "Review who will get it",
      "Send",
    ],
  );
  assert.equal(legacySendEntry("/uploads"), "/send");
  assert.equal(legacySendEntry("/campaigns"), "/send");
  assert.equal(legacySendEntry("/campaigns/new", "?batch=batch_1"), "/send?batch=batch_1");
  assert.equal(legacySendEntry("/campaigns/new", "?batch=../other"), "/send");
  assert.equal(legacySendEntry("/campaigns/abc"), null);
  assert.equal(isSendNoticePath("/uploads/batch_1"), true);
  assert.equal(isSendNoticePath("/campaigns/abc"), true);
  assert.equal(isSendNoticePath("/loans"), false);
  assert.equal(wordingHref("batch_1"), "/send?batch=batch_1");
  assert.equal(spreadsheetAction({ id: "batch_1", saved: true }, true).label, "Choose the wording");
});

test("the send screen says the truth about live send", () => {
  const off = confirmWarning({ switchOn: false, authKeySet: true });
  assert.match(off, /dry run/i);
  assert.match(off, /Nothing is sent/);

  const on = confirmWarning({ switchOn: true, authKeySet: true });
  assert.match(on, /for real/);
  for (const phrase of FALSE_OFF) {
    assert.equal(on.includes(phrase), false);
    assert.equal(off.includes(phrase), false);
  }

  const missingKey = confirmWarning({ switchOn: true, authKeySet: false });
  assert.match(missingKey, /Live send is on/);
  assert.equal(missingKey.includes("switched off"), false);

  const page = readFileSync(new URL("../app/send/page.tsx", import.meta.url), "utf8");
  assert.match(page, /liveSendIsOn/);
  assert.match(page, /confirmWarning/);
  for (const phrase of FALSE_OFF) assert.equal(page.includes(phrase), false);

  const home = readFileSync(new URL("../components/dashboard-home.tsx", import.meta.url), "utf8");
  assert.equal(home.includes('href="/loans"'), false);
});
