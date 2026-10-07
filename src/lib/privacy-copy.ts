// DRAFT FOR COUNSEL REVIEW. This wording is a technical draft for the product.
// It is not legal advice and it is not a final privacy notice.

export const PRIVACY_FIRM = "Being Vakil Associates";
export const DEFAULT_PRIVACY_OFFICER_LABEL = "Privacy officer, Being Vakil Associates";
export const DEFAULT_PRIVACY_EMAIL = "contact@beingvakil.in";
export const DEFAULT_PRIVACY_PHONE = "+91 9653331393";
export const DEFAULT_REQUEST_DUE_DAYS = 30;

export const SUBPROCESSORS = [
  "MSG91",
  "Meta WhatsApp",
  "Google Meet and Google Calendar",
  "India Post",
  "Google Cloud India",
] as const;

export function privacyOfficerLabel(name: string): string {
  const trimmed = name.trim();
  return trimmed || DEFAULT_PRIVACY_OFFICER_LABEL;
}

export function privacyPurposeLine(purpose: "notice" | "odr"): string {
  const work = purpose === "notice" ? "deliver the legal notice" : "conduct the ODR proceeding";
  return `${PRIVACY_FIRM} processes this data on behalf of the bank to ${work}.`;
}

export const INCIDENT_CHECKS = [
  { id: "contained", label: "Contain the data" },
  { id: "scope", label: "Record which banks and how many people are affected" },
  { id: "bank", label: "Note when the bank was told" },
  { id: "board", label: "Note when the Board was told" },
  { id: "people", label: "Note when the people were told" },
] as const;

export const DOWNLOADS_NOT_KEPT =
  "Downloaded reports are not kept on this platform. A file already saved on a computer is outside this schedule.";
