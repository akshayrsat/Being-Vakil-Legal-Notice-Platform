// Legal route for one case. It chooses the wording, the outcome document,
// and whether an ex parte order is possible. Empty stored values follow the older matter type.

export const LEGAL_ROUTES = ["ARBITRATION", "CONCILIATION", "MEDIATION", "LOK_ADALAT"] as const;
export type LegalRoute = (typeof LEGAL_ROUTES)[number];

export const NEUTRAL_ROLES = ["ARBITRATOR", "MEDIATOR", "CONCILIATOR"] as const;
export type NeutralRole = (typeof NEUTRAL_ROLES)[number];

export const LOK_ADALAT_STATUSES = ["referred", "settled", "not_settled"] as const;
export type LokAdalatStatus = (typeof LOK_ADALAT_STATUSES)[number];

export const CONCILIATION_REPLY_DAYS = 30;
export const SECTION_29A_MONTHS = 12;
export const SECTION_29A_EXTENSION_MONTHS = 6;
export const SECTION_34_MONTHS = 3;
export const LIMITATION_WARNING_DAYS = 180;

export const CONCILIATION_STATUS_LINE =
  "This settlement agreement is signed by the parties and authenticated by the conciliator under Section 73 of the Arbitration and Conciliation Act, 1996. Under Section 74 it has the same status and effect as an arbitral award on agreed terms.";

export const RECORDING_OFF_NOTE = "This session is not recorded.";

export const MISSED_SESSION_NOTE =
  "A missed session is rescheduled or the matter is closed. It is not heard ex parte.";

export const INSTALMENT_WARNING =
  "Instalments longer than 3 months count as restructuring. The bank’s credit approval is required.";

export const SAME_NEUTRAL_BAR =
  "This person mediated or conciliated this case, so they cannot be the arbitrator.";

const ROUTE_LABELS: Record<LegalRoute, string> = {
  ARBITRATION: "Arbitration",
  CONCILIATION: "Conciliation (A&C Act Part III)",
  MEDIATION: "Contractual mediation",
  LOK_ADALAT: "Lok Adalat",
};

export function isLegalRoute(value: string): value is LegalRoute {
  return (LEGAL_ROUTES as readonly string[]).includes(value);
}

export function resolveLegalRoute(stored: string, matterType: string): LegalRoute {
  if (isLegalRoute(stored)) return stored;
  return matterType === "MEDIATION" ? "MEDIATION" : "ARBITRATION";
}

export function matterTypeForRoute(route: LegalRoute): "ARBITRATION" | "MEDIATION" {
  return route === "ARBITRATION" ? "ARBITRATION" : "MEDIATION";
}

export function legalRouteLabel(route: string): string {
  return isLegalRoute(route) ? ROUTE_LABELS[route] : "ODR";
}

export function exParteAllowed(route: string, matterType = "ARBITRATION"): boolean {
  return resolveLegalRoute(route, matterType) === "ARBITRATION";
}

export function hearingsAllowed(route: string, matterType = "ARBITRATION"): boolean {
  return resolveLegalRoute(route, matterType) !== "LOK_ADALAT";
}

export function outcomeKind(route: string, matterType = "ARBITRATION"): "award" | "settlement" | "conciliation" | "lok_adalat" {
  const resolved = resolveLegalRoute(route, matterType);
  if (resolved === "ARBITRATION") return "award";
  if (resolved === "CONCILIATION") return "conciliation";
  if (resolved === "LOK_ADALAT") return "lok_adalat";
  return "settlement";
}

export function neutralRoleForRoute(route: string, matterType = "ARBITRATION"): NeutralRole | "" {
  const resolved = resolveLegalRoute(route, matterType);
  if (resolved === "ARBITRATION") return "ARBITRATOR";
  if (resolved === "CONCILIATION") return "CONCILIATOR";
  if (resolved === "MEDIATION") return "MEDIATOR";
  return "";
}

export function parseNeutralRoles(value: string): NeutralRole[] {
  const found = new Set<NeutralRole>();
  for (const part of value.split(/[^A-Za-z]+/)) {
    const role = part.trim().toUpperCase();
    if ((NEUTRAL_ROLES as readonly string[]).includes(role)) found.add(role as NeutralRole);
  }
  return NEUTRAL_ROLES.filter((role) => found.has(role));
}

export function formatNeutralRoles(roles: Iterable<string>): string {
  return parseNeutralRoles([...roles].join(",")).join(",");
}

export function neutralRoleError(roles: string, needed: NeutralRole | ""): string {
  if (!needed) return "";
  const held = parseNeutralRoles(roles);
  const list = held.length > 0 ? held : (["ARBITRATOR"] as NeutralRole[]);
  if (list.includes(needed)) return "";
  const label = needed === "ARBITRATOR" ? "an arbitrator" : needed === "MEDIATOR" ? "a mediator" : "a conciliator";
  return `This person is not marked as ${label}.`;
}

export function sameNeutralBar(input: { nextRole: string; priorRoles: Iterable<string> }): string {
  if (input.nextRole !== "ARBITRATOR") return "";
  const prior = new Set([...input.priorRoles].map((role) => role.toUpperCase()));
  if (prior.has("MEDIATOR") || prior.has("CONCILIATOR")) return SAME_NEUTRAL_BAR;
  return "";
}

export function addMonths(isoDate: string, months: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate) || !Number.isInteger(months)) return "";
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
  if (Number.isNaN(date.getTime())) return "";
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

export function daysUntil(isoDate: string, now: Date): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const [year, month, day] = isoDate.split("-").map(Number);
  const target = Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target - today) / 86400000);
}

export type CaseTimers = {
  awardDeadline: string;
  awardDeadlineWithExtension: string;
  section34Deadline: string;
  processDeadline: string;
  limitationWarning: string;
  awardNote: string;
  section34Note: string;
};

export function caseTimers(input: {
  route: string;
  pleadingsClosedOn: string;
  awardExtension: boolean;
  awardDeliveredOn: string;
  processDeadlineOn: string;
  limitationDate: string;
  now: Date;
}): CaseTimers {
  const route = resolveLegalRoute(input.route, "ARBITRATION");
  const awardDeadline = route === "ARBITRATION" ? addMonths(input.pleadingsClosedOn, SECTION_29A_MONTHS) : "";
  const awardDeadlineWithExtension = awardDeadline ? addMonths(input.pleadingsClosedOn, SECTION_29A_MONTHS + SECTION_29A_EXTENSION_MONTHS) : "";
  const section34Deadline = input.awardDeliveredOn ? addMonths(input.awardDeliveredOn, SECTION_34_MONTHS) : "";
  const processDeadline = route === "CONCILIATION" || route === "MEDIATION" ? input.processDeadlineOn : "";
  const remaining = daysUntil(input.limitationDate, input.now);
  const privateProcess = route === "CONCILIATION" || route === "MEDIATION" || route === "LOK_ADALAT";
  const limitationTail = privateProcess ? " Private mediation or conciliation does not stop limitation." : "";
  let limitationWarning = "";
  if (!input.limitationDate.trim()) {
    limitationWarning = `Set the limitation date.${limitationTail}`;
  } else if (remaining !== null && remaining < 0) {
    limitationWarning = `The limitation date has passed.${limitationTail}`;
  } else if (remaining !== null && remaining <= LIMITATION_WARNING_DAYS) {
    limitationWarning = `Less than 6 months remain before the limitation date.${limitationTail}`;
  }
  const awardNote = route !== "ARBITRATION"
    ? ""
    : input.pleadingsClosedOn
      ? input.awardExtension
        ? `Section 29A: the award is due by ${awardDeadlineWithExtension} (12 months from the close of pleadings, plus the 6-month extension).`
        : `Section 29A: the award is due by ${awardDeadline}, 12 months from the close of pleadings. A 6-month extension is not marked.`
      : "Section 29A runs for 12 months from the date pleadings are completed. That date is not on the case yet.";
  const section34Applies = route === "ARBITRATION" || route === "CONCILIATION";
  const section34Note = input.awardDeliveredOn
    ? `Section 34: a challenge is within 3 months of the award, ending ${section34Deadline}.`
    : section34Applies
      ? "Section 34 runs for 3 months after a signed copy of the award is delivered. That date is not on the case yet."
      : "";
  return {
    awardDeadline: input.awardExtension ? awardDeadlineWithExtension : awardDeadline,
    awardDeadlineWithExtension,
    section34Deadline,
    processDeadline,
    limitationWarning,
    awardNote,
    section34Note,
  };
}

export function settlementGuard(input: { sanctionRef: string; instalmentMonths: number }): { error: string; warning: string } {
  const error = input.sanctionRef.trim()
    ? ""
    : "Enter the bank’s settlement sanction reference before generating this document.";
  const months = Number.isInteger(input.instalmentMonths) ? input.instalmentMonths : 0;
  return { error, warning: months > 3 ? INSTALMENT_WARNING : "" };
}

export function instalmentMonthSpan(dates: string[]): number {
  const parsed = dates
    .map((value) => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ""))
    .filter(Boolean)
    .sort();
  const first = parsed[0];
  const last = parsed.at(-1);
  if (!first || !last || first === last) return parsed.length > 1 ? 0 : 0;
  const [fy, fm] = first.split("-").map(Number);
  const [ly, lm] = last.split("-").map(Number);
  return (ly! - fy!) * 12 + (lm! - fm!);
}

export type RouteParty = { id: string; name: string };

export type StoredReply = { choice: string; recordedAt: Date };

export function conciliationState(input: {
  route: string;
  now: Date;
  invitedAt: Date | null;
  parties: Array<RouteParty & { reply: StoredReply | null }>;
}): { required: boolean; phase: "not_required" | "pending" | "accepted" | "declined"; note: string } {
  if (resolveLegalRoute(input.route, "ARBITRATION") !== "CONCILIATION") {
    return { required: false, phase: "not_required", note: "" };
  }
  const due = input.invitedAt
    ? new Date(input.invitedAt.getTime() + CONCILIATION_REPLY_DAYS * 86400000)
    : null;
  const late = Boolean(due && input.now.getTime() > due.getTime());
  const views = input.parties.map((party) => {
    if (party.reply?.choice === "ACCEPT" || party.reply?.choice === "DECLINE") return party.reply.choice;
    return late ? "DECLINE" : "";
  });
  if (views.some((choice) => choice === "DECLINE")) {
    return {
      required: true,
      phase: "declined",
      note: late && input.parties.some((party) => !party.reply)
        ? "Conciliation was declined. No reply within 30 days is a decline under Section 62."
        : "Conciliation was declined.",
    };
  }
  if (views.length > 0 && views.every((choice) => choice === "ACCEPT")) {
    return { required: true, phase: "accepted", note: "Every respondent accepted the invitation to conciliate." };
  }
  return {
    required: true,
    phase: "pending",
    note: "The invitation is open. No reply within 30 days is a decline under Section 62.",
  };
}

export function isLokAdalatStatus(value: string): value is LokAdalatStatus {
  return (LOK_ADALAT_STATUSES as readonly string[]).includes(value);
}

export function lokAdalatStatusLabel(value: string): string {
  if (value === "referred") return "Referred";
  if (value === "settled") return "Settled";
  if (value === "not_settled") return "Not settled";
  return "Not referred yet";
}

export const CONCILIATOR_DOCUMENT_KINDS = [
  "CONCILIATOR_CONSENT",
  "CONCILIATOR_DISCLOSURE",
  "CONFIDENTIALITY_UNDERTAKING",
] as const;

export function conciliationDocumentsReady(kinds: Iterable<string>): string {
  const found = new Set(kinds);
  const missing = CONCILIATOR_DOCUMENT_KINDS.filter((kind) => !found.has(kind));
  if (missing.length === 0) return "";
  return "Upload the conciliator’s consent, disclosure, and confidentiality undertaking before generating the settlement.";
}

export function routeNoticeText(route: string, fallback: string): string {
  const resolved = resolveLegalRoute(route, fallback === "MEDIATION" ? "MEDIATION" : "ARBITRATION");
  if (resolved === "CONCILIATION") {
    return [
      "This is a written invitation to conciliate under Section 62 of the Arbitration and Conciliation Act, 1996.",
      "You may accept or decline on your case page. If you do not reply within 30 days, the invitation is declined.",
      "A session is not a hearing. The conciliator does not decide the dispute, and the matter does not proceed if you do not join.",
      RECORDING_OFF_NOTE,
    ].join(" ");
  }
  if (resolved === "MEDIATION") {
    return [
      "This is a voluntary mediation. You may join or decline.",
      "A settlement is a contract, recorded only if the people who join agree.",
      MISSED_SESSION_NOTE,
      RECORDING_OFF_NOTE,
    ].join(" ");
  }
  if (resolved === "LOK_ADALAT") {
    return "This matter is referred to a Lok Adalat. A hearing is not held on this page. The Lok Adalat sits at the Legal Services Authority or the DRT.";
  }
  return "";
}
