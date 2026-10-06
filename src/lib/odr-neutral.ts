// The saved contact on an arbitrator or mediator.
// Upload, a case, a panel, and a customer's panel choice store the person's id.
// Invites, the morning list, and hearing notices read the email and mobile from that row.

import { validGuestEmail } from "./odr-guests";

export type NeutralContact = {
  id: string;
  name: string;
  email: string;
  mobile: string;
};

export type NeutralDraft = {
  name: string;
  qualification: string;
  enrolmentNo: string;
  email: string;
  mobile: string;
  active: boolean;
  roles?: string;
  empanelment?: string;
  mciRegistration?: string;
};

export function indianMobileDigits(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  const ten = digits.length === 12 && digits.startsWith("91")
    ? digits.slice(2)
    : digits.length === 11 && digits.startsWith("0")
      ? digits.slice(1)
      : digits.length === 10
        ? digits
        : "";
  return /^[6-9]\d{9}$/.test(ten) ? ten : null;
}

export function neutralContactError(input: { email: string; mobile: string }): string | null {
  if (!validGuestEmail(input.email)) return "Enter the arbitrator’s email.";
  if (!indianMobileDigits(input.mobile)) return "Enter a 10-digit Indian mobile number.";
  return null;
}

export function contactsForHearing(input: {
  panelIds: string[];
  assignedId: string;
  saved: NeutralContact[];
}): NeutralContact[] {
  const ids = input.panelIds.length > 1 ? input.panelIds : input.assignedId ? [input.assignedId] : [];
  const byId = new Map(input.saved.map((row) => [row.id, row]));
  const seen = new Set<string>();
  return ids.flatMap((id) => {
    if (seen.has(id)) return [];
    seen.add(id);
    const row = byId.get(id);
    return row ? [row] : [];
  });
}

export function neutralEditSummary(before: NeutralDraft, after: NeutralDraft): string {
  const fields: string[] = [];
  if (before.name !== after.name) fields.push(`name from ${before.name} to ${after.name}`);
  if (before.qualification !== after.qualification) {
    fields.push(`qualification from ${before.qualification || "blank"} to ${after.qualification || "blank"}`);
  }
  if (before.enrolmentNo !== after.enrolmentNo) {
    fields.push(`enrolment from ${before.enrolmentNo || "blank"} to ${after.enrolmentNo || "blank"}`);
  }
  if (before.email !== after.email) fields.push(`email from ${before.email || "blank"} to ${after.email}`);
  if (before.mobile !== after.mobile) fields.push(`mobile from ${before.mobile || "blank"} to ${after.mobile}`);
  if ((before.roles ?? "") !== (after.roles ?? "")) {
    fields.push(`roles from ${before.roles || "blank"} to ${after.roles || "blank"}`);
  }
  if ((before.empanelment ?? "") !== (after.empanelment ?? "")) {
    fields.push(`empanelment from ${before.empanelment || "blank"} to ${after.empanelment || "blank"}`);
  }
  if ((before.mciRegistration ?? "") !== (after.mciRegistration ?? "")) {
    fields.push(`Mediation Council registration from ${before.mciRegistration || "blank"} to ${after.mciRegistration || "blank"}`);
  }
  const parts: string[] = [];
  if (fields.length > 0) parts.push(`Changed ${fields.join(", ")}`);
  if (before.active !== after.active) parts.push(after.active ? "Marked active" : "Marked inactive");
  if (parts.length === 0) return "";
  return `${parts.join(". ")}.`;
}
