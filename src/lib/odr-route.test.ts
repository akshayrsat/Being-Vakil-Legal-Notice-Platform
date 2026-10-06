import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import JSZip from "jszip";
import { hearingMessageText } from "./odr-templates";
import {
  CONCILIATION_STATUS_LINE,
  INSTALMENT_WARNING,
  SAME_NEUTRAL_BAR,
  caseTimers,
  conciliationDocumentsReady,
  conciliationState,
  exParteAllowed,
  hearingsAllowed,
  instalmentMonthSpan,
  legalRouteLabel,
  matterTypeForRoute,
  neutralRoleError,
  neutralRoleForRoute,
  outcomeKind,
  resolveLegalRoute,
  sameNeutralBar,
  settlementGuard,
} from "./odr-route";

test("a blank route follows the older matter type, and only arbitration allows ex parte", () => {
  assert.equal(resolveLegalRoute("", "MEDIATION"), "MEDIATION");
  assert.equal(resolveLegalRoute("CONCILIATION", "ARBITRATION"), "CONCILIATION");
  assert.equal(matterTypeForRoute("LOK_ADALAT"), "MEDIATION");
  assert.equal(exParteAllowed("ARBITRATION"), true);
  assert.equal(exParteAllowed("", "MEDIATION"), false);
  assert.equal(exParteAllowed("CONCILIATION", "MEDIATION"), false);
  assert.equal(exParteAllowed("LOK_ADALAT"), false);
  assert.equal(hearingsAllowed("LOK_ADALAT"), false);
  assert.equal(hearingsAllowed("CONCILIATION"), true);
  assert.equal(outcomeKind("CONCILIATION"), "conciliation");
  assert.equal(outcomeKind("", "MEDIATION"), "settlement");
  assert.equal(legalRouteLabel("MEDIATION"), "Contractual mediation");
});

test("a conciliator or mediator cannot later be the arbitrator on the same case", () => {
  assert.equal(sameNeutralBar({ nextRole: "ARBITRATOR", priorRoles: ["CONCILIATOR"] }), SAME_NEUTRAL_BAR);
  assert.equal(sameNeutralBar({ nextRole: "ARBITRATOR", priorRoles: ["MEDIATOR"] }), SAME_NEUTRAL_BAR);
  assert.equal(sameNeutralBar({ nextRole: "ARBITRATOR", priorRoles: ["ARBITRATOR"] }), "");
  assert.equal(sameNeutralBar({ nextRole: "CONCILIATOR", priorRoles: ["MEDIATOR"] }), "");
  assert.equal(neutralRoleForRoute("MEDIATION"), "MEDIATOR");
  assert.match(neutralRoleError("ARBITRATOR", "CONCILIATOR"), /conciliator/);
  assert.equal(neutralRoleError("ARBITRATOR,CONCILIATOR", "CONCILIATOR"), "");
});

test("Section 29A, Section 34, the process deadline, and limitation are dated from the case", () => {
  const now = new Date("2026-10-06T04:30:00.000Z");
  const open = caseTimers({
    route: "ARBITRATION",
    pleadingsClosedOn: "2026-01-15",
    awardExtension: false,
    awardDeliveredOn: "",
    processDeadlineOn: "",
    limitationDate: "2027-02-01",
    now,
  });
  assert.equal(open.awardDeadline, "2027-01-15");
  assert.match(open.awardNote, /12 months/);
  assert.match(open.section34Note, /not on the case yet/);
  const extended = caseTimers({
    route: "ARBITRATION",
    pleadingsClosedOn: "2026-01-15",
    awardExtension: true,
    awardDeliveredOn: "2026-10-01",
    processDeadlineOn: "",
    limitationDate: "2026-12-01",
    now,
  });
  assert.equal(extended.awardDeadline, "2027-07-15");
  assert.equal(extended.section34Deadline, "2027-01-01");
  assert.match(extended.limitationWarning, /6 months/);
  const mediation = caseTimers({
    route: "CONCILIATION",
    pleadingsClosedOn: "2026-01-15",
    awardExtension: false,
    awardDeliveredOn: "",
    processDeadlineOn: "2026-12-01",
    limitationDate: "2026-09-01",
    now,
  });
  assert.equal(mediation.awardDeadline, "");
  assert.equal(mediation.processDeadline, "2026-12-01");
  assert.match(mediation.limitationWarning, /passed/);
});

test("a settlement needs the bank sanction, and instalments over 3 months warn", () => {
  assert.match(settlementGuard({ sanctionRef: "", instalmentMonths: 2 }).error, /sanction reference/);
  assert.equal(settlementGuard({ sanctionRef: "OTS/12", instalmentMonths: 2 }).error, "");
  assert.equal(settlementGuard({ sanctionRef: "OTS/12", instalmentMonths: 4 }).warning, INSTALMENT_WARNING);
  assert.equal(instalmentMonthSpan(["2026-01-01", "2026-05-01"]), 4);
  assert.match(CONCILIATION_STATUS_LINE, /Section 74/);
  assert.match(conciliationDocumentsReady(["CONCILIATOR_CONSENT"]), /confidentiality undertaking/);
  assert.equal(conciliationDocumentsReady(["CONCILIATOR_CONSENT", "CONCILIATOR_DISCLOSURE", "CONFIDENTIALITY_UNDERTAKING"]), "");
});

test("conciliation is declined when any respondent says no, or when 30 days pass in silence", () => {
  const invited = new Date("2026-09-01T04:30:00.000Z");
  const pending = conciliationState({
    route: "CONCILIATION",
    now: new Date("2026-09-10T04:30:00.000Z"),
    invitedAt: invited,
    parties: [
      { id: "", name: "Ravi", reply: { choice: "ACCEPT", recordedAt: invited } },
      { id: "g", name: "Guarantor", reply: null },
    ],
  });
  assert.equal(pending.phase, "pending");
  const late = conciliationState({
    route: "CONCILIATION",
    now: new Date("2026-10-06T04:30:00.000Z"),
    invitedAt: invited,
    parties: [
      { id: "", name: "Ravi", reply: { choice: "ACCEPT", recordedAt: invited } },
      { id: "g", name: "Guarantor", reply: null },
    ],
  });
  assert.equal(late.phase, "declined");
  assert.match(late.note, /Section 62/);
  const accepted = conciliationState({
    route: "CONCILIATION",
    now: new Date("2026-09-10T04:30:00.000Z"),
    invitedAt: invited,
    parties: [
      { id: "", name: "Ravi", reply: { choice: "ACCEPT", recordedAt: invited } },
      { id: "g", name: "Guarantor", reply: { choice: "ACCEPT", recordedAt: invited } },
    ],
  });
  assert.equal(accepted.phase, "accepted");
  assert.equal(conciliationState({
    route: "ARBITRATION",
    now: invited,
    invitedAt: invited,
    parties: [],
  }).required, false);
});

test("conciliation and Lok Adalat notices do not use arbitration wording", () => {
  const shared = {
    customer: "Ravi Shah",
    bank: "Northwind",
    number: "CON-1",
    date: "6 October 2026",
    time: "10:00 am",
    meetLink: "",
    caseLink: "https://example.test/case",
    ordinal: "first",
    matterType: "MEDIATION",
    kind: "first" as const,
  };
  const conciliation = hearingMessageText({ ...shared, legalRoute: "CONCILIATION" });
  assert.match(conciliation, /Section 62/);
  assert.match(conciliation, /30 days/);
  assert.doesNotMatch(conciliation, /remain present|ex parte/i);
  const lok = hearingMessageText({ ...shared, legalRoute: "LOK_ADALAT" });
  assert.match(lok, /Lok Adalat/);
  assert.match(lok, /not held on this page/);
});

test("the conciliation settlement keeps the settlement markup and states the Section 74 effect", async () => {
  const bytes = await readFile(path.join(process.cwd(), "templates", "odr", "Conciliation_Settlement_Template.docx"));
  const xml = await JSZip.loadAsync(bytes).then((zip) => zip.file("word/document.xml")?.async("string") ?? "");
  assert.match(xml, /Conciliation Settlement Agreement/);
  assert.match(xml, new RegExp(CONCILIATION_STATUS_LINE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(xml, /\{\{mediator_name\}\}/);
  assert.match(xml, /\[\[IF mediation_act_applicable\]\]/);
  assert.match(xml, /\[\[REPEAT obligors\]\]/);
  const runs = xml.match(/<w:t[^>]*>[^<]*<\/w:t>/g) ?? [];
  for (const run of runs) {
    const text = run.replace(/<[^>]+>/g, "");
    assert.equal(text.split("{{").length - 1, text.split("}}").length - 1, text);
  }
});
