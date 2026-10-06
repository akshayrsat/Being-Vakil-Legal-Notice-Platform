// Post-dispute consent for a bank-nominated arbitrator.
// The row is written once. This file does not update it.

import { formatIndiaDateTime, INDIA_TIME_ZONE } from "./india-day";
import { indiaDateKey, indiaDateTime } from "./odr-ref";
import {
  assignHearingSlots,
  clockText,
  type BusyInterval,
  type HearingRules,
  type HearingSlot,
} from "./odr-slots";

export const BANK_NOMINATED_MODE = "bank nominated, subject to post-dispute consent";
export const CONSENT_DAYS_DEFAULT = 15;
export const CONSENT_BLOCK_DAYS_DEFAULT = 30;
export const NO_CONSENT_WARNING =
  "No valid appointment consent: consider Section 11 application or Lok Adalat referral";
export const CONSENT_REMINDER =
  "Reminder: written consent from every respondent is still outstanding. The award is not blocked yet.";
export const CONSENT_NOTICE_LINE =
  "On your case page you may accept the named arbitrator, choose one name from the panel, or say none of these / I object. That step is recorded. It does not decide the dispute.";

export const OVERRIDE_DOCUMENT_KINDS = ["SECTION_11_ORDER", "SIGNED_CONSENT"] as const;

export type ConsentChoice = "ACCEPT" | "PANEL" | "OBJECT";

export type PanelName = {
  id: string;
  name: string;
  qualification: string;
  enrolment: string;
};

export type StoredConsent = {
  choice: string;
  typedName: string;
  chosenNeutralId: string;
  chosenNeutralName: string;
  objection: string;
  shownText: string;
  recordedAt: Date;
  recordedAtIst: string;
};

export type ConsentPhase = "not_required" | "pending" | "reminder" | "accepted" | "panel" | "objected" | "expired" | "override";

export type ConsentParty = {
  id: string;
  name: string;
  consent: StoredConsent | null;
};

export type ConsentState = {
  required: boolean;
  phase: ConsentPhase;
  warning: string;
  awardBlocked: boolean;
  hearingBookingOpen: boolean;
};

const NOT_REQUIRED: ConsentState = {
  required: false,
  phase: "not_required",
  warning: "",
  awardBlocked: false,
  hearingBookingOpen: true,
};

export function section12WaiverText(): string {
  return [
    "Section 12(5) of the Arbitration and Conciliation Act, 1996 says some people cannot act as arbitrator, including a person who is connected with one of the parties.",
    "If you accept the arbitrator named by the bank, you confirm that you have read this and you waive that ineligibility, in writing, for this case.",
    "You do not have to accept that person. You may choose a different arbitrator from the panel, or you may object.",
  ].join(" ");
}

export function consentShownText(input: {
  customer: string;
  bank: string;
  arbitrator: string;
  qualification: string;
  enrolment: string;
  panel: Array<Pick<PanelName, "name" | "qualification" | "enrolment">>;
}): string {
  const details = [input.qualification.trim(), input.enrolment.trim()].filter(Boolean).join(", ");
  const panelLine = input.panel.length
    ? `Panel: ${input.panel.map((member) => [member.name, member.qualification, member.enrolment].map((part) => part.trim()).filter(Boolean).join(", ")).join("; ")}.`
    : "A panel of names is not on this page yet.";
  return [
    `${input.bank} has nominated ${input.arbitrator.trim() || "an arbitrator"} to hear ${input.customer.trim() || "this"} arbitration.`,
    details,
    "This nomination is subject to your consent after the dispute has arisen. It is not, by itself, an appointment.",
    section12WaiverText(),
    "You may: (a) accept the named arbitrator and waive Section 12(5) ineligibility in writing; (b) choose one arbitrator from the panel; or (c) say none of these / I object.",
    panelLine,
  ].filter(Boolean).join("\n");
}

export function samePersonName(typed: string, expected: string): boolean {
  const norm = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
  const left = norm(typed);
  const right = norm(expected);
  return left.length >= 2 && left === right;
}

export function panelSaveError(members: Array<{ name: string; qualification: string; enrolment: string }>): string {
  if (members.length < 3) return "An arbitrator panel needs at least 3 names.";
  const missing = members.filter((member) => !member.qualification.trim() || !member.enrolment.trim());
  if (missing.length === 0) return "";
  return `Add a qualification and an enrolment number for ${missing.map((member) => member.name).join(", ")} before saving the panel.`;
}

export function isConsentChoice(value: string): value is ConsentChoice {
  return value === "ACCEPT" || value === "PANEL" || value === "OBJECT";
}

export function consentChoiceError(input: {
  choice: string;
  waive: boolean;
  typedName: string;
  expectedName: string;
  panelNeutralId: string;
  panel: PanelName[];
  objection: string;
}): string {
  if (!isConsentChoice(input.choice)) return "Choose to accept, to pick a panel arbitrator, or to say none of these / I object.";
  if (!samePersonName(input.typedName, input.expectedName)) {
    return "Type your full name as it appears on this case.";
  }
  if (input.choice === "ACCEPT") {
    if (!input.waive) return "Tick the box to waive Section 12(5) ineligibility in writing.";
    return "";
  }
  if (input.choice === "PANEL") {
    if (input.panel.length < 3) return "The panel does not have 3 names yet. You can accept the named arbitrator or object.";
    if (!input.panel.some((member) => member.id === input.panelNeutralId)) return "Choose one arbitrator from the panel.";
    return "";
  }
  if (input.objection.trim().length < 3) return "Write a short objection.";
  return "";
}

export function consentDueAt(firstNoticeAt: Date, days: number): Date {
  const span = Number.isInteger(days) && days >= 1 ? days : CONSENT_DAYS_DEFAULT;
  return new Date(firstNoticeAt.getTime() + span * 24 * 60 * 60 * 1000);
}

export function istStamp(date: Date): string {
  return `${formatIndiaDateTime(date)} IST`;
}

export function istDayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function validConsent(consent: StoredConsent | null): consent is StoredConsent & { choice: "ACCEPT" | "PANEL" } {
  if (!consent) return false;
  if (consent.choice === "ACCEPT") return consent.typedName.trim().length >= 2;
  if (consent.choice === "PANEL") return Boolean(consent.chosenNeutralId.trim() && consent.chosenNeutralName.trim());
  return false;
}

function partyNeutralId(party: ConsentParty, nominatedId: string): string {
  if (party.consent?.choice === "PANEL") return party.consent.chosenNeutralId;
  if (party.consent?.choice === "ACCEPT") return nominatedId;
  return "";
}

export function partiesAgree(parties: ConsentParty[], nominatedId: string): boolean {
  const ids = parties
    .map((party) => partyNeutralId(party, nominatedId))
    .filter(Boolean);
  return new Set(ids).size <= 1;
}

export function appointmentConsentState(input: {
  matterType: string;
  now: Date;
  days: number;
  blockDays?: number;
  firstNoticeAt: Date | null;
  consent: StoredConsent | null;
  parties?: ConsentParty[];
  nominatedNeutralId?: string;
  documentKinds: Iterable<string>;
}): ConsentState {
  if (input.matterType !== "ARBITRATION") return NOT_REQUIRED;
  const kinds = new Set(input.documentKinds);
  if (OVERRIDE_DOCUMENT_KINDS.some((kind) => kinds.has(kind))) {
    return { required: true, phase: "override", warning: "", awardBlocked: false, hearingBookingOpen: true };
  }
  const parties = input.parties && input.parties.length > 0
    ? input.parties
    : [{ id: "", name: "", consent: input.consent }];
  if (parties.some((party) => party.consent?.choice === "OBJECT")) {
    return {
      required: true,
      phase: "objected",
      warning: NO_CONSENT_WARNING,
      awardBlocked: true,
      hearingBookingOpen: false,
    };
  }
  const agreed = partiesAgree(parties, input.nominatedNeutralId ?? "");
  const complete = agreed && parties.every((party) => validConsent(party.consent));
  if (complete) {
    const picked = parties.some((party) => party.consent?.choice === "PANEL");
    return {
      required: true,
      phase: picked ? "panel" : "accepted",
      warning: "",
      awardBlocked: false,
      hearingBookingOpen: true,
    };
  }
  if (!agreed) {
    return {
      required: true,
      phase: "objected",
      warning: NO_CONSENT_WARNING,
      awardBlocked: true,
      hearingBookingOpen: false,
    };
  }
  const blockDays = Number.isInteger(input.blockDays) && (input.blockDays ?? 0) >= 1
    ? input.blockDays!
    : CONSENT_BLOCK_DAYS_DEFAULT;
  const reminderDays = Math.min(input.days, blockDays);
  const reminded = input.firstNoticeAt ? input.now.getTime() > consentDueAt(input.firstNoticeAt, reminderDays).getTime() : false;
  const expired = input.firstNoticeAt ? input.now.getTime() > consentDueAt(input.firstNoticeAt, blockDays).getTime() : false;
  if (expired) {
    return { required: true, phase: "expired", warning: NO_CONSENT_WARNING, awardBlocked: true, hearingBookingOpen: false };
  }
  if (reminded) {
    return { required: true, phase: "reminder", warning: CONSENT_REMINDER, awardBlocked: false, hearingBookingOpen: false };
  }
  return { required: true, phase: "pending", warning: "", awardBlocked: false, hearingBookingOpen: false };
}

export function appointmentParagraph(input: {
  consent: StoredConsent | null;
  documentKinds: Iterable<string>;
  arbitratorName: string;
  nominatedName: string;
}): string {
  const kinds = new Set(input.documentKinds);
  const arbitrator = input.arbitratorName.trim() || "the arbitrator named on this case";
  if (kinds.has("SECTION_11_ORDER")) {
    return `The arbitrator, ${arbitrator}, was appointed by an order of the Court under Section 11 of the Arbitration and Conciliation Act, 1996. A copy of that order is on the case file.`;
  }
  if (input.consent?.choice === "PANEL" && validConsent(input.consent)) {
    const when = input.consent.recordedAtIst || istStamp(input.consent.recordedAt);
    const nominated = input.nominatedName.trim();
    const earlier = nominated ? ` The bank had nominated ${nominated}. That nomination was not the appointment.` : "";
    return `On ${when}, ${input.consent.typedName} chose ${input.consent.chosenNeutralName} from the panel of arbitrators offered after the dispute had arisen.${earlier}`;
  }
  if (input.consent?.choice === "ACCEPT" && validConsent(input.consent)) {
    const when = input.consent.recordedAtIst || istStamp(input.consent.recordedAt);
    return `On ${when}, ${input.consent.typedName} accepted ${arbitrator} as sole arbitrator and, in writing, waived any ineligibility under Section 12(5) of the Arbitration and Conciliation Act, 1996.`;
  }
  if (kinds.has("SIGNED_CONSENT")) {
    return `The arbitrator, ${arbitrator}, was appointed by a signed consent of the parties. A copy of that consent is on the case file.`;
  }
  return "";
}

export function certificateLines(input: {
  refNo: string;
  bank: string;
  customer: string;
  choice: ConsentChoice;
  typedName: string;
  arbitratorName: string;
  chosenName: string;
  objection: string;
  shownText: string;
  recordedAtIst: string;
  ip: string;
  userAgent: string;
}): string[] {
  const choiceLine = input.choice === "ACCEPT"
    ? `Choice: accepted ${input.arbitratorName} and waived Section 12(5) ineligibility in writing.`
    : input.choice === "PANEL"
      ? `Choice: chose ${input.chosenName} from the panel.`
      : "Choice: none of these / I object.";
  return [
    "Arbitrator consent record",
    `Case ${input.refNo}`,
    `${input.bank} and ${input.customer}`,
    choiceLine,
    `Typed name: ${input.typedName}`,
    input.choice === "OBJECT" ? `Objection: ${input.objection}` : "",
    `Recorded: ${input.recordedAtIst}`,
    `IP: ${input.ip || "—"}`,
    `Browser: ${input.userAgent || "—"}`,
    "Text shown on the case page:",
    input.shownText,
    "This record is not edited after it is saved.",
  ].filter(Boolean);
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

export function slotsOnArbitratorTrack(
  rules: HearingRules,
  busy: BusyInterval[],
  count: number,
  from: Date,
): { ok: true; slots: HearingSlot[] } | { ok: false; error: string } {
  if (count < 1) return { ok: true, slots: [] };
  let cursor = from;
  let lastError = "There is not enough open hearing time on that arbitrator’s list.";
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const placed = assignHearingSlots(count, { ...rules, start: cursor }, busy);
    if (placed.ok) return placed;
    lastError = placed.error;
    const key = indiaDateKey(cursor);
    const morning = indiaDateTime(key, clockText(rules.windowStart));
    if (morning && cursor.getTime() < morning.getTime()) {
      cursor = morning;
      continue;
    }
    const nextMorning = indiaDateTime(addDays(key, 1), clockText(rules.windowStart));
    if (!nextMorning) break;
    cursor = nextMorning;
  }
  return { ok: false, error: lastError };
}
