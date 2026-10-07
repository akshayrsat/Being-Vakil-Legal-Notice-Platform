import assert from "node:assert/strict";
import test from "node:test";
import { campaignStatusLabel, deliveryStatusLabel } from "./campaigns";
import { confirmWarning, workspaceNav } from "./send-notice";
import {
  confirmButtonLabel,
  confirmHelp,
  hideVendorWording,
  seesVendorDetail,
} from "./staff-language";
import { alreadySent, assembleTimeline } from "./loan-timeline";
import { ROLE_BANK_USER, ROLE_COORDINATOR, ROLE_OWNER } from "./roles";

const VENDOR = /MSG91|DLT|webhook|dry run|dry-run|template id|flow id|legal_notice_non_payment|legal_notice_link/i;

test("a bank user gets tracking, reports, and privacy reads", () => {
  const hrefs = workspaceNav(ROLE_BANK_USER).map((link) => link.href);
  assert.deepEqual(hrefs, ["/dashboard", "/deliveries", "/reports", "/privacy/requests", "/privacy/find"]);
  assert.equal(workspaceNav(ROLE_COORDINATOR).some((link) => link.href === "/send"), true);
  assert.equal(workspaceNav(ROLE_OWNER).some((link) => link.href === "/settings"), true);
});

test("vendor wording stays with the owner", () => {
  assert.equal(seesVendorDetail({ role: ROLE_OWNER, email: "akshayrsat@gmail.com" }), true);
  assert.equal(seesVendorDetail({ role: ROLE_OWNER, email: "admin@noticedesk.local" }), false);
  assert.equal(seesVendorDetail({ role: ROLE_COORDINATOR, email: "akshayrsat@gmail.com" }), false);
  assert.equal(seesVendorDetail({ role: ROLE_BANK_USER, email: "viewer@noticedesk.local" }), false);

  const stored = "Handed to MSG91. DLT id 6abf5af2e9226c340a0548e2. Recorded on a dry run.";
  assert.equal(hideVendorWording(stored, true), stored);
  const plain = hideVendorWording(stored, false);
  assert.equal(VENDOR.test(plain), false);
  assert.match(plain, /Notice sent/);

  const coordinator = confirmWarning({ switchOn: true, authKeySet: true, technical: false });
  const owner = confirmWarning({ switchOn: false, authKeySet: true, technical: true });
  assert.equal(VENDOR.test(coordinator), false);
  assert.match(owner, /dry run/i);
  assert.equal(confirmButtonLabel(true, false, false), "Confirm, nothing is sent");
  assert.equal(confirmButtonLabel(true, true, false), "Confirm dry run");
  assert.equal(VENDOR.test(confirmHelp(false, false)), false);
  assert.match(confirmHelp(false, true), /MSG91/);

  assert.equal(deliveryStatusLabel("SIMULATED_SENT", false), "Not sent");
  assert.equal(deliveryStatusLabel("SIMULATED_SENT", true), "Dry run");
  assert.equal(campaignStatusLabel("COMPLETED", "DRY_RUN", false), "Recorded, nothing sent");
  assert.equal(campaignStatusLabel("COMPLETED", "DRY_RUN", true), "Dry run finished");
});

test("a bank user timeline keeps sent notices and drops an unsent one", () => {
  assert.equal(alreadySent("COMPLETED"), true);
  assert.equal(alreadySent("REVIEW"), false);
  assert.equal(alreadySent(""), false);

  const sent = assembleTimeline({
    technical: false,
    viewOnly: true,
    bankId: "bank-a",
    loan: "LN1",
    account: "",
    notices: [],
    deliveries: [
      {
        id: "d1",
        customerName: "Asha",
        loanNumber: "LN1",
        customerId: "C1",
        channel: "SMS",
        status: "SIMULATED_SENT",
        detail: "Handed to MSG91.",
        noticeNumber: "N1",
        openedAt: null,
        campaign: {
          id: "c1",
          templateName: "Demand",
          createdAt: new Date("2026-01-02T00:00:00Z"),
          confirmedAt: new Date("2026-01-02T00:00:00Z"),
          mode: "DRY_RUN",
        },
      },
    ],
    consignments: [
      {
        id: "sp1",
        customerName: "Asha",
        loanNumber: "LN1",
        customerId: "C1",
        articleNumber: "AB1",
        noticeNumber: "N1",
        events: [
          {
            id: "e1",
            status: "BOOKED",
            note: "MSG91 webhook",
            occurredAt: new Date("2026-01-03T00:00:00Z"),
            source: "manual",
          },
        ],
      },
    ],
  });
  assert.equal(sent.events.some((event) => event.kind === "channel"), true);
  assert.equal(sent.events.some((event) => event.href.includes("/speed-post/")), false);
  assert.equal(VENDOR.test(sent.events.map((event) => `${event.title} ${event.detail}`).join(" ")), false);
});
