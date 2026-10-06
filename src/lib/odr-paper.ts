// Turns a case, and the answers staff type, into the award or settlement template.

import { deliveryStatusLabel } from "./campaigns";
import { formatIndiaDateTime } from "./india-day";
import type { DocxModel } from "./odr-docx";
import { joinNames, tribunalHeading, tribunalRole } from "./odr-panel";
import { addAmounts, amountInWords, formatIndianAmount, parseAmount, subtractAmounts } from "./odr-money";
import { odrDocumentLabel } from "./odr-status";
import { normalizeHeader } from "./sheet-fields";

export const APPOINTMENT_WARNING =
  "Unilateral appointment by the bank can be set aside (Perkins Eastman and CORE, 2024). Name the mode in the agreement, a Section 11 order, or the parties’ consent.";

export const PAPER_DRAFT_KINDS = ["AWARD_DRAFT", "SETTLEMENT_DRAFT"] as const;
export const PAPER_SIGNED_KINDS = ["AWARD_SIGNED", "SETTLEMENT_SIGNED"] as const;

export type PaperKind = "award" | "settlement";

export type PaperField = {
  key: string;
  label: string;
  group: string;
  input?: "text" | "textarea" | "date";
  hint?: string;
  required?: boolean;
};

export type PaperFlag = {
  key: string;
  label: string;
  group: string;
  hint?: string;
};

export type PaperRow = Record<string, string>;

export type PaperStore = {
  saved: boolean;
  fields: Record<string, string>;
  coRespondents: PaperRow[];
  obligors: PaperRow[];
  instalments: PaperRow[];
  deliveries: PaperRow[];
};

export type PaperHearing = {
  number: number;
  scheduledAt: Date;
  attendance: string;
  attendanceNote: string;
};

export type PaperMessage = {
  kind: string;
  channel: string;
  status: string;
  detail: string;
  providerId: string;
  createdAt: Date;
  toAddress: string;
};

export type PaperDocument = { kind: string; fileName: string; createdAt: Date };

export type PaperPost = { articleNumber: string; status: string; createdAt: Date; customerName: string };

export type PaperCase = {
  matterType: string;
  refNo: string;
  customerName: string;
  coParties: string;
  respondents?: Array<{ name: string; role: string; mobile: string; email: string; address: string }>;
  accountNumber: string;
  branch: string;
  mobile: string;
  email: string;
  address: string;
  loanAmount: string;
  claimAmount: string;
  asOnDate: string;
  neutralName: string;
  neutralQualification: string;
  neutralEnrolment: string;
  panel?: Array<{ name: string; qualification: string; enrolment: string }>;
  exParte: boolean;
  flaggedExParte: boolean;
  bankCounsel: string;
  paymentInfo: string;
  bankName: string;
  advocateName: string;
  opens: number;
  hearings: PaperHearing[];
  messages: PaperMessage[];
  documents: PaperDocument[];
  speedPosts: PaperPost[];
  agreementSeat?: string;
};

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

export function emptyPaper(): PaperStore {
  return { saved: false, fields: {}, coRespondents: [], obligors: [], instalments: [], deliveries: [] };
}

export function parsePaper(raw: string | null | undefined): PaperStore {
  const empty = emptyPaper();
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(raw) as Partial<PaperStore>;
    return {
      saved: parsed.saved === true,
      fields: stringMap(parsed.fields),
      coRespondents: rowList(parsed.coRespondents),
      obligors: rowList(parsed.obligors),
      instalments: rowList(parsed.instalments),
      deliveries: rowList(parsed.deliveries),
    };
  } catch {
    return empty;
  }
}

function stringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string") out[key] = item;
  }
  return out;
}

function rowList(value: unknown): PaperRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is PaperRow => !!item && typeof item === "object").map((item) => stringMap(item));
}

export function aadhaarLast4(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return digits.slice(-4);
}

export function maskCardNumber(account: string): string {
  const digits = account.replace(/\D/g, "");
  const last4 = digits.slice(-4);
  return last4 ? `XXXX XXXX XXXX ${last4}` : "";
}

const SEAT_HEADERS = new Set(["seat", "seat of arbitration", "arbitration seat", "seat city", "place of arbitration"]);

export function seatFromSheet(headers: string[], row: string[]): string {
  const index = headers.findIndex((header) => SEAT_HEADERS.has(normalizeHeader(header)));
  if (index < 0) return "";
  return (row[index] ?? "").trim().slice(0, 80);
}

export function seatFromBatch(headersJson: string, rowsJson: string, rowNumber: number): string {
  try {
    const headers = JSON.parse(headersJson) as unknown;
    const rows = JSON.parse(rowsJson) as unknown;
    if (!Array.isArray(headers) || !Array.isArray(rows)) return "";
    const row = rows[rowNumber - 2];
    if (!Array.isArray(row)) return "";
    return seatFromSheet(headers.map((header) => String(header)), row.map((cell) => String(cell ?? "")));
  } catch {
    return "";
  }
}

export function missingAwardRates(fields: Record<string, string>): string {
  if (!fields.pendente_lite_rate?.trim() || !fields.post_award_rate?.trim()) {
    return "Enter the pendente lite interest rate and the future interest rate. There is no default.";
  }
  return "";
}

export function splitParties(raw: string): string[] {
  return raw
    .split(/[,;\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function exParteSwitch(input: {
  exParte: boolean;
  flaggedExParte?: boolean;
  hearings?: Array<{ attendance: string }>;
}): boolean {
  return input.exParte;
}

export function exParteAwardError(input: { exParte: boolean; documents: string[] }): string {
  if (!input.exParte) return "";
  const hasNotice = input.documents.includes("FINAL_OPPORTUNITY");
  const hasOrder = input.documents.includes("EX_PARTE_ORDER");
  if (hasNotice && hasOrder) return "";
  return "An ex parte award needs the final-opportunity notice and the arbitrator’s ex parte order on the case.";
}

export function isPaperDraft(kind: string): boolean {
  return (PAPER_DRAFT_KINDS as readonly string[]).includes(kind);
}

export function isPaperSigned(kind: string): boolean {
  return (PAPER_SIGNED_KINDS as readonly string[]).includes(kind);
}

export function customerCanSeeDocument(kind: string): boolean {
  return !isPaperDraft(kind);
}

export function bankUserCanSeeDocument(kind: string): boolean {
  return !isPaperDraft(kind);
}

export function canReadOdrDocument(input: {
  documentBankId: string;
  viewerBankId: string;
  kind: string;
  canGenerate: boolean;
}): boolean {
  if (!input.viewerBankId || input.documentBankId !== input.viewerBankId) return false;
  if (isPaperDraft(input.kind) && !input.canGenerate) return false;
  return true;
}

export function dayOrdinal(day: number): string {
  const mod = day % 100;
  if (mod >= 11 && mod <= 13) return `${day}th`;
  if (day % 10 === 1) return `${day}st`;
  if (day % 10 === 2) return `${day}nd`;
  if (day % 10 === 3) return `${day}rd`;
  return `${day}th`;
}

export function civilDate(value: string): { day: number; month: string; year: string; dmy: string } | null {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31) return null;
  return { day, month: MONTHS[monthIndex] ?? "", year: match[1] ?? "", dmy: `${match[3]}.${match[2]}.${match[1]}` };
}

function dmy(value: string): string {
  return civilDate(value)?.dmy || value.trim();
}

function money(value: string): string {
  return formatIndianAmount(value) || value.trim();
}

function words(value: string): string {
  return amountInWords(value);
}

export function facilityFlags(label: string, account: string): { personal_loan: boolean; credit_card: boolean; label: string } {
  if (/credit\s*card/i.test(label)) return { personal_loan: false, credit_card: true, label: "Credit Card" };
  if (/personal|loan/i.test(label)) return { personal_loan: true, credit_card: false, label: label.trim() || "Personal Loan" };
  const digits = account.replace(/\D/g, "");
  if (digits.length >= 13 && digits.length <= 19) return { personal_loan: false, credit_card: true, label: "Credit Card" };
  return { personal_loan: true, credit_card: false, label: "Personal Loan" };
}

function flagOn(fields: Record<string, string>, key: string, fallback: boolean): boolean {
  const value = fields[key];
  if (value === "true" || value === "on" || value === "yes") return true;
  if (value === "false" || value === "off" || value === "no") return false;
  return fallback;
}

function noticeRows(item: PaperCase): PaperRow[] {
  const fromMessages = item.messages.map((message) => ({
    notice_description: noticeDescription(message.kind),
    notice_date: formatIndiaDateTime(message.createdAt),
    notice_mode: channelLabel(message.channel),
    notice_addressee: message.toAddress || item.customerName,
    notice_proof_ref: [message.providerId, message.detail].filter(Boolean).join(" — "),
    notice_status: deliveryStatusLabel(message.status),
  }));
  const fromPost = item.speedPosts.map((post) => ({
    notice_description: "Speed Post",
    notice_date: formatIndiaDateTime(post.createdAt),
    notice_mode: "Speed Post",
    notice_addressee: post.customerName || item.customerName,
    notice_proof_ref: post.articleNumber,
    notice_status: post.status,
  }));
  const rows = [...fromMessages, ...fromPost];
  if (item.opens > 0) {
    rows.push({
      notice_description: "Customer case page",
      notice_date: "",
      notice_mode: "Case page",
      notice_addressee: item.customerName,
      notice_proof_ref: `Opened ${item.opens} time${item.opens === 1 ? "" : "s"}`,
      notice_status: "Opened",
    });
  }
  return rows.map((row, index) => ({ ...row, notice_no: String(index + 1) }));
}

function noticeDescription(kind: string): string {
  if (kind === "FIRST") return "Notice of first hearing";
  if (kind === "NEXT") return "Notice of next hearing";
  if (kind === "REMINDER") return "Hearing reminder";
  return kind || "Notice";
}

function channelLabel(channel: string): string {
  if (channel === "SMS") return "SMS";
  if (channel === "EMAIL") return "E-mail";
  if (channel === "WHATSAPP") return "WhatsApp";
  return channel;
}

function hearingRows(item: PaperCase): PaperRow[] {
  return item.hearings.map((hearing) => ({
    hearing_no: String(hearing.number),
    hearing_datetime: formatIndiaDateTime(hearing.scheduledAt),
    hearing_mode: "Google Meet",
    hearing_claimant_attendance: "Not recorded",
    hearing_respondent_attendance:
      hearing.attendance === "JOINED" ? "Joined" : hearing.attendance === "NO_SHOW" ? "No-show" : "Pending",
    hearing_proceedings: hearing.attendanceNote,
  }));
}

function exhibitRows(item: PaperCase): PaperRow[] {
  return item.documents
    .filter((doc) => !isPaperDraft(doc.kind) && !isPaperSigned(doc.kind))
    .map((doc, index) => ({
      exhibit_no: `C-${index + 1}`,
      exhibit_description: `${odrDocumentLabel(doc.kind)} — ${doc.fileName}`,
      exhibit_date: formatIndiaDateTime(doc.createdAt),
    }));
}

function respondentSource(item: PaperCase): Array<{ name: string; role: string; mobile: string; email: string; address: string }> {
  if (item.respondents && item.respondents.length > 0) return item.respondents;
  return splitParties(item.coParties).map((name) => ({
    name,
    role: "Co-borrower",
    mobile: "",
    email: "",
    address: "",
  }));
}

export function defaultCoRespondents(item: PaperCase): PaperRow[] {
  return respondentSource(item).map((party, index) => ({
    co_respondent_no: String(index + 2),
    co_respondent_name: party.name,
    co_respondent_capacity: party.role,
    co_respondent_address: party.address,
    co_respondent_pan: "",
    co_respondent_mobile: party.mobile,
    co_respondent_email: party.email,
  }));
}

export function defaultObligors(item: PaperCase): PaperRow[] {
  return respondentSource(item).map((party) => ({
    obligor_name: party.name,
    obligor_capacity: party.role,
    obligor_age: "",
    obligor_address: party.address,
    obligor_pan: "",
    obligor_aadhaar_last4: "",
    obligor_mobile: party.mobile,
    obligor_email: party.email,
    obligor_sign_date: "",
    obligor_sign_mode: "",
  }));
}

export function prefillFields(item: PaperCase, paper: PaperStore, kind: PaperKind): Record<string, string> {
  const facility = facilityFlags(paper.fields.facility_type_label ?? "", item.accountNumber);
  const exParte = paper.saved
    ? flagOn(paper.fields, "ex_parte", false)
    : exParteSwitch(item);
  const arbitrationCase = item.matterType === "ARBITRATION";
  const base: Record<string, string> = {
    case_no: item.refNo,
    case_ref_no: item.refNo,
    arbitration_case_no: item.refNo,
    claimant_name: item.bankName,
    claimant_short_name: item.bankName,
    lender_name: item.bankName,
    lender_short_name: item.bankName,
    claimant_branch_address: item.branch,
    lender_unit_address: item.branch,
    respondent_name: item.customerName,
    borrower_name: item.customerName,
    respondent_address: item.address,
    borrower_address: item.address,
    respondent_mobile: item.mobile,
    borrower_mobile: item.mobile,
    respondent_email: item.email,
    borrower_email: item.email,
    account_no: facility.credit_card ? maskCardNumber(item.accountNumber) : item.accountNumber,
    facility_type_label: facility.label,
    loan_amount: money(item.loanAmount),
    claim_amount: money(item.claimAmount),
    total_outstanding: money(item.claimAmount),
    claim_as_on_date: item.asOnDate,
    outstanding_as_on_date: item.asOnDate,
    arbitrator_name: item.neutralName,
    arbitrator_qualification: item.neutralQualification,
    arbitrator_enrolment_no: item.neutralEnrolment,
    mediator_name: item.neutralName,
    mediator_qualification: item.neutralQualification,
    mediator_registration_no: item.neutralEnrolment,
    claimant_counsel_name: item.bankCounsel,
    payee_account_no: item.paymentInfo,
    seat_city: item.agreementSeat?.trim() ?? "",
    pendente_lite_rate: "",
    post_award_rate: "",
    ex_parte: exParte ? "true" : "false",
    mediation_act_applicable: "false",
    arbitration_pending: arbitrationCase ? "true" : "false",
    award_on_agreed_terms: kind === "settlement" && arbitrationCase ? "true" : "false",
    secured_loan: "false",
    has_guarantor: "false",
    other_proceedings: "false",
    time_extended: "false",
    personal_loan: facility.personal_loan ? "true" : "false",
    credit_card: facility.credit_card ? "true" : "false",
  };
  const merged = { ...base, ...paper.fields };
  merged.borrower_aadhaar_last4 = aadhaarLast4(merged.borrower_aadhaar_last4 ?? "");
  if (!paper.saved) {
    merged.ex_parte = exParte ? "true" : "false";
    merged.mediation_act_applicable = "false";
    merged.seat_city = item.agreementSeat?.trim() ?? "";
    merged.pendente_lite_rate = "";
    merged.post_award_rate = "";
  }
  return merged;
}

export function composeModel(item: PaperCase, paper: PaperStore, kind: PaperKind): DocxModel {
  const fields = prefillFields(item, paper, kind);
  const facility = facilityFlags(fields.facility_type_label ?? "", item.accountNumber);
  fields.facility_type_label = facility.label;
  fields.account_no = facility.credit_card ? maskCardNumber(fields.account_no || item.accountNumber) : fields.account_no || item.accountNumber;
  fields.personal_loan = facility.personal_loan ? "true" : "false";
  fields.credit_card = facility.credit_card ? "true" : "false";
  for (const key of MONEY_KEYS) if (fields[key]) fields[key] = money(fields[key]);
  const awardDate = civilDate(fields.award_date ?? "");
  fields.pendente_lite_interest_amount = interestAmount(fields);
  for (const key of DATE_KEYS) fields[key] = dmy(fields[key] ?? "");
  if (awardDate) {
    fields.award_day_ordinal = dayOrdinal(awardDate.day);
    fields.award_month = awardDate.month;
    fields.award_year = awardDate.year;
  }
  fields.claim_amount_words = words(fields.claim_amount ?? "");
  fields.award_amount_words = words(fields.award_amount ?? "");
  fields.total_outstanding_words = words(fields.total_outstanding ?? "");
  fields.settlement_amount_words = words(fields.settlement_amount ?? "");
  fields.costs_amount = addAmounts([fields.cost_arbitrator_fee ?? "", fields.cost_admin ?? "", fields.cost_other ?? ""]);
  fields.costs_amount_words = words(fields.costs_amount);
  fields.pendente_lite_interest_words = words(fields.pendente_lite_interest_amount);
  fields.award_total = addAmounts([
    fields.award_amount ?? "",
    fields.pendente_lite_interest_amount ?? "",
    fields.costs_amount ?? "",
  ]);
  fields.award_total_words = words(fields.award_total);
  fields.waiver_amount = subtractAmounts(fields.total_outstanding ?? "", fields.settlement_amount ?? "");
  const coRespondents = (paper.coRespondents.length ? paper.coRespondents : defaultCoRespondents(item)).map((row, index) => ({
    ...row,
    co_respondent_no: String(index + 2),
  }));
  const obligors = (paper.obligors.length ? paper.obligors : defaultObligors(item)).map((row) => ({
    ...row,
    obligor_aadhaar_last4: aadhaarLast4(row.obligor_aadhaar_last4 ?? ""),
  }));
  const hearings = hearingRows(item);
  const joined = hearings.map((row) => row.hearing_respondent_attendance).filter((value) => value === "Joined" || value === "No-show");
  if (!fields.respondent_appearance && joined.includes("Joined")) fields.respondent_appearance = item.advocateName || "In person";
  const tribunal = tribunalMembers(item);
  fields.tribunal_heading = tribunalHeading(tribunal.length);
  fields.arbitrator_name = joinNames(tribunal.map((member) => member.name)) || item.neutralName;
  fields.mediator_name = fields.arbitrator_name;
  const tribunalRows = tribunal.map((member) => ({
    arbitrator_name: member.name,
    tribunal_role: tribunalRole(tribunal.length),
    arbitrator_qualification: member.qualification,
    arbitrator_enrolment_no: member.enrolment,
    arbitrator_signature_mode: fields.arbitrator_signature_mode ?? "",
  }));
  return {
    values: fields,
    flags: {
      ex_parte: flagOn(fields, "ex_parte", false),
      personal_loan: facility.personal_loan,
      credit_card: facility.credit_card,
      time_extended: flagOn(fields, "time_extended", false),
      has_co_respondents: coRespondents.length > 0,
      arbitration_pending: flagOn(fields, "arbitration_pending", item.matterType === "ARBITRATION"),
      award_on_agreed_terms: flagOn(fields, "award_on_agreed_terms", kind === "settlement" && item.matterType === "ARBITRATION"),
      secured_loan: flagOn(fields, "secured_loan", false),
      has_guarantor: flagOn(fields, "has_guarantor", false),
      other_proceedings: flagOn(fields, "other_proceedings", false),
      mediation_act_applicable: flagOn(fields, "mediation_act_applicable", false),
    },
    repeats: { obligors, co_respondents: coRespondents, tribunal: tribunalRows },
    rows: {
      co_respondents: coRespondents,
      notice_log: noticeRows(item),
      hearing_log: hearings,
      exhibits: exhibitRows(item),
      award_delivery: paper.deliveries,
      instalments: paper.instalments,
      obligor_signatures: obligors,
    },
  };
}

function tribunalMembers(item: PaperCase): Array<{ name: string; qualification: string; enrolment: string }> {
  const panel = (item.panel ?? []).filter((member) => member.name.trim());
  if (panel.length > 0) return panel;
  if (!item.neutralName.trim()) return [];
  return [{ name: item.neutralName, qualification: item.neutralQualification, enrolment: item.neutralEnrolment }];
}

function interestAmount(fields: Record<string, string>): string {
  const rate = fields.pendente_lite_rate?.trim() ?? "";
  if (!rate) return "";
  const base = parseAmount(fields.interest_base_amount ?? "");
  const from = civilDate(fields.pendente_lite_from_date ?? "");
  const to = civilDate(fields.award_date ?? "");
  const rateNumber = Number(rate.replace(/[^\d.]/g, ""));
  if (!base || !from || !to || !Number.isFinite(rateNumber)) return "";
  const start = Date.UTC(Number(toYear(fields.pendente_lite_from_date ?? "")), fromMonth(fields.pendente_lite_from_date ?? ""), from.day);
  const end = Date.UTC(Number(toYear(fields.award_date ?? "")), fromMonth(fields.award_date ?? ""), to.day);
  const days = Math.max(0, Math.round((end - start) / 86400000));
  const paiseTotal = Math.round((base.rupees * 100 + base.paise) * (rateNumber / 100) * (days / 365));
  const rupees = Math.floor(paiseTotal / 100);
  const paise = Math.abs(paiseTotal % 100);
  return formatIndianAmount(`${rupees}.${String(paise).padStart(2, "0")}`);
}

function toYear(value: string): string {
  return value.slice(0, 4);
}

function fromMonth(value: string): number {
  return Number(value.slice(5, 7)) - 1;
}

const DATE_KEYS = [
  "agreement_date",
  "award_date",
  "application_date",
  "disbursement_date",
  "sec21_notice_date",
  "sec21_delivery_date",
  "appointment_date",
  "consent_date",
  "disclosure_sent_date",
  "po1_date",
  "soc_date",
  "soc_filing_date",
  "pleadings_completion_date",
  "time_extension_date",
  "default_date",
  "npa_date",
  "demand_notice_date",
  "sod_due_date",
  "final_opportunity_date",
  "ex_parte_order_date",
  "sod_date",
  "rejoinder_date",
  "final_arguments_date",
  "last_payment_date",
  "claimant_affidavit_date",
  "claimant_authority_date",
  "pendente_lite_from_date",
  "estamp_date",
  "execution_date",
  "lender_notice_date",
  "ots_sanction_date",
  "lender_authority_date",
  "lender_sign_date",
  "borrower_sign_date",
  "mediator_authentication_date",
];

const MONEY_KEYS = [
  "loan_amount",
  "claim_amount",
  "demand_notice_amount",
  "emi_amount",
  "credit_limit",
  "pl_principal_claimed",
  "pl_principal_allowed",
  "pl_interest_claimed",
  "pl_interest_allowed",
  "pl_penal_claimed",
  "pl_penal_allowed",
  "pl_other_claimed",
  "pl_other_allowed",
  "pl_credits_claimed",
  "pl_credits_allowed",
  "cc_principal_claimed",
  "cc_principal_allowed",
  "cc_finance_claimed",
  "cc_finance_allowed",
  "cc_late_claimed",
  "cc_late_allowed",
  "cc_other_claimed",
  "cc_other_allowed",
  "cc_credits_claimed",
  "cc_credits_allowed",
  "award_amount",
  "interest_base_amount",
  "cost_arbitrator_fee",
  "cost_admin",
  "cost_other",
  "total_outstanding",
  "principal_outstanding",
  "interest_charges_outstanding",
  "settlement_amount",
  "stamp_duty_amount",
];

function field(key: string, label: string, group: string, input?: PaperField["input"], hint?: string, required?: boolean): PaperField {
  return { key, label, group, input, hint, required };
}

export const AWARD_FIELDS: PaperField[] = [
  field("claimant_registered_office", "Bank registered office", "Bank"),
  field("claimant_entity_description", "What the bank is", "Bank", "textarea"),
  field("claimant_short_name", "Short name for the header", "Bank"),
  field("claimant_branch_address", "Branch or collections office", "Bank"),
  field("claimant_ar_name", "Authorised representative", "Bank"),
  field("claimant_ar_designation", "Representative’s designation", "Bank"),
  field("claimant_authority_document", "Authority document", "Bank"),
  field("claimant_authority_date", "Date of that authority", "Bank", "date"),
  field("claimant_counsel_name", "Advocate for the bank", "Bank"),
  field("agreement_title", "Agreement title", "Agreement"),
  field("agreement_date", "Agreement date", "Agreement", "date"),
  field("facility_type_label", "Personal loan or credit card", "Agreement", "text", "Type Personal Loan or Credit Card."),
  field("account_no", "Account or masked card number", "Agreement"),
  field("application_date", "Application date", "Agreement", "date"),
  field("arbitration_clause_no", "Arbitration clause number", "Agreement"),
  field("arbitration_clause_text", "Arbitration clause, word for word", "Agreement", "textarea"),
  field("contract_interest_rate", "Contract interest rate", "Agreement"),
  field("emi_tenure_months", "Tenure in months", "Agreement"),
  field("emi_amount", "EMI amount", "Agreement"),
  field("disbursement_date", "Disbursement date", "Agreement", "date"),
  field("disbursement_bank_account", "Disbursement account, masked", "Agreement"),
  field("credit_limit", "Credit limit", "Agreement"),
  field("loan_amount", "Loan amount", "Agreement"),
  field("sec21_notice_date", "Section 21 notice date", "Section 21 and appointment", "date"),
  field("sec21_notice_mode", "How the Section 21 notice was sent", "Section 21 and appointment"),
  field("sec21_delivery_date", "Date it was delivered", "Section 21 and appointment", "date"),
  field("sec21_proof_ref", "Speed Post or e-mail proof", "Section 21 and appointment"),
  field("appointment_mode", "How the arbitrator was appointed", "Before you generate", "textarea", APPOINTMENT_WARNING),
  field("appointment_letter_ref", "Appointment letter or order reference", "Section 21 and appointment"),
  field("appointment_date", "Appointment date", "Section 21 and appointment", "date"),
  field("consent_date", "Date the arbitrator accepted", "Section 21 and appointment", "date"),
  field("disclosure_sent_date", "Section 12 disclosure date", "Section 21 and appointment", "date"),
  field("disclosure_mode", "How the disclosure was sent", "Section 21 and appointment"),
  field("seat_city", "Seat of arbitration", "Before you generate", "text", "Leave this blank unless the agreement names a seat. Mumbai is not assumed."),
  field("po1_date", "Procedural Order No. 1 date", "Section 21 and appointment", "date"),
  field("claim_amount", "Claim amount", "Claim"),
  field("claim_as_on_date", "Claim as on", "Claim"),
  field("claimed_interest_rate", "Further interest claimed", "Claim"),
  field("pl_principal_claimed", "Principal claimed", "Personal loan figures"),
  field("pl_principal_allowed", "Principal allowed", "Personal loan figures"),
  field("pl_interest_claimed", "Interest claimed", "Personal loan figures"),
  field("pl_interest_allowed", "Interest allowed", "Personal loan figures"),
  field("pl_penal_claimed", "Penal charges claimed", "Personal loan figures"),
  field("pl_penal_allowed", "Penal charges allowed", "Personal loan figures"),
  field("pl_other_claimed", "Other charges claimed", "Personal loan figures"),
  field("pl_other_allowed", "Other charges allowed", "Personal loan figures"),
  field("pl_credits_claimed", "Credits claimed", "Personal loan figures"),
  field("pl_credits_allowed", "Credits allowed", "Personal loan figures"),
  field("cc_principal_claimed", "Card principal claimed", "Credit card figures"),
  field("cc_principal_allowed", "Card principal allowed", "Credit card figures"),
  field("cc_finance_claimed", "Finance charges claimed", "Credit card figures"),
  field("cc_finance_allowed", "Finance charges allowed", "Credit card figures"),
  field("cc_late_claimed", "Late charges claimed", "Credit card figures"),
  field("cc_late_allowed", "Late charges allowed", "Credit card figures"),
  field("cc_other_claimed", "Other card fees claimed", "Credit card figures"),
  field("cc_other_allowed", "Other card fees allowed", "Credit card figures"),
  field("cc_credits_claimed", "Card credits claimed", "Credit card figures"),
  field("cc_credits_allowed", "Card credits allowed", "Credit card figures"),
  field("award_amount", "Amount found due", "Arbitrator’s input", "text", "The arbitrator’s figure. Staff may type it. Saving records who entered it."),
  field("respondent_pan", "Customer PAN", "Defence"),
  field("respondent_address", "Customer address", "Defence"),
  field("sod_due_date", "Defence deadline", "Defence", "date"),
  field("final_opportunity_date", "Final opportunity date", "Defence", "date"),
  field("ex_parte_order_date", "Ex parte order date", "Defence", "date"),
  field("respondent_appearance", "Who appeared for the customer", "Defence"),
  field("respondent_appearance_mode", "How they appeared", "Defence"),
  field("sod_date", "Statement of defence date", "Defence", "date"),
  field("respondent_defence_summary", "Defence summary", "Defence", "textarea", "Completes a sentence. Leave blank if the matter is ex parte."),
  field("rejoinder_date", "Rejoinder date", "Defence", "date"),
  field("claimant_rejoinder_summary", "Rejoinder summary", "Defence", "textarea"),
  field("respondent_evidence_summary", "Evidence led", "Defence", "textarea"),
  field("final_arguments_date", "Final arguments date", "Defence", "date"),
  field("tribunal_reasons_on_defence", "Arbitrator’s reasons", "Arbitrator’s input", "textarea", "The arbitrator’s reasons. Staff may type them. Saving records who entered them."),
  field("arbitrator_approved_by", "Approved by arbitrator", "Arbitrator’s input", "text", "The arbitrator’s name. This is the approval record."),
  field("arbitrator_approved_on", "Arbitrator approved on", "Arbitrator’s input", "date"),
  field("arbitrator_entered_by", "Entered by", "Arbitrator’s input", "text", "Filled with the staff member who saved these figures."),
  field("disallowed_items_note", "Anything reduced or disallowed", "Defence", "textarea"),
  field("co_respondent_liability_note", "Note on a guarantor’s limit", "Defence", "textarea"),
  field("pendente_lite_rate", "Pendente lite interest % per year", "Before you generate", "text", "Required. Leave this empty until you type the rate the arbitrator has fixed. There is no default.", true),
  field("post_award_rate", "Future interest % per year", "Before you generate", "text", "Required. Leave this empty until you type the rate the arbitrator has fixed. There is no default.", true),
  field("interest_base_amount", "Principal for pendente lite interest", "Interest and costs"),
  field("pendente_lite_from_date", "Interest from", "Interest and costs", "date"),
  field("interest_reasons_note", "Extra reasons on interest", "Interest and costs", "textarea"),
  field("payment_days", "Days allowed to pay", "Interest and costs"),
  field("cost_arbitrator_fee", "Arbitrator’s fee", "Interest and costs"),
  field("cost_admin", "Administrative charges", "Interest and costs"),
  field("cost_other", "Notice and postage", "Interest and costs"),
  field("award_date", "Date of the award", "Signing", "date"),
  field("award_signing_place", "Place of signing", "Signing"),
  field("arbitrator_signature_mode", "How the arbitrator signs", "Signing"),
  field("stamp_act_name", "Stamp law", "Signing"),
  field("award_stamp_details", "Stamp or franking details", "Signing"),
  field("time_extension_ref", "Section 29A extension reference", "Signing"),
  field("time_extension_date", "Extension date", "Signing", "date"),
  field("default_date", "Date of first default", "Claim", "date"),
  field("npa_date", "NPA date", "Claim", "date"),
  field("demand_notice_type", "Demand or recall notice", "Claim"),
  field("demand_notice_date", "Date of that notice", "Claim", "date"),
  field("demand_notice_amount", "Amount in that notice", "Claim"),
  field("last_payment_date", "Last payment date", "Claim", "date"),
  field("soc_date", "Statement of claim date", "Claim", "date"),
  field("soc_filing_date", "Date the claim was filed", "Claim", "date"),
  field("pleadings_completion_date", "Date pleadings closed", "Claim", "date"),
  field("claimant_witness_name", "Bank witness", "Claim"),
  field("claimant_witness_designation", "Witness designation", "Claim"),
  field("claimant_affidavit_date", "Affidavit date", "Claim", "date"),
];

export const SETTLEMENT_FIELDS: PaperField[] = [
  field("lender_registered_office", "Bank registered office", "Lender"),
  field("lender_entity_description", "What the lender is", "Lender", "textarea"),
  field("lender_cin", "CIN, or N.A.", "Lender"),
  field("lender_short_name", "Short name for the header", "Lender"),
  field("lender_unit", "Unit or branch name", "Lender"),
  field("lender_unit_address", "Unit address", "Lender"),
  field("lender_signatory_name", "Authorised signatory", "Lender"),
  field("lender_signatory_designation", "Signatory designation", "Lender"),
  field("lender_authority_document", "Authority document", "Lender"),
  field("lender_authority_date", "Date of that authority", "Lender", "date"),
  field("borrower_age", "Borrower age", "Borrower"),
  field("borrower_pan", "Borrower PAN", "Borrower"),
  field("borrower_aadhaar_last4", "Aadhaar, last 4 digits only", "Borrower", "text", "Only the last 4 digits are stored."),
  field("borrower_address", "Borrower address", "Borrower"),
  field("facility_type_label", "Facility", "Facility", "text", "Personal Loan, Credit Card, or Secured Loan."),
  field("account_no", "Account or masked card number", "Facility"),
  field("agreement_title", "Agreement title", "Facility"),
  field("agreement_date", "Agreement date", "Facility", "date"),
  field("security_description", "Security, if any", "Facility", "textarea"),
  field("npa_date", "NPA date", "Facility", "date"),
  field("outstanding_as_on_date", "Outstanding as on", "Facility"),
  field("total_outstanding", "Total outstanding", "Facility"),
  field("principal_outstanding", "Principal", "Facility"),
  field("interest_charges_outstanding", "Interest and charges", "Facility"),
  field("lender_notice_date", "Demand notice date", "Facility", "date"),
  field("seat_city", "Seat, if an arbitration is pending", "Arbitration", "text", "Leave blank unless the agreement names a seat."),
  field("other_proceedings_details", "Other case to be withdrawn", "Arbitration", "textarea"),
  field("arbitration_costs_borne_by", "Who bears the tribunal fees", "Arbitration"),
  field("mediation_dates", "Mediation dates", "Settlement"),
  field("ots_sanction_ref", "OTS approval reference", "Settlement"),
  field("ots_sanction_date", "OTS approval date", "Settlement", "date"),
  field("settlement_amount", "Settlement amount", "Settlement"),
  field("payee_account_name", "Collection account name", "Payment"),
  field("payee_bank_name", "Bank", "Payment"),
  field("payee_branch", "Branch", "Payment"),
  field("payee_account_no", "Account number", "Payment"),
  field("payee_ifsc", "IFSC", "Payment"),
  field("payee_upi_id", "UPI, or N.A.", "Payment"),
  field("receipt_days", "Days to issue a receipt", "Timelines"),
  field("cure_period_days", "Cure period in days", "Timelines"),
  field("joint_filing_days", "Days to file before the tribunal", "Timelines"),
  field("withdrawal_days", "Days to withdraw proceedings", "Timelines"),
  field("ndc_days", "Days to issue the NDC", "Timelines"),
  field("bureau_update_days", "Days to update the bureau", "Timelines"),
  field("agent_withdrawal_days", "Days to stop agent contact", "Timelines"),
  field("security_release_days", "Days to release security", "Timelines"),
  field("document_return_branch", "Branch holding the documents", "Timelines"),
  field("lender_grievance_contact", "Grievance contact", "Timelines"),
  field("execution_place", "Place of execution", "Execution and stamp"),
  field("execution_date", "Execution date", "Execution and stamp", "date"),
  field("estamp_certificate_no", "e-Stamp certificate", "Execution and stamp"),
  field("estamp_date", "e-Stamp date", "Execution and stamp", "date"),
  field("stamp_duty_amount", "Stamp duty", "Execution and stamp"),
  field("stamp_act_name", "Stamp law", "Execution and stamp"),
  field("stamp_duty_borne_by", "Who bears the stamp duty", "Execution and stamp"),
  field("explanation_language", "Language used to explain the terms", "Execution and stamp"),
  field("obligor_legal_advice_note", "Independent advice", "Execution and stamp"),
  field("jurisdiction_city", "City of the courts", "Execution and stamp"),
  field("lender_sign_date", "Lender signing date", "Execution and stamp", "date"),
  field("borrower_sign_date", "Borrower signing date", "Execution and stamp", "date"),
  field("borrower_sign_mode", "Borrower signing mode", "Execution and stamp"),
  field("witness1_name", "Witness 1 name", "Witnesses"),
  field("witness1_address", "Witness 1 address", "Witnesses"),
  field("witness2_name", "Witness 2 name", "Witnesses"),
  field("witness2_address", "Witness 2 address", "Witnesses"),
  field("identity_verification_mode", "How identity was checked", "Witnesses"),
  field("mediator_authentication_date", "Mediator authentication date", "Witnesses", "date"),
  field("mediator_authentication_place", "Mediator authentication place", "Witnesses"),
];

export const AWARD_FLAGS: PaperFlag[] = [
  { key: "ex_parte", label: "Proceed ex parte", group: "Defence", hint: "Only after the arbitrator’s ex parte order and a final-opportunity notice are on the case. A no-show does not turn this on." },
  { key: "time_extended", label: "Section 29A time was extended", group: "Signing" },
];

export const SETTLEMENT_FLAGS: PaperFlag[] = [
  { key: "arbitration_pending", label: "An arbitration is already pending", group: "Arbitration" },
  { key: "award_on_agreed_terms", label: "Record this as a Section 30 award", group: "Arbitration", hint: "Use this when an arbitration case is settled on agreed terms." },
  { key: "secured_loan", label: "The facility is secured", group: "Facility" },
  { key: "has_guarantor", label: "A guarantor is to be discharged", group: "Facility" },
  { key: "other_proceedings", label: "Another case is to be withdrawn", group: "Arbitration" },
  {
    key: "mediation_act_applicable",
    label: "The Mediation Act, 2023 applies",
    group: "Arbitration",
    hint: "Leave this off unless you have confirmed that the Act applies and is in force.",
  },
];

export function fieldsFor(kind: PaperKind): PaperField[] {
  return kind === "award" ? AWARD_FIELDS : SETTLEMENT_FIELDS;
}

export function flagsFor(kind: PaperKind): PaperFlag[] {
  return kind === "award" ? AWARD_FLAGS : SETTLEMENT_FLAGS;
}

export function paperGroups(kind: PaperKind): string[] {
  const seen: string[] = [];
  for (const item of [...fieldsFor(kind), ...flagsFor(kind)]) {
    if (!seen.includes(item.group)) seen.push(item.group);
  }
  return seen.sort((a, b) => Number(b === "Before you generate") - Number(a === "Before you generate"));
}

export function agreedSettlementAmount(raw: string | null | undefined): string {
  const paper = parsePaper(raw);
  return paper.fields.settlement_amount?.trim() ?? "";
}
