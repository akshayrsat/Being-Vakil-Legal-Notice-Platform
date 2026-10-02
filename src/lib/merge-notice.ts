// Fills a template body from one saved person. Empty fields stay visible as "not provided".

import { resolvePlaceholder } from "./notice-placeholders";

export type NoticePart =
  | { kind: "text"; text: string }
  | { kind: "missing"; label: string }
  | { kind: "unknown"; token: string };

export type FilledNotice = {
  parts: NoticePart[];
  missingLabels: string[];
  unknownTokens: string[];
};

const TOKEN_PATTERN = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

export function fillNotice(body: string, values: Record<string, string>): FilledNotice {
  const parts: NoticePart[] = [];
  const missingLabels: string[] = [];
  const unknownTokens: string[] = [];
  const seenMissing = new Set<string>();
  const seenUnknown = new Set<string>();

  let cursor = 0;
  for (const match of body.matchAll(TOKEN_PATTERN)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      parts.push({ kind: "text", text: body.slice(cursor, index) });
    }

    const raw = match[1]?.toLowerCase() ?? "";
    const placeholder = resolvePlaceholder(raw);
    if (!placeholder) {
      parts.push({ kind: "unknown", token: raw });
      if (!seenUnknown.has(raw)) {
        seenUnknown.add(raw);
        unknownTokens.push(raw);
      }
    } else {
      const value = values[placeholder.token]?.trim() ?? "";
      if (!value) {
        parts.push({ kind: "missing", label: placeholder.label });
        if (!seenMissing.has(placeholder.label)) {
          seenMissing.add(placeholder.label);
          missingLabels.push(placeholder.label);
        }
      } else {
        parts.push({ kind: "text", text: value });
      }
    }

    cursor = index + match[0].length;
  }

  if (cursor < body.length) {
    parts.push({ kind: "text", text: body.slice(cursor) });
  }

  return { parts, missingLabels, unknownTokens };
}

export type NoticeRecipient = {
  customerName: string;
  mobiles: string;
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

export function valuesForRecipient(row: NoticeRecipient, bankName: string): Record<string, string> {
  const mobiles = mobileList(row.mobiles);
  return {
    customer_name: row.customerName,
    mobile: mobiles[0] ?? "",
    mobile_2: mobiles[1] ?? "",
    mobile_3: mobiles[2] ?? "",
    mobiles: mobiles.join(", "),
    email: row.email,
    address: row.address,
    loan_number: row.loanNumber,
    customer_id: row.customerId,
    loan_amount: row.loanAmount,
    outstanding_amount: row.outstandingAmount,
    loan_type: row.loanType,
    reference_number: row.referenceNumber,
    collection_manager: row.collectionManager,
    collection_manager_mobile: row.collectionManagerMobile,
    bank_website: row.bankWebsite,
    co_borrower_name: row.coBorrowerName,
    co_borrower_mobile: row.coBorrowerMobile,
    co_borrower_email: row.coBorrowerEmail,
    guarantor_name: row.guarantorName,
    guarantor_mobile: row.guarantorMobile,
    guarantor_email: row.guarantorEmail,
    bank_name: bankName,
  };
}

export function noticePlainText(filled: FilledNotice): string {
  return filled.parts
    .map((part) => {
      if (part.kind === "text") return part.text;
      if (part.kind === "missing") return "[not provided]";
      return `{{${part.token}}}`;
    })
    .join("");
}

function mobileList(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}
