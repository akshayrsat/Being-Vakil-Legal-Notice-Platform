import assert from "node:assert/strict";
import test from "node:test";
import {
  INVITES_NOT_SENT,
  MEET_WORKSPACE_NOTE,
  admissionSummary,
  neutralHearsCase,
  scheduleDigestDue,
  scheduleDigestPlan,
  scheduleEmailBody,
  selectHearingGuests,
} from "./odr-guests";
import {
  applyMeetAdmission,
  calendarEventBody,
  calendarGuestPatch,
  guestVisitsFromParticipants,
  meetJwtClaims,
  participantsFromPayload,
} from "./odr-meet";

const start = new Date("2026-10-06T04:30:00.000Z");
const end = new Date("2026-10-06T05:00:00.000Z");

test("a switched-off send creates the hearing with no guests", () => {
  const selected = selectHearingGuests({
    live: false,
    panel: [
      { name: "A. Rao", email: "rao@example.com" },
      { name: "L. Kapoor", email: "leela@example.com" },
      { name: "S. Iyer", email: "iyer@example.com" },
    ],
    assigned: { name: "A. Rao", email: "rao@example.com" },
    representatives: [{ name: "Bank Officer", email: "officer@bank.example" }],
  });
  assert.deepEqual(selected.guests, []);
  assert.equal(selected.inviteNote, INVITES_NOT_SENT);
  const body = calendarEventBody({
    title: "Hearing",
    description: "Case page",
    start,
    end,
    requestId: "hearing-1",
  });
  assert.equal("attendees" in body, false);
  assert.equal(JSON.stringify(body).includes("rao@example.com"), false);
  assert.equal(JSON.stringify(body).includes("customer@example.com"), false);
});

test("panel members and bank representatives are guests, and the customer is not", () => {
  const selected = selectHearingGuests({
    live: true,
    panel: [
      { name: "A. Rao", email: "rao@example.com" },
      { name: "L. Kapoor", email: "leela@example.com" },
      { name: "S. Iyer", email: "" },
    ],
    assigned: { name: "A. Rao", email: "rao@example.com" },
    representatives: [
      { name: "Bank Officer", email: "officer@bank.example" },
      { name: "A. Rao", email: "rao@example.com" },
    ],
  });
  assert.deepEqual(selected.guests.map((guest) => guest.email), [
    "rao@example.com",
    "leela@example.com",
    "officer@bank.example",
  ]);
  assert.equal(selected.guests.some((guest) => guest.email === "customer@example.com"), false);
  assert.match(selected.inviteNote, /S\. Iyer/);
  const body = calendarEventBody({
    title: "Hearing",
    description: "Case page",
    start,
    end,
    requestId: "hearing-1",
    guests: selected.guests,
  });
  assert.equal(body.guestsCanSeeOtherGuests, false);
  const attendees = body.attendees as Array<{ email: string }>;
  assert.equal(attendees.some((guest) => guest.email === "customer@example.com"), false);
  assert.equal(attendees.length, 3);
  const sole = selectHearingGuests({
    live: true,
    panel: [{ name: "A. Rao", email: "rao@example.com" }],
    assigned: { name: "A. Rao", email: "rao@example.com" },
    representatives: [],
  });
  assert.deepEqual(sole.guests.map((guest) => guest.email), ["rao@example.com"]);
});

test("a reschedule replaces the guest list and keeps the customer off it", () => {
  const patch = calendarGuestPatch({
    start,
    end,
    invitesLive: true,
    guests: [
      { role: "arbitrator", name: "L. Kapoor", email: "leela@example.com" },
      { role: "bank_rep", name: "Bank Officer", email: "officer@bank.example" },
    ],
  });
  const attendees = patch.attendees as Array<{ email: string }>;
  assert.deepEqual(attendees.map((guest) => guest.email), ["leela@example.com", "officer@bank.example"]);
  assert.equal(patch.guestsCanSeeOtherGuests, false);
  const quiet = calendarGuestPatch({ start, end, invitesLive: false, guests: [] });
  assert.deepEqual(quiet.attendees, []);
  assert.equal(JSON.stringify(quiet).includes("customer@"), false);
});

test("co-host falls back when the Workspace edition refuses it, and RESTRICTED is requested", async () => {
  const calls: Array<{ url: string; method: string; body: string }> = [];
  const fetchImpl = async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? "GET", body: String(init?.body ?? "") });
    if (url.includes("/members")) return new Response("no co-host", { status: 403 });
    if (init?.method === "PATCH") return new Response("{}", { status: 200 });
    return new Response(JSON.stringify({ name: "spaces/space-1" }), { status: 200 });
  };
  const result = await applyMeetAdmission({
    meetingCode: "abc-defg-hij",
    arbitratorEmails: ["rao@example.com"],
    accessToken: "token",
    fetchImpl,
  });
  assert.equal(result.accessSet, true);
  assert.equal(result.cohostSet, false);
  assert.match(calls[1]?.body ?? "", /RESTRICTED/);
  assert.match(calls[2]?.body ?? "", /COHOST/);
  assert.match(admissionSummary(result), /mediator@ remains the host/);
  assert.match(MEET_WORKSPACE_NOTE, /Business Starter/);
  assert.match(MEET_WORKSPACE_NOTE, /Base/);
  assert.match(MEET_WORKSPACE_NOTE, /waiting rooms/);
  const claims = meetJwtClaims({
    serviceAccount: "notice-desk-meet@example.iam.gserviceaccount.com",
    hostEmail: "mediator@beingvakil.in",
    nowSeconds: 1,
  });
  assert.match(String(claims.scope), /meetings\.space\.settings/);
});

test("arbitrator and bank representative join and leave are recorded, and the customer mark stays the same", () => {
  const payload = {
    participants: [
      {
        earliestStartTime: "2026-10-06T05:00:00.000Z",
        latestEndTime: "2026-10-06T05:40:00.000Z",
        signedinUser: { displayName: "A. Rao", email: "rao@example.com" },
      },
      {
        earliestStartTime: "2026-10-06T05:05:00.000Z",
        latestEndTime: "2026-10-06T05:35:00.000Z",
        signedinUser: { displayName: "Bank Officer", email: "officer@bank.example" },
      },
      {
        earliestStartTime: "2026-10-06T05:10:00.000Z",
        latestEndTime: "2026-10-06T05:20:00.000Z",
        signedinUser: { displayName: "Ravi Shah", email: "ravi@example.com" },
      },
    ],
  };
  const people = participantsFromPayload(payload);
  const visits = guestVisitsFromParticipants({
    guests: [
      { role: "arbitrator", name: "A. Rao", email: "rao@example.com" },
      { role: "bank_rep", name: "Bank Officer", email: "officer@bank.example" },
    ],
    participants: people,
  });
  assert.equal(visits[0]?.joinedAt, "2026-10-06T05:00:00.000Z");
  assert.equal(visits[0]?.leftAt, "2026-10-06T05:40:00.000Z");
  assert.equal(visits[1]?.joinedAt, "2026-10-06T05:05:00.000Z");
  assert.equal(visits[1]?.leftAt, "2026-10-06T05:35:00.000Z");
  assert.equal(people.some((person) => person.email === "ravi@example.com"), true);
});

test("the morning list is due from 07:30 IST and names the case page, not only the Meet link", () => {
  assert.equal(scheduleDigestDue(new Date("2026-10-06T01:59:00.000Z")), false);
  assert.equal(scheduleDigestDue(new Date("2026-10-06T02:00:00.000Z")), true);
  assert.equal(scheduleDigestDue(new Date("2026-10-06T12:00:00.000Z")), true);
  const body = scheduleEmailBody({
    arbitratorName: "A. Rao",
    day: "6 Oct 2026",
    rows: [{
      customerName: "Ravi Shah",
      refNo: "ARB-2026-ML2KM2",
      time: "10:00 am IST",
      meetLink: "https://meet.google.com/abc-defg-hij",
      caseUrl: "https://www.notice.beingvakil.in/odr/cases/case-1",
    }],
  });
  assert.match(body, /Ravi Shah/);
  assert.match(body, /ARB-2026-ML2KM2/);
  assert.match(body, /10:00 am IST/);
  assert.match(body, /meet\.google\.com\/abc-defg-hij/);
  assert.match(body, /\/odr\/cases\/case-1/);
  assert.equal(scheduleDigestPlan({ live: false, templateId: "schedule" }).detail, "not sent (ODR sending off)");
  assert.equal(scheduleDigestPlan({ live: false, templateId: "schedule" }).send, false);
  assert.equal(scheduleDigestPlan({ live: true, templateId: "" }).send, false);
  assert.equal(scheduleDigestPlan({ live: true, templateId: "schedule" }).send, true);
  assert.equal(neutralHearsCase("n2", ["n1", "n2", "n3"], "n1"), true);
  assert.equal(neutralHearsCase("n2", ["n1"], "n1"), false);
});
