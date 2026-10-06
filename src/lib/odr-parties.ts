// Co-borrowers and guarantors as their own respondents.
// The old free-text field still displays when no structured row was entered.

export type OdrPartyInput = {
  name: string;
  role: string;
  mobile: string;
  email: string;
  address: string;
};

const ROLES = ["Co-borrower", "Guarantor"] as const;

export function partyRole(value: string): string {
  const text = value.trim().toLowerCase();
  if (text.startsWith("guarant")) return "Guarantor";
  if (text.startsWith("co")) return "Co-borrower";
  if ((ROLES as readonly string[]).includes(value.trim())) return value.trim();
  return value.trim().slice(0, 40) || "Co-borrower";
}

export function partiesFromColumns(input: {
  coParties: string;
  slots: Array<{ name: string; role: string; mobile: string; email: string; address: string }>;
}): OdrPartyInput[] {
  const structured = input.slots
    .map((slot) => ({
      name: slot.name.trim().slice(0, 160),
      role: partyRole(slot.role),
      mobile: slot.mobile.trim().slice(0, 20),
      email: slot.email.trim().slice(0, 160),
      address: slot.address.trim().slice(0, 400),
    }))
    .filter((slot) => slot.name);
  if (structured.length > 0) return structured;
  return input.coParties
    .split(/[,;\n]/)
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({ name: name.slice(0, 160), role: "Co-borrower", mobile: "", email: "", address: "" }));
}

export function partyAttendanceMap(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (value === "JOINED" || value === "NO_SHOW" || value === "PENDING") out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export function withPartyAttendance(raw: string, partyId: string, attendance: "JOINED" | "NO_SHOW"): string {
  const map = partyAttendanceMap(raw);
  map[partyId] = attendance;
  return JSON.stringify(map);
}

export function partyAttendanceLabel(value: string): string {
  if (value === "JOINED") return "Joined";
  if (value === "NO_SHOW") return "No-show";
  return "Pending";
}

export type NoticeRecipient = { respondentId: string; mobile: string; email: string };

export function noticeRecipients(input: {
  mobile: string;
  email: string;
  parties: Array<{ id: string; mobile: string; email: string }>;
}): NoticeRecipient[] {
  return [
    { respondentId: "", mobile: input.mobile, email: input.email },
    ...input.parties.map((party) => ({
      respondentId: party.id,
      mobile: party.mobile,
      email: party.email,
    })),
  ];
}
