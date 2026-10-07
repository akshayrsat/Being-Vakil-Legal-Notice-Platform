// Spreadsheet columns for an ODR upload. Customer name and the account number are required.

import { emailProblem, mobileProblem } from "./contact";
import { redactCell, isPhoneHeader } from "./data-min";
import { normalizeRefNo } from "./odr-ref";
import { normalizeHeader } from "./sheet-fields";

export const ODR_FIELD_GROUPS = ["Case", "Customer", "Amounts"] as const;

export type OdrFieldKey =
  | "refNo"
  | "customerName"
  | "coParties"
  | "co1Name"
  | "co1Role"
  | "co1Mobile"
  | "co1Email"
  | "co1Address"
  | "co2Name"
  | "co2Role"
  | "co2Mobile"
  | "co2Email"
  | "co2Address"
  | "accountNumber"
  | "branch"
  | "mobile"
  | "email"
  | "address"
  | "loanAmount"
  | "claimAmount"
  | "asOnDate"
  | "disputeSummary";

export type OdrSheetField = {
  key: OdrFieldKey;
  label: string;
  group: (typeof ODR_FIELD_GROUPS)[number];
  required: boolean;
  aliases: string[];
};

function partyField(key: OdrFieldKey, label: string, aliases: string[]): OdrSheetField {
  return { key, label, group: "Customer", required: false, aliases };
}

export const ODR_SHEET_FIELDS: OdrSheetField[] = [
  {
    key: "refNo",
    label: "Arbitration Ref No",
    group: "Case",
    required: false,
    aliases: ["arbitration ref no", "arbitration ref", "ref no", "reference no", "reference number", "odr ref"],
  },
  {
    key: "customerName",
    label: "Customer name",
    group: "Customer",
    required: true,
    aliases: ["customer name", "borrower name", "name of customer", "customer", "borrower"],
  },
  {
    key: "coParties",
    label: "Co-borrowers/guarantors",
    group: "Customer",
    required: false,
    aliases: [
      "co borrowers guarantors",
      "co-borrowers/guarantors",
      "co borrowers",
      "guarantors",
    ],
  },
  partyField("co1Name", "Co-party 1 name", ["co party 1 name", "co borrower 1 name", "co-borrower name", "co borrower name"]),
  partyField("co1Role", "Co-party 1 role", ["co party 1 role", "co borrower role", "capacity"]),
  partyField("co1Mobile", "Co-party 1 mobile", ["co party 1 mobile", "co borrower mobile", "co-borrower mobile"]),
  partyField("co1Email", "Co-party 1 email", ["co party 1 email", "co borrower email", "co-borrower email"]),
  partyField("co1Address", "Co-party 1 address", ["co party 1 address", "co borrower address", "co-borrower address"]),
  partyField("co2Name", "Co-party 2 name", ["co party 2 name", "guarantor name", "guarantor 1 name"]),
  partyField("co2Role", "Co-party 2 role", ["co party 2 role", "guarantor role"]),
  partyField("co2Mobile", "Co-party 2 mobile", ["co party 2 mobile", "guarantor mobile"]),
  partyField("co2Email", "Co-party 2 email", ["co party 2 email", "guarantor email"]),
  partyField("co2Address", "Co-party 2 address", ["co party 2 address", "guarantor address"]),
  {
    key: "accountNumber",
    label: "Loan/card account no",
    group: "Case",
    required: true,
    aliases: [
      "loan card account no",
      "loan/card account no",
      "account no",
      "account number",
      "loan number",
      "loan account",
      "loan account number",
      "card number",
    ],
  },
  {
    key: "branch",
    label: "Branch",
    group: "Case",
    required: false,
    aliases: ["branch", "branch name", "home branch"],
  },
  {
    key: "mobile",
    label: "Mobile",
    group: "Customer",
    required: false,
    aliases: ["mobile", "mobile number", "phone", "phone number", "contact number"],
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
    key: "loanAmount",
    label: "Loan amount",
    group: "Amounts",
    required: false,
    aliases: ["loan amount", "sanction amount", "sanctioned amount", "card limit"],
  },
  {
    key: "claimAmount",
    label: "Outstanding/claim amount",
    group: "Amounts",
    required: false,
    aliases: [
      "outstanding claim amount",
      "outstanding/claim amount",
      "claim amount",
      "outstanding amount",
      "outstanding",
      "amount due",
    ],
  },
  {
    key: "asOnDate",
    label: "As-on date",
    group: "Amounts",
    required: false,
    aliases: ["as on date", "as-on date", "as on", "outstanding as on"],
  },
  {
    key: "disputeSummary",
    label: "Short dispute summary",
    group: "Case",
    required: false,
    aliases: ["short dispute summary", "dispute summary", "summary", "dispute"],
  },
];

export const ODR_SAMPLE_HEADERS = [
  "Arbitration Ref No",
  "Customer name",
  "Co-borrowers/guarantors",
  "Loan/card account no",
  "Branch",
  "Mobile",
  "Email",
  "Address",
  "Loan amount",
  "Outstanding/claim amount",
  "As-on date",
  "Short dispute summary",
] as const;

export type OdrFieldMapping = Record<OdrFieldKey, string>;

export function emptyOdrMapping(): OdrFieldMapping {
  return Object.fromEntries(ODR_SHEET_FIELDS.map((field) => [field.key, ""])) as OdrFieldMapping;
}

export function suggestOdrMapping(headers: string[], saved: Partial<OdrFieldMapping> | null): OdrFieldMapping {
  const mapping = emptyOdrMapping();
  const byNormalName = new Map(headers.map((header) => [normalizeHeader(header), header]));
  for (const field of ODR_SHEET_FIELDS) {
    const savedValue = saved?.[field.key];
    if (typeof savedValue === "string") {
      const savedHeader = savedValue.trim();
      if (!savedHeader || headers.includes(savedHeader)) {
        mapping[field.key] = savedHeader;
        continue;
      }
    }
    const aliasHit = field.aliases
      .map((alias) => byNormalName.get(normalizeHeader(alias)))
      .find((header): header is string => Boolean(header));
    if (aliasHit) mapping[field.key] = aliasHit;
  }
  return mapping;
}

export function odrMappingFromForm(formData: FormData): OdrFieldMapping {
  const mapping = emptyOdrMapping();
  for (const field of ODR_SHEET_FIELDS) {
    mapping[field.key] = String(formData.get(field.key) ?? "").trim().slice(0, 200);
  }
  return mapping;
}

export function parseOdrMapping(raw: string | null | undefined): Partial<OdrFieldMapping> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Record<OdrFieldKey, unknown>>;
    const mapping: Partial<OdrFieldMapping> = {};
    for (const field of ODR_SHEET_FIELDS) {
      const value = parsed[field.key];
      if (typeof value === "string") mapping[field.key] = value;
    }
    return mapping;
  } catch {
    return null;
  }
}

export function validateOdrMapping(mapping: OdrFieldMapping, headers: string[]): string {
  const known = new Set(headers);
  for (const field of ODR_SHEET_FIELDS) {
    const chosen = mapping[field.key];
    if (field.required && !chosen) return `Choose a column for ${field.label}.`;
    if (chosen && !known.has(chosen)) return `${field.label} points at a column that is not in this file.`;
  }
  return "";
}

export type OdrMappedRow = {
  rowNumber: number;
  refNo: string;
  customerName: string;
  coParties: string;
  co1Name: string;
  co1Role: string;
  co1Mobile: string;
  co1Email: string;
  co1Address: string;
  co2Name: string;
  co2Role: string;
  co2Mobile: string;
  co2Email: string;
  co2Address: string;
  accountNumber: string;
  branch: string;
  mobile: string;
  email: string;
  address: string;
  loanAmount: string;
  claimAmount: string;
  asOnDate: string;
  disputeSummary: string;
  problems: string[];
};

function cell(headers: string[], row: string[], header: string, phone = false): string {
  const index = headers.indexOf(header);
  if (index < 0) return "";
  return redactCell((row[index] ?? "").trim().slice(0, 2000), { phone: phone || isPhoneHeader(header) });
}

export function mapOdrRows(headers: string[], rows: string[][], mapping: OdrFieldMapping): OdrMappedRow[] {
  return rows.map((row, index) => {
    const read = (key: OdrFieldKey) => cell(headers, row, mapping[key], key.toLowerCase().includes("mobile"));
    const mapped: OdrMappedRow = {
      rowNumber: index + 2,
      refNo: read("refNo"),
      customerName: read("customerName"),
      coParties: read("coParties"),
      co1Name: read("co1Name"),
      co1Role: read("co1Role"),
      co1Mobile: read("co1Mobile"),
      co1Email: read("co1Email"),
      co1Address: read("co1Address"),
      co2Name: read("co2Name"),
      co2Role: read("co2Role"),
      co2Mobile: read("co2Mobile"),
      co2Email: read("co2Email"),
      co2Address: read("co2Address"),
      accountNumber: read("accountNumber"),
      branch: read("branch"),
      mobile: read("mobile"),
      email: read("email"),
      address: read("address"),
      loanAmount: read("loanAmount"),
      claimAmount: read("claimAmount"),
      asOnDate: read("asOnDate"),
      disputeSummary: read("disputeSummary"),
      problems: [],
    };
    if (!mapped.customerName) mapped.problems.push("Customer name is empty.");
    const digits = mapped.accountNumber.replace(/\D/g, "");
    if (digits.length < 4) mapped.problems.push("Account number needs at least 4 digits.");
    for (const problem of [
      mobileProblem(mapped.mobile),
      emailProblem(mapped.email),
      mobileProblem(mapped.co1Mobile),
      emailProblem(mapped.co1Email),
      mobileProblem(mapped.co2Mobile),
      emailProblem(mapped.co2Email),
    ]) {
      if (problem) mapped.problems.push(problem);
    }
    return mapped;
  });
}

export function accountKey(value: string): string {
  return value.trim().toLowerCase();
}

export function flagOdrDuplicates(
  rows: OdrMappedRow[],
  existing: { openAccounts: string[]; refs: string[] },
): OdrMappedRow[] {
  const openAccounts = new Set(existing.openAccounts.map(accountKey).filter(Boolean));
  const refs = new Set(existing.refs.map((ref) => normalizeRefNo(ref)).filter(Boolean));
  const seenAccounts = new Set<string>();
  const seenRefs = new Set<string>();
  return rows.map((row) => {
    const problems = [...row.problems];
    const account = accountKey(row.accountNumber);
    if (account && openAccounts.has(account)) problems.push("This account already has an open case for this bank.");
    if (account && seenAccounts.has(account)) problems.push("This account number is already in this file.");
    if (account) seenAccounts.add(account);
    const ref = normalizeRefNo(row.refNo);
    if (ref && (refs.has(ref) || seenRefs.has(ref))) {
      problems.push("This reference is already used. It was not replaced.");
    }
    if (ref) seenRefs.add(ref);
    return { ...row, problems };
  });
}
