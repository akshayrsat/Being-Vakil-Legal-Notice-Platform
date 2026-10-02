// Turns a spreadsheet into people, using the column match chosen for one bank.
// A saved match is reused when the next file has the same column names.

import {
  emptyMapping,
  normalizeHeader,
  SHEET_FIELDS,
  type FieldKey,
  type FieldMapping,
} from "./sheet-fields";

export type MappedRecipient = {
  rowNumber: number;
  customerName: string;
  mobile1: string;
  mobile2: string;
  mobile3: string;
  mobiles: string[];
  email: string;
  address: string;
  loanNumber: string;
  customerId: string;
  loanAmount: string;
  outstandingAmount: string;
  loanType: string;
  referenceNumber: string;
  collectionManager: string;
  collectionManagerMobile: string;
  bankWebsite: string;
  coBorrowerName: string;
  coBorrowerMobile: string;
  coBorrowerEmail: string;
  guarantorName: string;
  guarantorMobile: string;
  guarantorEmail: string;
};

export function suggestMapping(
  headers: string[],
  saved: Partial<FieldMapping> | null,
): FieldMapping {
  const mapping = emptyMapping();
  const byNormalName = new Map(headers.map((header) => [normalizeHeader(header), header]));

  for (const field of SHEET_FIELDS) {
    const savedValue = saved?.[field.key];
    if (typeof savedValue === "string") {
      const savedHeader = savedValue.trim();
      // A blank choice is deliberate. Keep it blank instead of guessing again.
      // If the saved heading is gone from this file, fall back to a guess.
      if (!savedHeader || headers.includes(savedHeader)) {
        mapping[field.key] = savedHeader;
        continue;
      }
    }
    const aliasHit = field.aliases
      .map((alias) => byNormalName.get(alias))
      .find((header): header is string => Boolean(header));
    if (aliasHit) mapping[field.key] = aliasHit;
  }

  return mapping;
}

export function mappingFromForm(formData: FormData): FieldMapping {
  const mapping = emptyMapping();
  for (const field of SHEET_FIELDS) {
    mapping[field.key] = String(formData.get(field.key) ?? "").trim().slice(0, 200);
  }
  return mapping;
}

export function parseStoredMapping(raw: string | null | undefined): Partial<FieldMapping> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Record<FieldKey, unknown>>;
    const mapping: Partial<FieldMapping> = {};
    for (const field of SHEET_FIELDS) {
      const value = parsed[field.key];
      if (typeof value === "string") mapping[field.key] = value;
    }
    return mapping;
  } catch {
    return null;
  }
}

export function validateMapping(mapping: FieldMapping, headers: string[]): string | null {
  if (!mapping.customerName) {
    return "Choose the column that contains the customer name.";
  }

  const used = new Map<string, string>();
  for (const field of SHEET_FIELDS) {
    const header = mapping[field.key];
    if (!header) continue;
    if (!headers.includes(header)) {
      return `${field.label} does not match a column in this file.`;
    }
    const other = used.get(header);
    if (other) {
      return `${field.label} and ${other} both use the column “${header}”. Pick each column once.`;
    }
    used.set(header, field.label);
  }

  return null;
}

export function mapSheetRows(
  headers: string[],
  rows: string[][],
  mapping: FieldMapping,
): { recipients: MappedRecipient[]; skipped: number } {
  const indexByHeader = new Map(headers.map((header, index) => [header, index]));
  const cell = (row: string[], header: string) => {
    if (!header) return "";
    const index = indexByHeader.get(header);
    if (index === undefined) return "";
    return row[index] ?? "";
  };

  let skipped = 0;
  const recipients: MappedRecipient[] = [];

  rows.forEach((row, index) => {
    const customerName = cell(row, mapping.customerName);
    if (!customerName) {
      skipped += 1;
      return;
    }

    const mobile1 = cell(row, mapping.mobile1);
    const mobile2 = cell(row, mapping.mobile2);
    const mobile3 = cell(row, mapping.mobile3);

    recipients.push({
      rowNumber: index + 2,
      customerName,
      mobile1,
      mobile2,
      mobile3,
      mobiles: collectMobiles([mobile1, mobile2, mobile3]),
      email: cell(row, mapping.email),
      address: cell(row, mapping.address),
      loanNumber: cell(row, mapping.loanNumber),
      customerId: cell(row, mapping.customerId),
      loanAmount: cell(row, mapping.loanAmount),
      outstandingAmount: cell(row, mapping.outstandingAmount),
      loanType: cell(row, mapping.loanType),
      referenceNumber: cell(row, mapping.referenceNumber),
      collectionManager: cell(row, mapping.collectionManager),
      collectionManagerMobile: cell(row, mapping.collectionManagerMobile),
      bankWebsite: cell(row, mapping.bankWebsite),
      coBorrowerName: cell(row, mapping.coBorrowerName),
      coBorrowerMobile: cell(row, mapping.coBorrowerMobile),
      coBorrowerEmail: cell(row, mapping.coBorrowerEmail),
      guarantorName: cell(row, mapping.guarantorName),
      guarantorMobile: cell(row, mapping.guarantorMobile),
      guarantorEmail: cell(row, mapping.guarantorEmail),
    });
  });

  return { recipients, skipped };
}

function collectMobiles(values: string[]): string[] {
  const seen = new Set<string>();
  const mobiles: string[] = [];

  for (const value of values) {
    for (const part of value.split(/[,/;|\n]+/)) {
      const mobile = part.trim();
      if (!mobile || seen.has(mobile)) continue;
      seen.add(mobile);
      mobiles.push(mobile);
    }
  }

  return mobiles;
}
