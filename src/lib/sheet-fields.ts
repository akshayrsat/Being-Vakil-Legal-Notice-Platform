// The boxes a notice can use, and the spreadsheet headings we recognise.
// A blank optional box is allowed. Customer name is the one that must be chosen.

export const FIELD_GROUPS = ["Customer", "Loan", "Co-borrower", "Guarantor"] as const;

export type FieldGroup = (typeof FIELD_GROUPS)[number];

export type FieldKey =
  | "customerName"
  | "mobile1"
  | "mobile2"
  | "mobile3"
  | "email"
  | "address"
  | "loanNumber"
  | "customerId"
  | "loanAmount"
  | "outstandingAmount"
  | "coBorrowerName"
  | "coBorrowerMobile"
  | "coBorrowerEmail"
  | "guarantorName"
  | "guarantorMobile"
  | "guarantorEmail";

export type SheetField = {
  key: FieldKey;
  label: string;
  group: FieldGroup;
  required: boolean;
  aliases: string[];
};

export const SHEET_FIELDS: SheetField[] = [
  {
    key: "customerName",
    label: "Customer name",
    group: "Customer",
    required: true,
    aliases: ["customer name", "borrower name", "name of customer", "customer", "borrower"],
  },
  {
    key: "mobile1",
    label: "Mobile",
    group: "Customer",
    required: false,
    aliases: ["mobile", "mobile 1", "mobile number", "phone", "phone number", "contact number"],
  },
  {
    key: "mobile2",
    label: "Second mobile",
    group: "Customer",
    required: false,
    aliases: ["mobile 2", "mobile2", "alternate mobile", "alt mobile", "phone 2", "second mobile"],
  },
  {
    key: "mobile3",
    label: "Third mobile",
    group: "Customer",
    required: false,
    aliases: ["mobile 3", "mobile3", "phone 3", "third mobile"],
  },
  {
    key: "email",
    label: "Email",
    group: "Customer",
    required: false,
    aliases: ["email", "email id", "e mail", "mail"],
  },
  {
    key: "address",
    label: "Address",
    group: "Customer",
    required: false,
    aliases: ["address", "postal address", "customer address", "residence address"],
  },
  {
    key: "loanNumber",
    label: "Loan number",
    group: "Loan",
    required: false,
    aliases: ["loan number", "loan no", "loan account", "loan account number", "account number"],
  },
  {
    key: "customerId",
    label: "Customer id",
    group: "Loan",
    required: false,
    aliases: ["customer id", "customer no", "cif", "customer code"],
  },
  {
    key: "loanAmount",
    label: "Loan amount",
    group: "Loan",
    required: false,
    aliases: ["loan amount", "sanction amount", "sanctioned amount"],
  },
  {
    key: "outstandingAmount",
    label: "Outstanding amount",
    group: "Loan",
    required: false,
    aliases: ["outstanding amount", "outstanding", "total due", "amount due", "overdue amount"],
  },
  {
    key: "coBorrowerName",
    label: "Co-borrower name",
    group: "Co-borrower",
    required: false,
    aliases: ["co borrower name", "coborrower name", "co applicant name", "co applicant"],
  },
  {
    key: "coBorrowerMobile",
    label: "Co-borrower mobile",
    group: "Co-borrower",
    required: false,
    aliases: ["co borrower mobile", "coborrower mobile", "co applicant mobile", "co borrower phone"],
  },
  {
    key: "coBorrowerEmail",
    label: "Co-borrower email",
    group: "Co-borrower",
    required: false,
    aliases: ["co borrower email", "coborrower email", "co applicant email"],
  },
  {
    key: "guarantorName",
    label: "Guarantor name",
    group: "Guarantor",
    required: false,
    aliases: ["guarantor name", "guarantor"],
  },
  {
    key: "guarantorMobile",
    label: "Guarantor mobile",
    group: "Guarantor",
    required: false,
    aliases: ["guarantor mobile", "guarantor phone"],
  },
  {
    key: "guarantorEmail",
    label: "Guarantor email",
    group: "Guarantor",
    required: false,
    aliases: ["guarantor email"],
  },
];

export type FieldMapping = Record<FieldKey, string>;

export function emptyMapping(): FieldMapping {
  return Object.fromEntries(SHEET_FIELDS.map((field) => [field.key, ""])) as FieldMapping;
}

export function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
