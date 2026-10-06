// Words and codes for an ODR case. Status is stored as text so SQLite and Postgres match.

export const ODR_MATTERS = ["ARBITRATION", "MEDIATION"] as const;
export type OdrMatter = (typeof ODR_MATTERS)[number];

export const ODR_STATUSES = [
  { id: "NOTICE_SENT", label: "Notice sent" },
  { id: "HEARING_SCHEDULED", label: "Hearing scheduled" },
  { id: "JOINED", label: "Joined" },
  { id: "NO_SHOW", label: "No-show" },
  { id: "NEXT_DATE_GIVEN", label: "Next date given" },
  { id: "SETTLED", label: "Settled" },
  { id: "AWARD_PASSED", label: "Award passed" },
  { id: "CLOSED", label: "Closed" },
] as const;

export type OdrStatusId = (typeof ODR_STATUSES)[number]["id"];

export const ODR_STAGES = [
  { id: "NOTICE", label: "Notice" },
  { id: "APPOINTED", label: "Arbitrator appointed" },
  { id: "HEARING", label: "Hearing" },
  { id: "DEFENCE", label: "Statement of defence" },
  { id: "EVIDENCE", label: "Evidence" },
  { id: "ARGUMENTS", label: "Arguments" },
  { id: "AWARD", label: "Award" },
] as const;

export type OdrStageId = (typeof ODR_STAGES)[number]["id"];

export const STAFF_DOCUMENT_KINDS = [
  { id: "LOAN_AGREEMENT", label: "Loan agreement" },
  { id: "STATEMENT_OF_ACCOUNT", label: "Statement of account" },
  { id: "SECTION_12_DISCLOSURE", label: "Section 12 disclosure" },
  { id: "ARBITRATOR_ACCEPTANCE", label: "Arbitrator acceptance" },
  { id: "SECTION_21", label: "Section 21 notice" },
  { id: "STATEMENT_OF_CLAIM", label: "Statement of claim" },
  { id: "APPOINTMENT", label: "Appointment letter" },
  { id: "FINAL_OPPORTUNITY", label: "Final opportunity notice" },
  { id: "EX_PARTE_ORDER", label: "Arbitrator’s ex parte order" },
  { id: "ORDER", label: "Order" },
  { id: "AWARD", label: "Award" },
  { id: "EVIDENCE", label: "Evidence" },
  { id: "OTHER", label: "Other" },
] as const;

export const CUSTOMER_DOCUMENT_KINDS = [
  { id: "REPLY", label: "Reply" },
  { id: "DEFENCE", label: "Statement of defence" },
  { id: "PAYMENT_PROOF", label: "Proof of payment" },
] as const;

const STATUS_IDS = new Set<string>(ODR_STATUSES.map((item) => item.id));
const STAGE_IDS = new Set<string>(ODR_STAGES.map((item) => item.id));
const DOC_IDS = new Set<string>([
  ...STAFF_DOCUMENT_KINDS.map((item) => item.id),
  ...CUSTOMER_DOCUMENT_KINDS.map((item) => item.id),
]);

export function isOdrMatter(value: string): value is OdrMatter {
  return value === "ARBITRATION" || value === "MEDIATION";
}

export function isOdrStatus(value: string): value is OdrStatusId {
  return STATUS_IDS.has(value);
}

export function isOdrStage(value: string): value is OdrStageId {
  return STAGE_IDS.has(value);
}

export function isOdrDocumentKind(value: string): boolean {
  return DOC_IDS.has(value) || value in PAPER_LABELS;
}

export function odrMatterLabel(value: string): string {
  if (value === "MEDIATION") return "Mediation";
  if (value === "ARBITRATION") return "Arbitration";
  return "ODR";
}

export function odrNeutralRole(matterType: string): string {
  return matterType === "MEDIATION" ? "Mediator" : "Arbitrator";
}

export function odrStatusLabel(value: string): string {
  return ODR_STATUSES.find((item) => item.id === value)?.label ?? value;
}

export function odrStageLabel(value: string, matterType = "ARBITRATION"): string {
  if (value === "APPOINTED") {
    return matterType === "MEDIATION" ? "Mediator appointed" : "Arbitrator appointed";
  }
  return ODR_STAGES.find((item) => item.id === value)?.label ?? value;
}

const PAPER_LABELS: Record<string, string> = {
  AWARD_DRAFT: "Award draft",
  SETTLEMENT_DRAFT: "Settlement draft",
  AWARD_SIGNED: "Signed award",
  SETTLEMENT_SIGNED: "Signed settlement",
};

export function odrDocumentLabel(value: string): string {
  return (
    PAPER_LABELS[value] ??
    STAFF_DOCUMENT_KINDS.find((item) => item.id === value)?.label ??
    CUSTOMER_DOCUMENT_KINDS.find((item) => item.id === value)?.label ??
    value
  );
}

export function terminalOdrStatus(status: string): boolean {
  return status === "SETTLED" || status === "AWARD_PASSED" || status === "CLOSED";
}

export type StageMark = "done" | "current" | "upcoming";

export function stageTracker(current: string, matterType = "ARBITRATION"): Array<{
  id: string;
  label: string;
  mark: StageMark;
}> {
  const index = Math.max(
    0,
    ODR_STAGES.findIndex((item) => item.id === (isOdrStage(current) ? current : "HEARING")),
  );
  return ODR_STAGES.map((item, position) => ({
    id: item.id,
    label: odrStageLabel(item.id, matterType),
    mark: position < index ? "done" : position === index ? "current" : "upcoming",
  }));
}
