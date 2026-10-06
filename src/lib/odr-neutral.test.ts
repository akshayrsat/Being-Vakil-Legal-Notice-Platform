import assert from "node:assert/strict";
import test from "node:test";
import { planOdrChannels } from "./odr-plan";
import { contactsForHearing, indianMobileDigits, neutralContactError, neutralEditSummary } from "./odr-neutral";

const saved = [
  { id: "n1", name: "A. Rao", email: "rao@example.com", mobile: "9876543210" },
  { id: "n2", name: "L. Kapoor", email: "leela@example.com", mobile: "9811112233" },
  { id: "n3", name: "S. Iyer", email: "iyer@example.com", mobile: "9123456780" },
];

test("a 10-digit Indian mobile is kept, and a short or non-mobile number is refused", () => {
  assert.equal(indianMobileDigits("98765 43210"), "9876543210");
  assert.equal(indianMobileDigits("+91 9876543210"), "9876543210");
  assert.equal(indianMobileDigits("09876543210"), "9876543210");
  assert.equal(indianMobileDigits("5876543210"), null);
  assert.equal(indianMobileDigits("987654321"), null);
  assert.equal(neutralContactError({ email: "rao@example.com", mobile: "9876543210" }), null);
  assert.equal(neutralContactError({ email: "rao@example.com", mobile: "12345" }), "Enter a 10-digit Indian mobile number.");
  assert.equal(neutralContactError({ email: "not-an-email", mobile: "9876543210" }), "Enter the arbitrator’s email.");
});

test("upload, a case, a panel, and a panel choice use the saved email and mobile", () => {
  const sole = contactsForHearing({ panelIds: ["n1"], assignedId: "n1", saved });
  assert.deepEqual(sole.map((person) => person.email), ["rao@example.com"]);
  assert.deepEqual(sole.map((person) => person.mobile), ["9876543210"]);
  const panel = contactsForHearing({ panelIds: ["n1", "n2", "n3"], assignedId: "n1", saved });
  assert.deepEqual(panel.map((person) => person.mobile), ["9876543210", "9811112233", "9123456780"]);
  const reassigned = contactsForHearing({ panelIds: ["n2"], assignedId: "n2", saved });
  assert.equal(reassigned[0]?.email, "leela@example.com");
  assert.equal(reassigned.some((person) => person.email === "customer@example.com"), false);
  const templates = { smsFlowId: "sms-flow", emailTemplateId: "email-id", whatsappTemplate: "wa" };
  const plans = planOdrChannels({
    live: false,
    email: reassigned[0]!.email,
    mobile: reassigned[0]!.mobile,
    templates,
  }).filter((plan) => plan.channel !== "WHATSAPP");
  assert.deepEqual(plans.map((plan) => [plan.channel, plan.to]), [
    ["SMS", "919811112233"],
    ["EMAIL", "leela@example.com"],
  ]);
  assert.equal(plans.every((plan) => plan.detail === "not sent (ODR sending off)"), true);
});

test("an edit records what changed, including a new email", () => {
  const before = {
    name: "A. Rao",
    qualification: "Advocate",
    enrolmentNo: "MH/1",
    email: "rao@example.com",
    mobile: "9876543210",
    active: true,
  };
  assert.equal(neutralEditSummary(before, before), "");
  assert.equal(
    neutralEditSummary(before, { ...before, email: "rao.new@example.com" }),
    "Changed email from rao@example.com to rao.new@example.com.",
  );
  assert.equal(
    neutralEditSummary(before, { ...before, mobile: "9810098100", active: false }),
    "Changed mobile from 9876543210 to 9810098100. Marked inactive.",
  );
  assert.equal(
    neutralEditSummary(
      { ...before, roles: "ARBITRATOR", empanelment: "" },
      { ...before, roles: "ARBITRATOR,CONCILIATOR", empanelment: "DLSA panel" },
    ),
    "Changed roles from ARBITRATOR to ARBITRATOR,CONCILIATOR, empanelment from blank to DLSA panel.",
  );
});
