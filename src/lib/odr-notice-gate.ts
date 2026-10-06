// Arbitration hearing notices wait until the tribunal papers are on the case.
// Mediation is not gated. This does not decide how the arbitrator was appointed.

export const ARBITRATION_NOTICE_DOCS = [
  { id: "SECTION_12_DISCLOSURE", label: "Section 12 disclosure" },
  { id: "ARBITRATOR_ACCEPTANCE", label: "Arbitrator acceptance" },
  { id: "SECTION_21", label: "Section 21 notice" },
] as const;

export function arbitrationNoticeGaps(matterType: string, kinds: Iterable<string>): string[] {
  if (matterType !== "ARBITRATION") return [];
  const have = new Set(kinds);
  return ARBITRATION_NOTICE_DOCS.filter((doc) => !have.has(doc.id)).map((doc) => doc.label);
}

export function arbitrationNoticeError(missing: string[]): string {
  if (missing.length === 0) return "";
  return `Hearing notices stay held until these are on the case: ${missing.join(", ")}.`;
}

export function showSection12Line(matterType: string, kinds: Iterable<string>): boolean {
  if (matterType !== "ARBITRATION") return false;
  return new Set(kinds).has("SECTION_12_DISCLOSURE");
}
