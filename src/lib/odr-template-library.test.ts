import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ROLE_BANK_USER, ROLE_COORDINATOR, ROLE_OWNER } from "./roles";
import { ODR_TEMPLATES_HREF, workspaceNav } from "./send-notice";
import { defaultTemplateMap } from "./odr-templates";
import {
  odrLibraryDetail,
  odrTemplateLibrary,
  parseOdrLibraryId,
  pendingOdrTemplates,
  selectableOdrTemplates,
} from "./odr-template-library";

test("the first arbitration email and WhatsApp are selectable, and the rest stay pending", () => {
  const items = odrTemplateLibrary(defaultTemplateMap({}));
  const approved = selectableOdrTemplates(items);
  assert.deepEqual(
    approved.map((item) => item.id),
    ["arbitration-first-email", "arbitration-first-whatsapp"],
  );
  assert.equal(approved.every((item) => item.status === "APPROVED"), true);
  assert.match(approved[0]?.body ?? "", /Subject: First Arbitration Hearing/);
  assert.match(approved[1]?.body ?? "", /first hearing is scheduled/);

  const pending = pendingOdrTemplates(items);
  const pendingIds = pending.map((item) => item.id);
  assert.equal(pendingIds.includes("arbitration-first-sms"), true);
  assert.equal(pendingIds.some((id) => id.startsWith("arbitration-next-")), true);
  assert.equal(pendingIds.some((id) => id.startsWith("arbitration-reminder-")), true);
  assert.equal(pendingIds.some((id) => id.startsWith("mediation-")), true);
  assert.equal(pending.every((item) => item.status === "PENDING"), true);
  assert.equal(selectableOdrTemplates(pending).length, 0);
  assert.match(pending.find((item) => item.id === "arbitration-first-sms")?.body ?? "", /not approved yet/);
});

test("a saved DLT flow id approves first-hearing SMS, and other slots stay pending", () => {
  const map = defaultTemplateMap({});
  map["arbitration.first"] = {
    ...map["arbitration.first"],
    smsFlowId: "6abf5af2e9226c340a0548e2",
  };
  map["mediation.first"] = {
    smsFlowId: "flow",
    emailTemplateId: "mediation_first",
    whatsappTemplate: "mediation_first",
  };
  map["arbitration.next"] = {
    smsFlowId: "next-flow",
    emailTemplateId: "arbitration_next_hearing",
    whatsappTemplate: "arbitration_next_hearing",
  };
  const items = odrTemplateLibrary(map);
  const approved = selectableOdrTemplates(items).map((item) => item.id);
  assert.deepEqual(approved, [
    "arbitration-first-email",
    "arbitration-first-whatsapp",
    "arbitration-first-sms",
  ]);
  assert.equal(selectableOdrTemplates(items).some((item) => item.id.startsWith("mediation-")), false);
  assert.equal(selectableOdrTemplates(items).some((item) => item.id.startsWith("arbitration-next-")), false);
  assert.equal(parseOdrLibraryId("mediation-first-email")?.slot, "mediation.first");
  assert.equal(parseOdrLibraryId("not-a-template"), null);
});

test("reference ids stay off the row unless the viewer is the owner admin", () => {
  const items = odrTemplateLibrary(defaultTemplateMap({}));
  const email = items.find((item) => item.id === "arbitration-first-email");
  const sms = items.find((item) => item.id === "arbitration-first-sms");
  assert.ok(email);
  assert.ok(sms);
  assert.equal(odrLibraryDetail(email, false), "Approved · Email");
  assert.equal(odrLibraryDetail(sms, false), "Pending · SMS");
  assert.equal(odrLibraryDetail(email, false).includes("arbitration_first_hearing"), false);
  assert.equal(odrLibraryDetail(email, true), "Approved · Email · Email template id arbitration_first_hearing");
  assert.equal(odrLibraryDetail(sms, true), "Pending · SMS · SMS flow id not set");
  const whatsapp = items.find((item) => item.id === "arbitration-first-whatsapp");
  assert.match(odrLibraryDetail(whatsapp!, true), /WhatsApp template arbitration_first_hearing · language en/);
});

test("ODR templates sit with the notice Templates tab, and a bank user does not see them", () => {
  for (const role of [ROLE_OWNER, ROLE_COORDINATOR]) {
    const links = workspaceNav(role);
    const labels = links.map((link) => link.label);
    assert.equal(labels[labels.indexOf("Templates") + 1], "ODR templates");
    assert.equal(links.find((link) => link.label === "ODR templates")?.href, ODR_TEMPLATES_HREF);
  }
  assert.equal(workspaceNav(ROLE_BANK_USER).some((link) => link.href === ODR_TEMPLATES_HREF), false);

  const page = readFileSync(new URL("../app/odr/templates/page.tsx", import.meta.url), "utf8");
  const detail = readFileSync(new URL("../app/odr/templates/[id]/page.tsx", import.meta.url), "utf8");
  const settings = readFileSync(new URL("../app/settings/page.tsx", import.meta.url), "utf8");
  const odrHome = readFileSync(new URL("../app/odr/page.tsx", import.meta.url), "utf8");
  assert.match(page, /isBankUser/);
  assert.match(page, /isOwnerAdmin/);
  assert.match(page, /selectableOdrTemplates/);
  assert.match(page, /pendingOdrTemplates/);
  assert.doesNotMatch(page, /setOdrLiveSwitch|ODR_LIVE_SEND|effectiveOdrLiveSend/);
  assert.match(detail, /showVendorDetail/);
  assert.doesNotMatch(settings, /Approved first-hearing wording/);
  assert.doesNotMatch(settings, /Subject: First Arbitration Hearing/);
  assert.match(settings, /ODR_TEMPLATES_HREF/);
  assert.match(settings, /Approved wording is on ODR templates/);
  assert.equal(odrHome.includes(ODR_TEMPLATES_HREF), true);
  assert.match(odrHome, /approvedWording/);
});
