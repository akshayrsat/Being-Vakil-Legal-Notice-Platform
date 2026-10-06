import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import { indiaDateTime } from "./odr-ref";
import { hearingMessageText } from "./odr-templates";
import { consentCertificateDocx } from "./odr-consent-docx";
import {
  BANK_NOMINATED_MODE,
  NO_CONSENT_WARNING,
  appointmentConsentState,
  appointmentParagraph,
  certificateLines,
  consentChoiceError,
  consentDueAt,
  consentShownText,
  panelSaveError,
  slotsOnArbitratorTrack,
  type PanelName,
  type StoredConsent,
} from "./odr-consent";
import type { HearingRules } from "./odr-slots";

const panel: PanelName[] = [
  { id: "a", name: "A. Rao", qualification: "Advocate", enrolment: "MAH/1" },
  { id: "b", name: "B. Iyer", qualification: "Retired judge", enrolment: "MAH/2" },
  { id: "c", name: "C. Das", qualification: "Advocate", enrolment: "MAH/3" },
];

function consent(partial: Partial<StoredConsent> & Pick<StoredConsent, "choice">): StoredConsent {
  return {
    typedName: "Ravi Shah",
    chosenNeutralId: "",
    chosenNeutralName: "",
    objection: "",
    shownText: "shown",
    recordedAt: new Date("2026-10-06T08:30:00.000Z"),
    recordedAtIst: "6 Oct 2026, 2:00 pm IST",
    ...partial,
  };
}

test("a panel needs three names, each with a qualification and an enrolment number", () => {
  assert.match(panelSaveError(panel.slice(0, 2)), /at least 3/);
  assert.match(panelSaveError([{ name: "A. Rao", qualification: "", enrolment: "MAH/1" }, panel[1]!, panel[2]!]), /A\. Rao/);
  assert.equal(panelSaveError(panel), "");
});

test("accepting needs the waiver box and the customer’s typed name", () => {
  const base = {
    choice: "ACCEPT",
    waive: false,
    typedName: "ravi  shah",
    expectedName: "Ravi Shah",
    panelNeutralId: "",
    panel,
    objection: "",
  };
  assert.match(consentChoiceError(base), /Tick the box/);
  assert.equal(consentChoiceError({ ...base, waive: true }), "");
  assert.match(consentChoiceError({ ...base, waive: true, typedName: "Someone Else" }), /full name/);
});

test("a panel choice must be one of the three names, and an objection needs words", () => {
  assert.match(consentChoiceError({
    choice: "PANEL",
    waive: false,
    typedName: "Ravi Shah",
    expectedName: "Ravi Shah",
    panelNeutralId: "missing",
    panel,
    objection: "",
  }), /panel/);
  assert.equal(consentChoiceError({
    choice: "PANEL",
    waive: false,
    typedName: "Ravi Shah",
    expectedName: "Ravi Shah",
    panelNeutralId: "b",
    panel,
    objection: "",
  }), "");
  assert.match(consentChoiceError({
    choice: "OBJECT",
    waive: false,
    typedName: "Ravi Shah",
    expectedName: "Ravi Shah",
    panelNeutralId: "",
    panel,
    objection: "no",
  }), /objection/i);
});

test("the text stored is the text shown, including the Section 12(5) waiver", () => {
  const shown = consentShownText({
    customer: "Ravi Shah",
    bank: "Northwind",
    arbitrator: "A. Rao",
    qualification: "Advocate",
    enrolment: "MAH/1",
    panel,
  });
  assert.match(shown, /Section 12\(5\)/);
  assert.match(shown, /not, by itself, an appointment/);
  assert.match(shown, /B\. Iyer/);
  assert.equal(BANK_NOMINATED_MODE, "bank nominated, subject to post-dispute consent");
});

test("no choice inside 15 days waits, a reminder follows, and silence after 30 days blocks the award", () => {
  const first = new Date("2026-10-01T04:30:00.000Z");
  assert.equal(consentDueAt(first, 15).toISOString(), new Date("2026-10-16T04:30:00.000Z").toISOString());
  assert.equal(consentDueAt(first, 30).toISOString(), new Date("2026-10-31T04:30:00.000Z").toISOString());
  const pending = appointmentConsentState({
    matterType: "ARBITRATION",
    now: new Date("2026-10-10T04:30:00.000Z"),
    days: 15,
    blockDays: 30,
    firstNoticeAt: first,
    consent: null,
    documentKinds: [],
  });
  assert.equal(pending.phase, "pending");
  assert.equal(pending.warning, "");
  assert.equal(pending.awardBlocked, false);
  assert.equal(pending.hearingBookingOpen, false);

  const reminder = appointmentConsentState({
    matterType: "ARBITRATION",
    now: new Date("2026-10-20T04:30:00.000Z"),
    days: 15,
    blockDays: 30,
    firstNoticeAt: first,
    consent: null,
    documentKinds: [],
  });
  assert.equal(reminder.phase, "reminder");
  assert.equal(reminder.awardBlocked, false);
  assert.match(reminder.warning, /Reminder/);
  assert.doesNotMatch(reminder.warning, /Section 11/);

  const expired = appointmentConsentState({
    matterType: "ARBITRATION",
    now: new Date("2026-11-02T04:30:00.000Z"),
    days: 15,
    blockDays: 30,
    firstNoticeAt: first,
    consent: null,
    documentKinds: [],
  });
  assert.equal(expired.warning, NO_CONSENT_WARNING);
  assert.equal(expired.awardBlocked, true);

  const objected = appointmentConsentState({
    matterType: "ARBITRATION",
    now: first,
    days: 15,
    firstNoticeAt: first,
    consent: consent({ choice: "OBJECT", objection: "I do not agree." }),
    documentKinds: [],
  });
  assert.equal(objected.phase, "objected");
  assert.equal(objected.awardBlocked, true);

  const waived = appointmentConsentState({
    matterType: "ARBITRATION",
    now: new Date("2026-10-20T04:30:00.000Z"),
    days: 15,
    firstNoticeAt: first,
    consent: consent({ choice: "ACCEPT" }),
    documentKinds: [],
  });
  assert.equal(waived.awardBlocked, false);
  assert.equal(waived.hearingBookingOpen, true);

  const court = appointmentConsentState({
    matterType: "ARBITRATION",
    now: new Date("2026-10-20T04:30:00.000Z"),
    days: 15,
    firstNoticeAt: first,
    consent: consent({ choice: "OBJECT", objection: "I do not agree." }),
    documentKinds: ["SECTION_11_ORDER"],
  });
  assert.equal(court.phase, "override");
  assert.equal(court.awardBlocked, false);
  assert.equal(appointmentConsentState({
    matterType: "MEDIATION",
    now: first,
    days: 15,
    firstNoticeAt: first,
    consent: null,
    documentKinds: [],
  }).required, false);
});

test("every respondent must consent, and one objection or two different names blocks the award", () => {
  const first = new Date("2026-10-01T04:30:00.000Z");
  const accepted = consent({ choice: "ACCEPT" });
  const waiting = appointmentConsentState({
    matterType: "ARBITRATION",
    now: first,
    days: 15,
    blockDays: 30,
    firstNoticeAt: first,
    consent: null,
    parties: [
      { id: "", name: "Ravi Shah", consent: accepted },
      { id: "co", name: "Meera Shah", consent: null },
    ],
    documentKinds: [],
  });
  assert.equal(waiting.phase, "pending");
  assert.equal(waiting.awardBlocked, false);
  assert.equal(waiting.hearingBookingOpen, false);

  const objected = appointmentConsentState({
    matterType: "ARBITRATION",
    now: first,
    days: 15,
    blockDays: 30,
    firstNoticeAt: first,
    consent: null,
    parties: [
      { id: "", name: "Ravi Shah", consent: accepted },
      { id: "co", name: "Meera Shah", consent: consent({ choice: "OBJECT", objection: "None of these.", typedName: "Meera Shah" }) },
    ],
    documentKinds: [],
  });
  assert.equal(objected.phase, "objected");
  assert.equal(objected.awardBlocked, true);

  const split = appointmentConsentState({
    matterType: "ARBITRATION",
    now: first,
    days: 15,
    blockDays: 30,
    firstNoticeAt: first,
    consent: null,
    nominatedNeutralId: "a",
    parties: [
      { id: "", name: "Ravi Shah", consent: accepted },
      { id: "co", name: "Meera Shah", consent: consent({ choice: "PANEL", chosenNeutralId: "b", chosenNeutralName: "B. Iyer", typedName: "Meera Shah" }) },
    ],
    documentKinds: [],
  });
  assert.equal(split.awardBlocked, true);
});

test("the award appointment paragraph follows the consent record or a Section 11 order", () => {
  const accepted = appointmentParagraph({
    consent: consent({ choice: "ACCEPT" }),
    documentKinds: [],
    arbitratorName: "A. Rao",
    nominatedName: "A. Rao",
  });
  assert.match(accepted, /6 Oct 2026, 2:00 pm IST/);
  assert.match(accepted, /waived any ineligibility under Section 12\(5\)/);
  const picked = appointmentParagraph({
    consent: consent({ choice: "PANEL", chosenNeutralId: "b", chosenNeutralName: "B. Iyer" }),
    documentKinds: [],
    arbitratorName: "B. Iyer",
    nominatedName: "A. Rao",
  });
  assert.match(picked, /chose B\. Iyer from the panel/);
  assert.match(picked, /nominated A\. Rao/);
  const court = appointmentParagraph({
    consent: consent({ choice: "OBJECT", objection: "No" }),
    documentKinds: ["SECTION_11_ORDER"],
    arbitratorName: "C. Das",
    nominatedName: "A. Rao",
  });
  assert.match(court, /Section 11/);
  assert.doesNotMatch(court, /objected/);
});

test("a consent certificate keeps the text, the IST time, the IP, and the browser", async () => {
  const lines = certificateLines({
    refNo: "ARB-1",
    bank: "Northwind",
    customer: "Ravi Shah",
    choice: "ACCEPT",
    typedName: "Ravi Shah",
    arbitratorName: "A. Rao",
    chosenName: "",
    objection: "",
    shownText: "Exact words shown.",
    recordedAtIst: "6 Oct 2026, 2:00 pm IST",
    ip: "203.0.113.8",
    userAgent: "TestBrowser/1",
  });
  const docx = await consentCertificateDocx(lines);
  assert.equal(docx[0], 0x50);
  assert.equal(docx[1], 0x4b);
  const xml = await JSZip.loadAsync(docx).then((zip) => zip.file("word/document.xml")?.async("string") ?? "");
  assert.match(xml, /Exact words shown/);
  assert.match(xml, /6 Oct 2026, 2:00 pm IST/);
  assert.match(xml, /203\.0\.113\.8/);
  assert.match(xml, /TestBrowser\/1/);
  assert.match(xml, /not edited after it is saved/);
});

test("a panel choice moves the hearing onto that arbitrator’s free time", () => {
  const start = indiaDateTime("2026-10-06", "10:00");
  assert.ok(start);
  const rules: HearingRules = {
    start,
    windowStart: 10 * 60,
    windowEnd: 18 * 60,
    durationMinutes: 30,
    gapMinutes: 0,
    skipSundays: true,
    holidays: new Set(),
    breakStart: 13 * 60 + 30,
    breakEnd: 14 * 60 + 30,
  };
  const busy = [{ start, end: new Date(start.getTime() + 60 * 60 * 1000) }];
  const placed = slotsOnArbitratorTrack(rules, busy, 1, start);
  assert.equal(placed.ok, true);
  if (!placed.ok) return;
  assert.equal(placed.slots[0]?.start.toISOString(), indiaDateTime("2026-10-06", "11:00")?.toISOString());
});

test("an arbitration notice mentions the consent step, and a mediation notice does not", () => {
  const shared = {
    customer: "Ravi Shah",
    bank: "Northwind",
    number: "ARB-1",
    date: "6 October 2026",
    time: "10:00 am",
    meetLink: "https://example.test/meet",
    caseLink: "https://example.test/case",
    ordinal: "first",
    kind: "first" as const,
  };
  const arbitration = hearingMessageText({ ...shared, matterType: "ARBITRATION" });
  assert.match(arbitration, /accept the named arbitrator, choose one name from the panel, or say none of these \/ I object/);
  const mediation = hearingMessageText({ ...shared, matterType: "MEDIATION" });
  assert.doesNotMatch(mediation, /Section 12\(5\)|choose one name from the panel/);
});
