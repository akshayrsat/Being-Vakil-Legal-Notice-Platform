// The bank's grievance officer, printed on recovery messages and the notice page.

export const DEFAULT_OMBUDSMAN_MENTION =
  "If this is not resolved within 30 days, you may approach the RBI Integrated Ombudsman at https://cms.rbi.org.in. A complaint already pending before an arbitrator is not maintainable before the Ombudsman.";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export type GrievanceInfo = {
  officerName: string;
  officerPhone: string;
  officerEmail: string;
  ombudsman: string;
  wordingApprovedOn: string;
};

export const grievanceSelect = {
  grievanceOfficerName: true,
  grievanceOfficerPhone: true,
  grievanceOfficerEmail: true,
  grievanceOmbudsman: true,
  wordingApprovedOn: true,
} as const;

export function grievanceFromBank(bank: {
  grievanceOfficerName: string;
  grievanceOfficerPhone: string;
  grievanceOfficerEmail: string;
  grievanceOmbudsman: string;
  wordingApprovedOn: string;
}): GrievanceInfo {
  return {
    officerName: bank.grievanceOfficerName,
    officerPhone: bank.grievanceOfficerPhone,
    officerEmail: bank.grievanceOfficerEmail,
    ombudsman: bank.grievanceOmbudsman,
    wordingApprovedOn: bank.wordingApprovedOn,
  };
}

export function approvedOnLabel(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return "";
  const month = MONTHS[Number(match[2]) - 1];
  const day = Number(match[3]);
  if (!month || day < 1 || day > 31) return "";
  return `${day} ${month} ${match[1]}`;
}

export function grievanceFooter(info: GrievanceInfo): string {
  const officer = [info.officerName, info.officerPhone, info.officerEmail].map((part) => part.trim()).filter(Boolean);
  const lines = [
    "Bank grievance redressal",
    officer.length > 0 ? officer.join(" · ") : "The bank has not yet recorded its grievance officer.",
    info.ombudsman.trim() || DEFAULT_OMBUDSMAN_MENTION,
  ];
  const approved = approvedOnLabel(info.wordingApprovedOn);
  if (approved) lines.push(`Wording approved by the bank on ${approved}.`);
  return lines.join("\n");
}

export function withGrievanceFooter(body: string, info: GrievanceInfo): string {
  const footer = grievanceFooter(info);
  if (body.includes(footer)) return body;
  const trimmed = body.trimEnd();
  return trimmed ? `${trimmed}\n\n${footer}` : footer;
}
