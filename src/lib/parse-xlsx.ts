// Reads the first sheet of an Excel file. Row 1 is the column names. Later rows are people.

import "server-only";
import ExcelJS from "exceljs";

const MAX_ROWS = 5000;
const MAX_COLUMNS = 40;

export class SheetReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SheetReadError";
  }
}

export async function parseXlsx(
  buffer: Buffer,
): Promise<{ headers: string[]; rows: string[][] }> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as Parameters<ExcelJS.Xlsx["load"]>[0]);
  } catch {
    throw new SheetReadError(
      "This file could not be read. Use an Excel .xlsx file, with the column names in the first row.",
    );
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new SheetReadError("The file has no sheet.");
  }

  const headerRow = sheet.getRow(1);
  const width = Math.max(sheet.columnCount, headerRow.cellCount);
  const rawHeaders: string[] = [];
  for (let column = 1; column <= width; column += 1) {
    rawHeaders.push(cellText(headerRow.getCell(column)));
  }
  while (rawHeaders.length > 0 && rawHeaders[rawHeaders.length - 1] === "") {
    rawHeaders.pop();
  }
  if (rawHeaders.length === 0) {
    throw new SheetReadError("The first row should be the column names.");
  }
  if (rawHeaders.length > MAX_COLUMNS) {
    throw new SheetReadError(
      `This sheet has more than ${MAX_COLUMNS} columns. Delete the extra columns and try again.`,
    );
  }

  const headers = uniqueHeaders(rawHeaders);
  const rows: string[][] = [];

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const values = headers.map((_, index) => cellText(row.getCell(index + 1)));
    if (values.every((value) => value === "")) continue;
    rows.push(values);
    if (rows.length > MAX_ROWS) {
      throw new SheetReadError(
        `This sheet has more than ${MAX_ROWS} data rows. Split the file and upload the first part.`,
      );
    }
  }

  if (rows.length === 0) {
    throw new SheetReadError("The sheet has column names but no data rows.");
  }

  return { headers, rows };
}

function uniqueHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((header, index) => {
    const base = header.trim() || `Column ${index + 1}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base} (${count})`;
  });
}

function cellText(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") {
    if (Number.isSafeInteger(value)) return String(value);
    return String(value);
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText
        .map((part) => part.text)
        .join("")
        .trim();
    }
    if ("text" in value && typeof value.text === "string") {
      return value.text.trim();
    }
    if ("result" in value && value.result != null) {
      return String(value.result).trim();
    }
  }
  const text = cell.text;
  return typeof text === "string" ? text.trim() : "";
}
