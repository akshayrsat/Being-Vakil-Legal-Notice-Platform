import assert from "node:assert/strict";
import test from "node:test";
import { ROLE_BANK_USER, ROLE_COORDINATOR, ROLE_OWNER } from "./roles";
import { workspaceNav } from "./send-notice";
import { last4Matches, last4Challenge, customerMobileFromDeliveries, MOBILE_LAST4_PROMPT, hearingOrdinal, indiaDateTime, generateRefNo } from "./odr-ref";
import { suggestOdrMapping, mapOdrRows, ODR_SAMPLE_HEADERS, emptyOdrMapping } from "./odr-fields";
import { effectiveOdrLiveSend, ODR_NOT_SENT_DETAIL, ODR_SERVER_DISABLED_NOTE, odrEnvLive, odrServerDisabledNote } from "./odr-live";
import { planOdrChannels, nextNoShowState, autoSendAllowed } from "./odr-plan";
import { attendanceFromParticipants, fakeMeetLink, meetConfigured, meetJwtClaims, meetingCodeFromLink } from "./odr-meet";
import { dueReminderKeys, needsNextHearing, autoRescheduleAt } from "./odr-schedule";
import { buildOdrExportRows, odrCaseWhere, readOdrFilters } from "./odr-reports";
import { templatesFor, defaultTemplateMap, hearingMessageText } from "./odr-templates";
import { odrCopy, odrCopyFor } from "./odr-copy";
import { deliverOdrChannel } from "./odr-dispatch";
import { stageTracker } from "./odr-status";

test("ODR sits next to Send notice for staff, and a bank user stays on Tracking and Reports", () => {
  for (const role of [ROLE_OWNER, ROLE_COORDINATOR]) {
    const labels = workspaceNav(role).map((link) => link.label);
    const send = labels.indexOf("Send notice");
    assert.equal(labels[send + 1], "ODR");
  }
  assert.deepEqual(
    workspaceNav(ROLE_BANK_USER).map((link) => link.href),
    ["/dashboard", "/deliveries", "/reports"],
  );
});

test("ODR sending stays off unless the owner switch and ODR_LIVE_SEND are both on", () => {
  assert.equal(odrEnvLive(undefined), false);
  assert.equal(odrEnvLive("true"), true);
  assert.equal(odrEnvLive("TRUE"), false);
  assert.equal(effectiveOdrLiveSend(null, undefined), false);
  assert.equal(effectiveOdrLiveSend(null, "true"), false);
  assert.equal(effectiveOdrLiveSend(true, undefined), false);
  assert.equal(effectiveOdrLiveSend(true, "true"), true);
  assert.equal(effectiveOdrLiveSend(false, "true"), false);
  assert.equal(odrServerDisabledNote(false), ODR_SERVER_DISABLED_NOTE);
  assert.equal(ODR_SERVER_DISABLED_NOTE, "ODR sending is disabled on the server");
  assert.equal(odrServerDisabledNote(true), "");
});

test("a missing template is named, and a configured template stays unsent while ODR sending is off", () => {
  const off = planOdrChannels({
    live: false,
    mobile: "9876543210",
    email: "person@example.com",
    templates: { smsFlowId: "", emailTemplateId: "arbitration_first_hearing", whatsappTemplate: "arbitration_first_hearing" },
  });
  assert.equal(off.find((row) => row.channel === "SMS")?.detail, "SMS template not configured");
  assert.equal(off.find((row) => row.channel === "EMAIL")?.detail, ODR_NOT_SENT_DETAIL);
  assert.equal(off.find((row) => row.channel === "EMAIL")?.status, "SKIPPED");
  assert.equal(off.find((row) => row.channel === "WHATSAPP")?.detail, ODR_NOT_SENT_DETAIL);

  const on = planOdrChannels({
    live: true,
    mobile: "9876543210",
    email: "person@example.com",
    templates: { smsFlowId: "flow", emailTemplateId: "arbitration_first_hearing", whatsappTemplate: "arbitration_first_hearing" },
  });
  assert.deepEqual(on.map((row) => row.status), ["QUEUED", "QUEUED", "QUEUED"]);
});

test("delivering an ODR message does not call the network when sending is off", async () => {
  let called = 0;
  const result = await deliverOdrChannel(
    {
      live: false,
      channel: "EMAIL",
      to: "person@example.com",
      templateId: "arbitration_first_hearing",
      vars: { customer: "A", bank: "B", number: "ARB-1", date: "1 May 2026", time: "11:00 am", link: "https://meet.google.com/abc-defg-hij", caseLink: "https://example.com/case" },
    },
    {
      env: { MSG91_AUTH_KEY: "secret", MSG91_EMAIL_FROM: "a@b.in", MSG91_EMAIL_DOMAIN: "b.in" },
      fetchImpl: async () => {
        called += 1;
        throw new Error("network");
      },
    },
  );
  assert.equal(called, 0);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.detail, ODR_NOT_SENT_DETAIL);
});

test("the sample sheet maps itself, and a blank ref can be generated uniquely", () => {
  const mapping = suggestOdrMapping([...ODR_SAMPLE_HEADERS], null);
  assert.equal(mapping.customerName, "Customer name");
  assert.equal(mapping.accountNumber, "Loan/card account no");
  assert.equal(mapping.claimAmount, "Outstanding/claim amount");
  const rows = mapOdrRows(
    [...ODR_SAMPLE_HEADERS],
    [["", "Ravi Shah", "Anita Shah", "1234567890", "Pune", "9876543210", "ravi@example.com", "Pune", "100000", "25000", "1 Oct 2026", "Unpaid EMI"]],
    mapping,
  );
  assert.equal(rows[0]?.problems.length, 0);
  assert.equal(rows[0]?.customerName, "Ravi Shah");
  const taken = new Set<string>();
  const first = generateRefNo("ARBITRATION", taken, 2026);
  const second = generateRefNo("MEDIATION", taken, 2026);
  assert.match(first, /^ARB-2026-/);
  assert.match(second, /^MED-2026-/);
  assert.notEqual(first, second);
});

test("the account check uses the last 4 digits and rejects a short account", () => {
  assert.equal(last4Matches("LN-0042-7781", "7781"), true);
  assert.equal(last4Matches("LN-0042-7781", "7782"), false);
  assert.equal(last4Matches("LN-0042-7781", "781"), false);
  assert.equal(last4Matches("12", "0012"), false);
});

test("a short account falls back to the mobile last 4, and neither number stays closed", () => {
  const account = last4Challenge("LN-0042-7781", "9876543210");
  assert.equal(account?.source, "account");
  assert.equal(last4Matches(account?.value ?? "", "7781"), true);
  assert.equal(last4Matches(account?.value ?? "", "3210"), false);

  const mobile = last4Challenge("N/A", "98765 43210");
  assert.equal(mobile?.source, "mobile");
  assert.equal(last4Matches(mobile?.value ?? "", "3210"), true);
  assert.equal(last4Matches(mobile?.value ?? "", "7781"), false);
  assert.equal(MOBILE_LAST4_PROMPT, "Enter the last 4 digits of your mobile number");

  assert.equal(last4Challenge("", ""), null);
  assert.equal(last4Challenge("12", "123"), null);
  assert.equal(last4Challenge("AB", "+91"), null);
});

test("the notice mobile is the SMS number, then WhatsApp, then any saved number", () => {
  assert.equal(customerMobileFromDeliveries([
    { channel: "EMAIL", mobile: "9111111111" },
    { channel: "WHATSAPP", mobile: "9222222222" },
    { channel: "SMS", mobile: "9876543210" },
  ]), "9876543210");
  assert.equal(customerMobileFromDeliveries([
    { channel: "SMS", mobile: " " },
    { channel: "WHATSAPP", mobile: "9811111111" },
  ]), "9811111111");
  assert.equal(customerMobileFromDeliveries([{ channel: "EMAIL", mobile: "" }]), "");
});

test("hearing labels, times, and the no-show cap", () => {
  assert.equal(hearingOrdinal(1), "1st");
  assert.equal(hearingOrdinal(2), "2nd");
  assert.equal(hearingOrdinal(3), "3rd");
  assert.equal(hearingOrdinal(4), "4th");
  assert.equal(hearingOrdinal(11), "11th");
  const when = indiaDateTime("2026-10-20", "11:00");
  assert.equal(when?.toISOString(), "2026-10-20T05:30:00.000Z");
  assert.deepEqual(nextNoShowState({ noShowCount: 2, maxNoShow: 3 }), {
    noShowCount: 3,
    flaggedExParte: false,
    considerFinalOpportunity: true,
  });
  assert.deepEqual(nextNoShowState({ noShowCount: 2, maxNoShow: 3, matterType: "MEDIATION" }), {
    noShowCount: 3,
    flaggedExParte: false,
    considerFinalOpportunity: false,
  });
  assert.equal(autoSendAllowed({ flaggedExParte: true, noShowCount: 3, maxNoShow: 3 }), false);
  assert.equal(autoSendAllowed({ flaggedExParte: false, noShowCount: 1, maxNoShow: 3 }), true);
});

test("Meet falls back to a fake link, and attendance matches a name or email", () => {
  assert.equal(meetConfigured({ serviceAccount: "", hostEmail: "" }), false);
  assert.match(fakeMeetLink("hearing 1"), /practice-odr-link/);
  assert.equal(meetingCodeFromLink("https://meet.google.com/abc-defg-hij"), "abc-defg-hij");
  assert.equal(meetingCodeFromLink(fakeMeetLink("x")), "");
  const claims = meetJwtClaims({
    serviceAccount: "notice-desk-meet@example.iam.gserviceaccount.com",
    hostEmail: "mediator@beingvakil.in",
    nowSeconds: 1_700_000_000,
  });
  assert.equal(claims.iss, "notice-desk-meet@example.iam.gserviceaccount.com");
  assert.equal(claims.sub, "mediator@beingvakil.in");
  assert.equal(claims.aud, "https://oauth2.googleapis.com/token");
  assert.equal(claims.exp, 1_700_000_000 + 3600);
  assert.equal(
    attendanceFromParticipants({
      customerName: "Ravi Shah",
      customerEmail: "ravi@example.com",
      participants: [{ displayName: "Ravi Shah", email: "" }],
    }),
    "JOINED",
  );
  assert.equal(
    attendanceFromParticipants({
      customerName: "Ravi Shah",
      customerEmail: "ravi@example.com",
      participants: [{ displayName: "Other Person", email: "ravi@example.com" }],
    }),
    "JOINED",
  );
  assert.equal(
    attendanceFromParticipants({
      customerName: "Ravi Shah",
      customerEmail: "ravi@example.com",
      participants: [{ displayName: "Clerk", email: "clerk@bank.in" }],
    }),
    "NO_SHOW",
  );
});

test("reminders and the next-hearing queue follow the rules", () => {
  const scheduledAt = new Date("2026-10-20T05:30:00.000Z");
  const dayBefore = new Date("2026-10-19T05:30:00.000Z");
  assert.deepEqual(
    dueReminderKeys({
      now: dayBefore,
      scheduledAt,
      sent: [],
      rule: { dayOn: true, hourOn: true, daysBefore: 1, hoursBefore: 1 },
    }),
    ["d1"],
  );
  const hourBefore = new Date("2026-10-20T04:30:00.000Z");
  assert.deepEqual(
    dueReminderKeys({
      now: hourBefore,
      scheduledAt,
      sent: ["d1"],
      rule: { dayOn: true, hourOn: true, daysBefore: 1, hoursBefore: 1 },
    }),
    ["h1"],
  );
  assert.equal(needsNextHearing({ status: "NO_SHOW", flaggedExParte: false, hasFutureHearing: false }), true);
  assert.equal(needsNextHearing({ status: "NO_SHOW", flaggedExParte: false, hasFutureHearing: true }), false);
  assert.equal(needsNextHearing({ status: "CLOSED", flaggedExParte: false, hasFutureHearing: false }), false);
  const next = autoRescheduleAt(scheduledAt, 7);
  assert.equal(next?.toISOString(), "2026-10-27T05:30:00.000Z");
});

test("the Excel is one row per person and another bank is left out", () => {
  const when = new Date("2026-10-20T05:30:00.000Z");
  const table = buildOdrExportRows(
    [
      {
        bankId: "bank-a",
        bankName: "Test Bank",
        refNo: "ARB-2026-AAAAAA",
        customerName: "Ravi Shah",
        accountNumber: "1234567781",
        matterType: "ARBITRATION",
        neutralName: "A. Rao",
        status: "NO_SHOW",
        exParte: false,
        settlementAmount: "5000",
        settlementNote: "Can pay next week",
        awardAt: null,
        hearings: [
          { number: 1, attendance: "NO_SHOW", scheduledAt: when },
          { number: 2, attendance: "JOINED", scheduledAt: when },
        ],
        messages: [
          { channel: "EMAIL", kind: "FIRST", status: "SKIPPED", detail: ODR_NOT_SENT_DETAIL, createdAt: when },
          { channel: "SMS", kind: "FIRST", status: "SKIPPED", detail: "SMS template not configured", createdAt: when },
        ],
      },
      {
        bankId: "bank-b",
        bankName: "Other Bank",
        refNo: "ARB-2026-BBBBBB",
        customerName: "Hidden",
        accountNumber: "9999",
        matterType: "ARBITRATION",
        neutralName: "X",
        status: "CLOSED",
        exParte: false,
        settlementAmount: "",
        settlementNote: "",
        awardAt: null,
        hearings: [],
        messages: [],
      },
    ],
    "bank-a",
  );
  assert.equal(table.rows.length, 1);
  assert.equal(table.rows[0]?.[0], "ARB-2026-AAAAAA");
  assert.equal(table.rows[0]?.includes("N"), true);
  assert.equal(table.rows[0]?.includes("Y"), true);
  assert.equal(table.rows.some((row) => row.includes("Hidden")), false);
  assert.equal(odrCaseWhere("").bankId.length > 0, true);
  assert.notEqual(odrCaseWhere("bank-a").bankId, odrCaseWhere("").bankId);
  const filters = readOdrFilters(new URLSearchParams("applied=1&matter=ARBITRATION&status=NO_SHOW"));
  assert.equal(filters.applied, true);
  assert.equal(filters.matter, "ARBITRATION");
});

test("first-hearing wording keeps the approved variables, and later templates start empty", () => {
  const map = defaultTemplateMap({});
  assert.equal(templatesFor(map, "ARBITRATION", "first").emailTemplateId, "arbitration_first_hearing");
  assert.equal(templatesFor(map, "ARBITRATION", "first").smsFlowId, "");
  assert.equal(templatesFor(map, "ARBITRATION", "next").emailTemplateId, "");
  assert.equal(templatesFor(map, "MEDIATION", "first").whatsappTemplate, "");
  const text = hearingMessageText({
    customer: "Ravi Shah",
    bank: "Test Bank",
    number: "ARB-2026-AAAAAA",
    date: "20 October 2026",
    time: "11:00 am",
    meetLink: "https://meet.google.com/abc-defg-hij",
    caseLink: "https://www.notice.beingvakil.in/odr/c/token",
    ordinal: "first",
    matterType: "ARBITRATION",
    kind: "first",
  });
  assert.match(text, /Test Bank vs\. Ravi Shah/);
  assert.match(text, /By order of the Sole Arbitrator/);
  assert.match(text, /Section 13/);
  assert.match(text, /statement of claim/i);
  assert.match(text, /abc-defg-hij/);
  assert.match(text, /\/odr\/c\/token/);
  assert.match(text, /remain present/);
  const panel = hearingMessageText({
    customer: "Ravi Shah",
    bank: "Test Bank",
    number: "ARB-2026-AAAAAA",
    date: "20 October 2026",
    time: "11:00 am",
    meetLink: "https://meet.google.com/abc-defg-hij",
    caseLink: "https://www.notice.beingvakil.in/odr/c/token",
    ordinal: "first",
    matterType: "ARBITRATION",
    kind: "first",
    panelCount: 3,
    arbitratorName: "A, B and C",
    claimReference: "SOC-1",
    defenceDeadline: "4 November 2026",
  });
  assert.match(panel, /By order of the Arbitral Tribunal/);
  assert.match(panel, /A, B and C/);
  assert.match(panel, /SOC-1/);
  assert.match(panel, /4 November 2026/);
  const mediation = hearingMessageText({
    customer: "Ravi Shah",
    bank: "Test Bank",
    number: "MED-2026-AAAAAA",
    date: "20 October 2026",
    time: "11:00 am",
    meetLink: "https://meet.google.com/abc-defg-hij",
    caseLink: "https://www.notice.beingvakil.in/odr/c/token",
    ordinal: "first",
    matterType: "MEDIATION",
    kind: "first",
  });
  assert.match(mediation, /voluntary mediation session/);
  assert.doesNotMatch(mediation, /remain present|ex parte|must appear/i);
  const mediationCopy = odrCopyFor("MEDIATION");
  assert.doesNotMatch(mediationCopy.rules.join(" "), /remain present|ex parte/i);
  assert.match(odrCopyFor("ARBITRATION").rules.join(" "), /ex parte/);
  assert.equal(odrCopy("hi").localeName, "English");
  assert.equal(stageTracker("HEARING")[2]?.mark, "current");
  assert.equal(emptyOdrMapping().customerName, "");
});
