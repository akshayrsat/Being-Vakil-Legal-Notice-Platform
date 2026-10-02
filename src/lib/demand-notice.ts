// The SPEED POST demand notice, filled from one recipient record.
// Every bank name in the letter is the record's bank. "Axis Bank" is not used.

import { FIRM_NAME, FIRM_PHONE } from "./letterhead";

export type DemandNoticeInput = {
  customerName: string;
  address: string;
  outstandingAmount: string;
  loanNumber: string;
  bankName: string;
  loanType: string;
  referenceNumber: string;
  collectionManager: string;
  collectionManagerMobile: string;
  bankWebsite: string;
  noticeNumber: string;
  dated: Date;
};

const NOT_ON_FILE = "not on file";

export function formatDemandAmount(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return NOT_ON_FILE;
  const numeric = Number(trimmed.replace(/,/g, ""));
  if (!Number.isFinite(numeric)) return trimmed;
  const formatted = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(numeric);
  return `Rs. ${formatted}/-`;
}

export function noticeDateLabel(date: Date): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "Date not on file";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function shown(value: string, fallback = NOT_ON_FILE): string {
  const trimmed = value.trim();
  return trimmed || fallback;
}

export type DemandNoticeView = {
  kicker: string;
  title: string;
  dateLine: string;
  referenceLine: string;
  addresseeName: string;
  addresseeAddress: string;
  salutation: string;
  subject: string;
  opening: string[];
  status: Array<{ label: string; value: string }>;
  closing: string[];
};

export function buildDemandNotice(input: DemandNoticeInput): DemandNoticeView {
  const bank = shown(input.bankName, "the bank");
  const loan = shown(input.loanType, "loan");
  const facility = shown(input.loanNumber);
  const amount = formatDemandAmount(input.outstandingAmount);
  const name = shown(input.customerName);
  const reference = shown(input.referenceNumber, input.noticeNumber.trim() || NOT_ON_FILE);
  const website = input.bankWebsite.trim();
  const manager = input.collectionManager.trim();
  const managerMobile = input.collectionManagerMobile.trim() || FIRM_PHONE;

  const clarify = website
    ? `In the event you require any further clarification, you may contact the ${bank} loan centre or may visit the ${bank} Portal ${website}.`
    : `In the event you require any further clarification, you may contact the ${bank} loan centre.`;
  const smsConfirm = website
    ? `Kindly note, confirmation via SMS for payment may take 48 business hours. If there is no message confirmation received against the payment, please visit ${website} or the nearest loan center.`
    : `Kindly note, confirmation via SMS for payment may take 48 business hours. If there is no message confirmation received against the payment, please visit the nearest loan center.`;
  const assistance = manager
    ? `For any assistance you may contact our Collection Manager ${manager} at ${managerMobile}.`
    : `For any assistance you may contact ${FIRM_NAME} at ${managerMobile}.`;

  return {
    kicker: "SPEED POST/REGD. POST/EMAIL",
    title: "LEGAL NOTICE",
    dateLine: `Date : ${noticeDateLabel(input.dated)}`,
    referenceLine: `Reference No. ${reference}`,
    addresseeName: name,
    addresseeAddress: input.address.trim() || "Address not on file",
    salutation: "Dear Sir/Madam,",
    subject: `SUB: Demand Notice in respect of overdue amount of ${amount} against the ${loan} facility no. ${facility}.`,
    opening: [
      `Under instructions from our client ${bank}, this notice is being issued as under–`,
      `This is with reference to your ${loan} facility no ${facility} with ${bank}.`,
      `As per the terms and conditions, envisaged in the Loan Agreement signed by you with the ${bank}, you are required to make regular and timely payments of the monthly installments towards repayment of the said ${loan}. You are aware that payments not made within the stipulated due date incur additional interest liability on you. The status of your ${loan} facility as on date is as follows-`,
    ],
    status: [
      { label: "Name", value: name },
      { label: "Loan Type", value: loan },
      { label: "Total Overdue", value: amount },
    ],
    closing: [
      `You are requested to remit the overdue & other charges if any, as applicable immediately to ${bank}.`,
      `We would also like to bring to your notice that if you continue to remain in default and do not comply with this notice, ${bank} has the liberty to share your default details with various Credit Information Bureau including CIBIL (Credit Information Bureau India Limited) subject to applicable law.`,
      "Please note that all the Bank & Non-Banking Financial Companies provide credit facilities after verification of the credit history of the customer from CIBIL. A default history against your name might jeopardize your Credit Rating/Loan eligibility across the Industry for the purpose of obtaining future credit.",
      `Kindly note that this letter is issued without prejudice to any of the terms and conditions as per the Agreement/MITC agreed between you and ${bank}.`,
      clarify,
      "If the overdue payment is already made by/before receipt of this notice, please ignore the same.",
      smsConfirm,
      assistance,
    ],
  };
}

export function demandNoticePlainText(input: DemandNoticeInput): string {
  const notice = buildDemandNotice(input);
  return [
    notice.kicker,
    notice.title,
    notice.dateLine,
    notice.referenceLine,
    "",
    "To,",
    notice.addresseeName,
    notice.addresseeAddress,
    "",
    notice.salutation,
    "",
    notice.subject,
    "",
    ...notice.opening.flatMap((paragraph) => [paragraph, ""]),
    ...notice.status.map((row) => `${row.label} : ${row.value}`),
    "",
    ...notice.closing.flatMap((paragraph) => [paragraph, ""]),
  ]
    .join("\n")
    .trim();
}
