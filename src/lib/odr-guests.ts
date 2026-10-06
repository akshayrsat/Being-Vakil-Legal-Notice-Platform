// Who is invited to a hearing, and the morning list for an arbitrator.
// The customer is never a calendar guest. They join from the case page.

export const INVITES_NOT_SENT = "invites not sent (ODR sending off)";

export const COHOST_FALLBACK = "The arbitrator is a guest. mediator@ remains the host.";

export const MEET_WORKSPACE_NOTE =
  "Calendar guests are the assigned arbitrator, or every panel member when the case has a panel, and the bank’s representatives. The customer is not invited. The Meet space is set to RESTRICTED so those guests join without knocking and everyone else waits to be admitted. Workspace Business Starter (the Base column) does not include co-hosts or waiting rooms, so a knock cannot be enforced there. If co-host cannot be set, the arbitrator stays a guest and mediator@ remains the host. Domain-wide delegation for the mediator mailbox needs the Meet scope meetings.space.settings.";

export type HearingGuest = {
  role: "arbitrator" | "bank_rep";
  name: string;
  email: string;
};

export type NamedEmail = {
  name: string;
  email: string;
};

const INDIA = "Asia/Kolkata";

export function validGuestEmail(value: string): boolean {
  const email = value.trim().toLowerCase();
  const at = email.indexOf("@");
  return at > 0 && email.slice(at + 1).includes(".") && !email.includes(" ");
}

export function selectHearingGuests(input: {
  live: boolean;
  panel: Array<NamedEmail & { id?: string }>;
  assigned: NamedEmail;
  representatives: NamedEmail[];
}): { guests: HearingGuest[]; inviteNote: string } {
  if (!input.live) return { guests: [], inviteNote: INVITES_NOT_SENT };
  const arbitrators = input.panel.length > 1 ? input.panel : [input.assigned];
  const rows: HearingGuest[] = [];
  const missing: string[] = [];
  const push = (role: HearingGuest["role"], person: NamedEmail) => {
    const email = person.email.trim().toLowerCase();
    const name = person.name.trim();
    if (!validGuestEmail(email)) {
      if (name) missing.push(name);
      return;
    }
    rows.push({ role, name: name || email, email });
  };
  for (const person of arbitrators) push("arbitrator", person);
  for (const person of input.representatives) push("bank_rep", person);
  const seen = new Set<string>();
  const guests = rows.filter((row) => {
    if (seen.has(row.email)) return false;
    seen.add(row.email);
    return true;
  });
  if (guests.length === 0) {
    return { guests, inviteNote: "No arbitrator or bank representative email is on file, so no calendar guest was added." };
  }
  const gap = missing.length ? ` No email for ${missing.join(", ")}, so that person was not invited.` : "";
  return { guests, inviteNote: `Calendar guests invited.${gap}` };
}

export function neutralHearsCase(neutralId: string, panelIds: string[], assignedId: string): boolean {
  if (panelIds.length > 1) return panelIds.includes(neutralId);
  return Boolean(assignedId) && assignedId === neutralId;
}

export function indiaClock(date: Date): { day: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: INDIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const hour = Number(pick("hour"));
  return {
    day: `${pick("year")}-${pick("month")}-${pick("day")}`,
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number(pick("minute")) || 0,
  };
}

export function scheduleDigestDue(now: Date): boolean {
  const clock = indiaClock(now);
  return clock.hour > 7 || (clock.hour === 7 && clock.minute >= 30);
}

export type ScheduleRow = {
  customerName: string;
  refNo: string;
  time: string;
  meetLink: string;
  caseUrl: string;
};

export function scheduleEmailBody(input: { arbitratorName: string; day: string; rows: ScheduleRow[] }): string {
  const lines = [`Hearings for ${input.arbitratorName.trim() || "the arbitrator"} on ${input.day}.`, ""];
  for (const row of input.rows) {
    lines.push(
      row.customerName,
      `Case ${row.refNo}`,
      row.time,
      `Meet: ${row.meetLink || "Meet link not ready"}`,
      `Case page: ${row.caseUrl}`,
      "",
    );
  }
  return lines.join("\n").trim();
}

export function scheduleDigestPlan(input: { live: boolean; templateId: string }): { send: boolean; detail: string } {
  if (!input.live) return { send: false, detail: "not sent (ODR sending off)" };
  if (!input.templateId.trim()) return { send: false, detail: "The schedule email template is not set. Nothing was sent." };
  return { send: true, detail: "" };
}

export function admissionSummary(input: { accessSet: boolean; cohostSet: boolean }): string {
  const access = input.accessSet
    ? "Invited guests join without knocking. The customer waits to be admitted."
    : "Meet admission could not be changed. Business Starter does not include waiting rooms, so a knock may not be enforced.";
  const host = input.cohostSet ? "Arbitrators are co-hosts." : COHOST_FALLBACK;
  return `${access} ${host}`;
}

export function parseInvitedGuests(raw: string | null | undefined): HearingGuest[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as Partial<HearingGuest>;
      const email = String(row.email ?? "").trim().toLowerCase();
      const role = row.role === "bank_rep" ? "bank_rep" : row.role === "arbitrator" ? "arbitrator" : "";
      if (!role || !validGuestEmail(email)) return [];
      return [{ role, name: String(row.name ?? "").trim() || email, email }];
    });
  } catch {
    return [];
  }
}

export type GuestVisit = HearingGuest & { joinedAt: string; leftAt: string };

export function parseGuestVisits(raw: string | null | undefined): GuestVisit[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as Partial<GuestVisit>;
      const email = String(row.email ?? "").trim();
      const role = row.role === "bank_rep" ? "bank_rep" : row.role === "arbitrator" ? "arbitrator" : "";
      if (!role) return [];
      return [{
        role,
        name: String(row.name ?? "").trim() || email,
        email,
        joinedAt: String(row.joinedAt ?? "").trim(),
        leftAt: String(row.leftAt ?? "").trim(),
      }];
    });
  } catch {
    return [];
  }
}
