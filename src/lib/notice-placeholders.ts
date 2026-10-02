// The words a notice template can fill from a saved spreadsheet row.
// Write them in the template as {{customer_name}}. A blank value is allowed.
// notice_number and notice_link are filled when a send is prepared. They are not spreadsheet columns.

export type PlaceholderGroup = "Customer" | "Loan" | "Co-borrower" | "Guarantor" | "Bank" | "Notice";

export type NoticePlaceholder = {
  token: string;
  label: string;
  group: PlaceholderGroup;
};

export const PLACEHOLDER_GROUPS: PlaceholderGroup[] = [
  "Customer",
  "Loan",
  "Co-borrower",
  "Guarantor",
  "Bank",
  "Notice",
];

export const NOTICE_PLACEHOLDERS: NoticePlaceholder[] = [
  { token: "customer_name", label: "Customer name", group: "Customer" },
  { token: "mobile", label: "Mobile", group: "Customer" },
  { token: "mobile_2", label: "Second mobile", group: "Customer" },
  { token: "mobile_3", label: "Third mobile", group: "Customer" },
  { token: "mobiles", label: "All mobiles", group: "Customer" },
  { token: "email", label: "Email", group: "Customer" },
  { token: "address", label: "Address", group: "Customer" },
  { token: "loan_number", label: "Loan number", group: "Loan" },
  { token: "customer_id", label: "Customer id", group: "Loan" },
  { token: "loan_amount", label: "Loan amount", group: "Loan" },
  { token: "outstanding_amount", label: "Outstanding amount", group: "Loan" },
  { token: "co_borrower_name", label: "Co-borrower name", group: "Co-borrower" },
  { token: "co_borrower_mobile", label: "Co-borrower mobile", group: "Co-borrower" },
  { token: "co_borrower_email", label: "Co-borrower email", group: "Co-borrower" },
  { token: "guarantor_name", label: "Guarantor name", group: "Guarantor" },
  { token: "guarantor_mobile", label: "Guarantor mobile", group: "Guarantor" },
  { token: "guarantor_email", label: "Guarantor email", group: "Guarantor" },
  { token: "bank_name", label: "Bank name", group: "Bank" },
  { token: "notice_number", label: "Notice number", group: "Notice" },
  { token: "notice_link", label: "Notice link", group: "Notice" },
];

const byToken = new Map(NOTICE_PLACEHOLDERS.map((item) => [item.token, item]));

// {{mobile_1}} is the same as {{mobile}}. It is not shown as its own button.
const TOKEN_ALIASES: Record<string, string> = {
  mobile_1: "mobile",
};

export function placeholderToken(token: string): string {
  return `{{${token}}}`;
}

export function resolvePlaceholder(raw: string): NoticePlaceholder | null {
  const token = TOKEN_ALIASES[raw] ?? raw;
  return byToken.get(token) ?? null;
}
