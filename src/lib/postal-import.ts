// CSV rows for Speed Post. Headers are matched loosely so a spreadsheet export can be imported.

import { normalizeArticleNumber, parsePostalInstant, parsePostalStatus, type PostalStatus } from "./postal";

export type PostalImportRow = {
  line: number;
  articleNumber: string;
  noticeNumber: string;
  loanNumber: string;
  customerId: string;
  customerName: string;
  status: PostalStatus | null;
  note: string;
  occurredAt: Date | null;
};

export type PostalImportIssue = { line: number; message: string };

const HEADER_ALIASES: Record<string, keyof Omit<PostalImportRow, "line" | "occurredAt"> | "occurredAt"> = {
  article_number: "articleNumber",
  articlenumber: "articleNumber",
  article: "articleNumber",
  consignment: "articleNumber",
  consignment_number: "articleNumber",
  barcode: "articleNumber",
  speed_post: "articleNumber",
  notice_number: "noticeNumber",
  noticenumber: "noticeNumber",
  notice: "noticeNumber",
  loan_number: "loanNumber",
  loannumber: "loanNumber",
  loan: "loanNumber",
  loan_id: "loanNumber",
  loanid: "loanNumber",
  account: "customerId",
  account_number: "customerId",
  accountnumber: "customerId",
  customer_id: "customerId",
  customerid: "customerId",
  customer_name: "customerName",
  customername: "customerName",
  name: "customerName",
  status: "status",
  note: "note",
  notes: "note",
  remark: "note",
  remarks: "note",
  occurred_at: "occurredAt",
  occurredat: "occurredAt",
  date: "occurredAt",
  event_date: "occurredAt",
};

export function parsePostalCsv(text: string): { rows: PostalImportRow[]; issues: PostalImportIssue[] } {
  const table = parseCsv(text.replace(/^\uFEFF/, ""));
  if (table.length === 0) {
    return { rows: [], issues: [{ line: 1, message: "The file is empty." }] };
  }
  const header = table[0].map((cell) => normalizeHeader(cell));
  const columns = header.map((cell) => HEADER_ALIASES[cell] ?? null);
  if (!columns.some((column) => column === "articleNumber" || column === "noticeNumber" || column === "loanNumber")) {
    return {
      rows: [],
      issues: [
        {
          line: 1,
          message: "The first row needs article_number, notice_number, or loan_number.",
        },
      ],
    };
  }

  const rows: PostalImportRow[] = [];
  const issues: PostalImportIssue[] = [];
  for (let index = 1; index < table.length; index += 1) {
    const cells = table[index];
    if (cells.every((cell) => !cell.trim())) continue;
    const line = index + 1;
    const draft: PostalImportRow = {
      line,
      articleNumber: "",
      noticeNumber: "",
      loanNumber: "",
      customerId: "",
      customerName: "",
      status: null,
      note: "",
      occurredAt: null,
    };
    columns.forEach((column, cellIndex) => {
      if (!column) return;
      const value = (cells[cellIndex] ?? "").trim();
      if (column === "articleNumber") draft.articleNumber = normalizeArticleNumber(value);
      else if (column === "noticeNumber") draft.noticeNumber = value.toUpperCase();
      else if (column === "loanNumber") draft.loanNumber = value;
      else if (column === "customerId") draft.customerId = value;
      else if (column === "customerName") draft.customerName = value;
      else if (column === "note") draft.note = value.slice(0, 300);
      else if (column === "status") draft.status = value ? parsePostalStatus(value) : null;
      else if (column === "occurredAt") draft.occurredAt = value ? parsePostalInstant(value) : null;
    });
    if (draft.status === null && cells.some((cell, cellIndex) => columns[cellIndex] === "status" && cell.trim())) {
      issues.push({ line, message: "Status must be booked, in transit, out for delivery, delivered, or returned." });
      continue;
    }
    if (draft.occurredAt === null && cells.some((cell, cellIndex) => columns[cellIndex] === "occurredAt" && cell.trim())) {
      issues.push({ line, message: "The date could not be read. Use 2026-10-01." });
      continue;
    }
    if (!draft.articleNumber && !draft.noticeNumber && !draft.loanNumber && !draft.customerId) {
      issues.push({ line, message: "Add an article number, notice number, or loan number." });
      continue;
    }
    rows.push(draft);
  }
  if (rows.length > 2000) {
    return { rows: [], issues: [{ line: 1, message: "Import at most 2000 rows at a time." }] };
  }
  return { rows, issues };
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    if (char !== "\r") cell += char;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
