// Google Meet for one hearing, on the calendar of the impersonated mediator.
// Cloud Run has no key file. The runtime account asks IAM to sign a JWT, then
// exchanges that JWT for an access token. Without the two settings, the link is fake.
// Calendar guests are added only when ODR sending is on. The customer is not a guest.
// Business Starter cannot appoint co-hosts or enforce a waiting room. See MEET_WORKSPACE_NOTE.

import {
  admissionSummary,
  INVITES_NOT_SENT,
  type HearingGuest,
} from "./odr-guests";

export type MeetConfig = {
  serviceAccount: string;
  hostEmail: string;
};

export type MeetLinkResult =
  | {
      ok: true;
      fake: boolean;
      link: string;
      eventId: string;
      meetingCode: string;
      inviteNote: string;
      spaceName: string;
    }
  | { ok: false; error: string };

export type MeetParticipant = {
  displayName: string;
  email: string;
  joinedAt?: string;
  leftAt?: string;
};

const MEET_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/meetings.space.created",
  "https://www.googleapis.com/auth/meetings.space.readonly",
  "https://www.googleapis.com/auth/meetings.space.settings",
].join(" ");

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const METADATA_TOKEN =
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";

export function readMeetConfig(env: NodeJS.ProcessEnv = process.env): MeetConfig {
  return {
    serviceAccount: (env.GOOGLE_MEET_SERVICE_ACCOUNT ?? "").trim(),
    hostEmail: (env.GOOGLE_MEET_HOST_EMAIL ?? "").trim(),
  };
}

export function meetConfigured(config: MeetConfig): boolean {
  return Boolean(config.serviceAccount.includes("@") && config.hostEmail.includes("@"));
}

export function fakeMeetLink(requestId: string): string {
  const slug = requestId.replace(/[^a-z0-9]/gi, "").slice(0, 24).toLowerCase() || "hearing";
  return `https://meet.google.com/practice-odr-link-${slug}`;
}

export function meetingCodeFromLink(link: string): string {
  const match = link.match(/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i);
  return match?.[1]?.toLowerCase() ?? "";
}

export function meetJwtClaims(input: {
  serviceAccount: string;
  hostEmail: string;
  nowSeconds: number;
}): Record<string, string | number> {
  return {
    iss: input.serviceAccount,
    sub: input.hostEmail,
    scope: MEET_SCOPES,
    aud: TOKEN_URL,
    iat: input.nowSeconds,
    exp: input.nowSeconds + 3600,
  };
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

export async function metadataAccessToken(fetchImpl: FetchLike): Promise<string | null> {
  try {
    const response = await fetchImpl(METADATA_TOKEN, {
      headers: { "Metadata-Flavor": "Google" },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return null;
    const body = (await readJson(response)) as { access_token?: string } | null;
    const token = body?.access_token?.trim() ?? "";
    return token || null;
  } catch {
    return null;
  }
}

export async function signJwtWithIam(input: {
  serviceAccount: string;
  accessToken: string;
  payload: string;
  fetchImpl: FetchLike;
}): Promise<string | null> {
  const url = `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(input.serviceAccount)}:signJwt`;
  try {
    const response = await input.fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ payload: input.payload }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return null;
    const body = (await readJson(response)) as { signedJwt?: string } | null;
    return body?.signedJwt?.trim() || null;
  } catch {
    return null;
  }
}

export async function exchangeSignedJwt(signedJwt: string, fetchImpl: FetchLike): Promise<string | null> {
  try {
    const response = await fetchImpl(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: signedJwt,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return null;
    const body = (await readJson(response)) as { access_token?: string } | null;
    return body?.access_token?.trim() || null;
  } catch {
    return null;
  }
}

export async function impersonatedAccessToken(input: {
  config: MeetConfig;
  fetchImpl: FetchLike;
  nowSeconds?: number;
}): Promise<string | null> {
  const metadata = await metadataAccessToken(input.fetchImpl);
  if (!metadata) return null;
  const claims = meetJwtClaims({
    serviceAccount: input.config.serviceAccount,
    hostEmail: input.config.hostEmail,
    nowSeconds: input.nowSeconds ?? Math.floor(Date.now() / 1000),
  });
  const signed = await signJwtWithIam({
    serviceAccount: input.config.serviceAccount,
    accessToken: metadata,
    payload: JSON.stringify(claims),
    fetchImpl: input.fetchImpl,
  });
  if (!signed) return null;
  return exchangeSignedJwt(signed, input.fetchImpl);
}

function isoInIndia(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${pick("year")}-${pick("month")}-${pick("day")}T${pick("hour")}:${pick("minute")}:${pick("second")}+05:30`;
}

export function calendarEventBody(input: {
  title: string;
  description: string;
  start: Date;
  end: Date;
  requestId: string;
  guests?: HearingGuest[];
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    summary: input.title,
    description: input.description,
    start: { dateTime: isoInIndia(input.start), timeZone: "Asia/Kolkata" },
    end: { dateTime: isoInIndia(input.end), timeZone: "Asia/Kolkata" },
    conferenceData: {
      createRequest: {
        requestId: input.requestId,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };
  const guests = (input.guests ?? []).filter((guest) => guest.email.includes("@"));
  if (guests.length > 0) {
    body.attendees = guests.map((guest) => ({ email: guest.email, displayName: guest.name }));
    body.guestsCanSeeOtherGuests = false;
    body.guestsCanInviteOthers = false;
  }
  return body;
}

export function calendarGuestPatch(input: {
  start: Date;
  end: Date;
  guests: HearingGuest[];
  invitesLive: boolean;
}): Record<string, unknown> {
  const guests = input.invitesLive ? input.guests.filter((guest) => guest.email.includes("@")) : [];
  return {
    start: { dateTime: isoInIndia(input.start), timeZone: "Asia/Kolkata" },
    end: { dateTime: isoInIndia(input.end), timeZone: "Asia/Kolkata" },
    attendees: guests.map((guest) => ({ email: guest.email, displayName: guest.name })),
    guestsCanSeeOtherGuests: false,
    guestsCanInviteOthers: false,
  };
}

export function linkFromCalendarEvent(payload: unknown): { link: string; eventId: string; meetingCode: string } | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as {
    id?: string;
    hangoutLink?: string;
    conferenceData?: { entryPoints?: Array<{ uri?: string; entryPointType?: string }> };
  };
  const fromEntry = record.conferenceData?.entryPoints?.find((point) => point.entryPointType === "video")?.uri;
  const link = (record.hangoutLink || fromEntry || "").trim();
  if (!link.startsWith("https://meet.google.com/")) return null;
  return {
    link,
    eventId: (record.id ?? "").trim(),
    meetingCode: meetingCodeFromLink(link),
  };
}

export async function createHearingMeet(input: {
  config: MeetConfig;
  title: string;
  description: string;
  start: Date;
  durationMinutes: number;
  requestId: string;
  guests?: HearingGuest[];
  invitesLive?: boolean;
  fetchImpl?: FetchLike;
  nowSeconds?: number;
}): Promise<MeetLinkResult> {
  const invitesLive = input.invitesLive === true;
  const guests = invitesLive ? input.guests ?? [] : [];
  const offline = INVITES_NOT_SENT;
  if (!meetConfigured(input.config)) {
    return {
      ok: true,
      fake: true,
      link: fakeMeetLink(input.requestId),
      eventId: "",
      meetingCode: "",
      inviteNote: invitesLive ? "Practice link. Invites were not sent." : offline,
      spaceName: "",
    };
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  const access = await impersonatedAccessToken({
    config: input.config,
    fetchImpl,
    nowSeconds: input.nowSeconds,
  });
  if (!access) return { ok: false, error: "Google Meet could not be authorised. The hearing was saved without a live link." };

  const end = new Date(input.start.getTime() + input.durationMinutes * 60 * 1000);
  const sendUpdates = guests.length > 0 ? "&sendUpdates=all" : "";
  try {
    const response = await fetchImpl(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1${sendUpdates}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          calendarEventBody({
            title: input.title,
            description: input.description,
            start: input.start,
            end,
            requestId: input.requestId,
            guests,
          }),
        ),
        signal: AbortSignal.timeout(20000),
      },
    );
    const payload = await readJson(response);
    if (!response.ok) return { ok: false, error: "Google Calendar did not create the hearing. Try again." };
    const parsed = linkFromCalendarEvent(payload);
    if (!parsed) return { ok: false, error: "Google Calendar did not return a Meet link. Try again." };
    if (!invitesLive) {
      return { ok: true, fake: false, ...parsed, inviteNote: offline, spaceName: "" };
    }
    const admission = parsed.meetingCode
      ? await applyMeetAdmission({
          meetingCode: parsed.meetingCode,
          arbitratorEmails: guests.filter((guest) => guest.role === "arbitrator").map((guest) => guest.email),
          accessToken: access,
          fetchImpl,
        })
      : { accessSet: false, cohostSet: false, spaceName: "" };
    const invited = guests.length
      ? admissionSummary(admission)
      : "No arbitrator or bank representative email is on file, so no calendar guest was added.";
    return { ok: true, fake: false, ...parsed, inviteNote: invited, spaceName: admission.spaceName };
  } catch {
    return { ok: false, error: "Google Calendar could not be reached. Try again." };
  }
}

export async function updateHearingMeetGuests(input: {
  config: MeetConfig;
  eventId: string;
  meetingCode: string;
  start: Date;
  durationMinutes: number;
  guests: HearingGuest[];
  invitesLive: boolean;
  fetchImpl?: FetchLike;
}): Promise<{ ok: true; inviteNote: string; spaceName: string } | { ok: false; error: string }> {
  if (!input.eventId || !meetConfigured(input.config)) {
    return {
      ok: true,
      inviteNote: input.invitesLive ? "Practice link. Invites were not sent." : INVITES_NOT_SENT,
      spaceName: "",
    };
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  const access = await impersonatedAccessToken({ config: input.config, fetchImpl });
  if (!access) return { ok: false, error: "Google Calendar could not be authorised, so the guest list was not changed." };
  const end = new Date(input.start.getTime() + input.durationMinutes * 60 * 1000);
  const sendUpdates = input.invitesLive && input.guests.length > 0 ? "all" : "none";
  try {
    const response = await fetchImpl(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(input.eventId)}?sendUpdates=${sendUpdates}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
        body: JSON.stringify(calendarGuestPatch({
          start: input.start,
          end,
          guests: input.guests,
          invitesLive: input.invitesLive,
        })),
        signal: AbortSignal.timeout(20000),
      },
    );
    if (!response.ok) return { ok: false, error: "Google Calendar did not update the hearing guests." };
  } catch {
    return { ok: false, error: "Google Calendar could not be reached, so the guest list was not changed." };
  }
  if (!input.invitesLive) return { ok: true, inviteNote: INVITES_NOT_SENT, spaceName: "" };
  if (!input.meetingCode) {
    return { ok: true, inviteNote: "Calendar guests updated. The Meet space could not be read.", spaceName: "" };
  }
  const admission = await applyMeetAdmission({
    meetingCode: input.meetingCode,
    arbitratorEmails: input.guests.filter((guest) => guest.role === "arbitrator").map((guest) => guest.email),
    accessToken: access,
    fetchImpl,
  });
  return { ok: true, inviteNote: admissionSummary(admission), spaceName: admission.spaceName };
}

export async function applyMeetAdmission(input: {
  meetingCode: string;
  arbitratorEmails: string[];
  accessToken: string;
  fetchImpl: FetchLike;
}): Promise<{ accessSet: boolean; cohostSet: boolean; spaceName: string }> {
  const headers = { Authorization: `Bearer ${input.accessToken}`, "Content-Type": "application/json" };
  let spaceName = "";
  let accessSet = false;
  try {
    const listed = await input.fetchImpl(`https://meet.googleapis.com/v2/spaces/${encodeURIComponent(input.meetingCode)}`, {
      headers,
      signal: AbortSignal.timeout(15000),
    });
    const space = (await readJson(listed)) as { name?: string } | null;
    spaceName = listed.ok ? (space?.name ?? "").trim() : "";
    if (spaceName.startsWith("spaces/")) {
      const patched = await input.fetchImpl(
        `https://meet.googleapis.com/v2/${spaceName}?updateMask=config.accessType`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({ config: { accessType: "RESTRICTED" } }),
          signal: AbortSignal.timeout(15000),
        },
      );
      accessSet = patched.ok;
    }
  } catch {
    accessSet = false;
  }
  const emails = [...new Set(input.arbitratorEmails.map((email) => email.trim().toLowerCase()).filter((email) => email.includes("@")))];
  if (!spaceName || emails.length === 0) return { accessSet, cohostSet: false, spaceName };
  let cohostSet = true;
  for (const email of emails) {
    try {
      const created = await input.fetchImpl(`https://meet.googleapis.com/v2/${spaceName}/members`, {
        method: "POST",
        headers,
        body: JSON.stringify({ email, role: "COHOST" }),
        signal: AbortSignal.timeout(15000),
      });
      if (!created.ok && created.status !== 409) cohostSet = false;
    } catch {
      cohostSet = false;
    }
  }
  if (!cohostSet) return { accessSet, cohostSet: false, spaceName };
  return { accessSet, cohostSet: true, spaceName };
}

export function participantsFromPayload(payload: unknown): MeetParticipant[] {
  if (!payload || typeof payload !== "object") return [];
  const people = (payload as { participants?: unknown[] }).participants;
  if (!Array.isArray(people)) return [];
  return people.map((person) => {
    const row = person as {
      earliestStartTime?: string;
      latestEndTime?: string;
      signedinUser?: { displayName?: string; email?: string };
      anonymousUser?: { displayName?: string };
      phoneUser?: { displayName?: string };
    };
    const signed = row.signedinUser;
    return {
      displayName: (signed?.displayName || row.anonymousUser?.displayName || row.phoneUser?.displayName || "").trim(),
      email: (signed?.email || "").trim(),
      joinedAt: (row.earliestStartTime ?? "").trim(),
      leftAt: (row.latestEndTime ?? "").trim(),
    };
  });
}

export function guestVisitsFromParticipants(input: {
  guests: HearingGuest[];
  participants: MeetParticipant[];
}): Array<HearingGuest & { joinedAt: string; leftAt: string }> {
  return input.guests.map((guest) => {
    const email = guest.email.trim().toLowerCase();
    const person = input.participants.find((row) => {
      if (email && row.email.toLowerCase() === email) return true;
      return namesMatch(guest.name, row.displayName);
    });
    return {
      ...guest,
      joinedAt: person?.joinedAt ?? "",
      leftAt: person?.leftAt ?? "",
    };
  });
}

export function namesMatch(left: string, right: string): boolean {
  const a = left.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const b = right.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (!a || !b || a.length < 3 || b.length < 3) return false;
  return a === b || a.includes(b) || b.includes(a);
}

export function attendanceFromParticipants(input: {
  customerName: string;
  customerEmail: string;
  participants: MeetParticipant[];
}): "JOINED" | "NO_SHOW" {
  const email = input.customerEmail.trim().toLowerCase();
  const joined = input.participants.some((person) => {
    if (email && person.email.toLowerCase() === email) return true;
    return namesMatch(input.customerName, person.displayName);
  });
  return joined ? "JOINED" : "NO_SHOW";
}

export function conferenceRecordNames(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];
  const records = (payload as { conferenceRecords?: Array<{ name?: string }> }).conferenceRecords;
  if (!Array.isArray(records)) return [];
  return records.map((record) => (record.name ?? "").trim()).filter((name) => name.startsWith("conferenceRecords/"));
}

export async function fetchMeetParticipants(input: {
  meetingCode: string;
  accessToken: string;
  fetchImpl?: FetchLike;
}): Promise<{ ok: true; participants: MeetParticipant[] } | { ok: false; error: string }> {
  if (!input.meetingCode) return { ok: false, error: "This hearing has no Meet code." };
  const fetchImpl = input.fetchImpl ?? fetch;
  const filter = `space.meeting_code="${input.meetingCode}"`;
  try {
    const listed = await fetchImpl(
      `https://meet.googleapis.com/v2/conferenceRecords?filter=${encodeURIComponent(filter)}`,
      { headers: { Authorization: `Bearer ${input.accessToken}` }, signal: AbortSignal.timeout(15000) },
    );
    const listBody = await readJson(listed);
    if (!listed.ok) return { ok: false, error: "Meet attendance could not be read." };
    const names = conferenceRecordNames(listBody);
    if (names.length === 0) return { ok: true, participants: [] };
    const participants: MeetParticipant[] = [];
    for (const name of names) {
      const response = await fetchImpl(`https://meet.googleapis.com/v2/${name}/participants`, {
        headers: { Authorization: `Bearer ${input.accessToken}` },
        signal: AbortSignal.timeout(15000),
      });
      const body = await readJson(response);
      if (!response.ok) return { ok: false, error: "Meet participants could not be read." };
      participants.push(...participantsFromPayload(body));
    }
    return { ok: true, participants };
  } catch {
    return { ok: false, error: "Meet attendance could not be reached." };
  }
}
