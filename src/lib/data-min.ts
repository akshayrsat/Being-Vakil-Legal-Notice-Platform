// Keep only what a mapped upload needs. Full card numbers and Aadhaar numbers are not stored.

import { maskCardNumber } from "./odr-paper";

export const DEFAULT_SHEET_RETENTION_DAYS = 30;
export const EMPTY_SHEET = { headers: "[]", rawRows: "[]" };

const TOKEN = /(?<!\d)(?:\d[ -]?){11,18}\d(?!\d)/g;

export function isPhoneHeader(header: string): boolean {
  return /mobile|phone|whatsapp/i.test(header);
}

export function redactCell(value: string, options?: { phone?: boolean }): string {
  return value.replace(TOKEN, (match) => {
    const digits = match.replace(/\D/g, "");
    if (digits.length === 12) {
      if (options?.phone && digits.startsWith("91")) return match;
      return `XXXX-XXXX-${digits.slice(-4)}`;
    }
    if (digits.length >= 13 && digits.length <= 19) return maskCardNumber(digits);
    return match;
  });
}

export function redactSheet(headers: string[], rows: string[][]): { headers: string[]; rows: string[][] } {
  return {
    headers,
    rows: rows.map((row) =>
      row.map((cell, index) => redactCell(String(cell ?? ""), { phone: isPhoneHeader(headers[index] ?? "") })),
    ),
  };
}

export function keepMappedColumns(
  headers: string[],
  rows: string[][],
  mappingValues: string[],
): { headers: string[]; rows: string[][] } {
  const wanted = new Set(mappingValues.map((value) => value.trim()).filter(Boolean));
  const indexes = headers.flatMap((header, index) => (wanted.has(header) ? [index] : []));
  return {
    headers: indexes.map((index) => headers[index] ?? ""),
    rows: rows.map((row) => indexes.map((index) => row[index] ?? "")),
  };
}

export function sheetExpired(createdAt: Date, now: Date, retentionDays: number): boolean {
  if (!Number.isInteger(retentionDays) || retentionDays < 1) return false;
  return now.getTime() - createdAt.getTime() >= retentionDays * 24 * 60 * 60 * 1000;
}

export function closedCaseExpired(updatedAt: Date, now: Date, retentionDays: number): boolean {
  if (!Number.isInteger(retentionDays) || retentionDays < 1) return false;
  return now.getTime() - updatedAt.getTime() >= retentionDays * 24 * 60 * 60 * 1000;
}

export const CLOSED_CASE_BLANK = {
  customerName: "",
  coParties: "",
  accountNumber: "",
  branch: "",
  mobile: "",
  email: "",
  address: "",
  loanAmount: "",
  claimAmount: "",
  disputeSummary: "",
  advocateName: "",
  advocateBarNo: "",
  bankContact: "",
  paymentInfo: "",
  paperJson: "{}",
};
