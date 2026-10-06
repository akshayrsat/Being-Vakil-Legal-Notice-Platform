// ODR lists and the one-row-per-person Excel. A missing bank id matches nothing.

import { requiredBankId } from "./bank-data";
import { formatIndiaDateTime, indiaDayRange } from "./india-day";
import { isOdrMatter, isOdrStatus, odrMatterLabel, odrStatusLabel } from "./odr-status";

export type OdrFilters = {
  q: string;
  file: string;
  matter: string;
  status: string;
  from: string;
  to: string;
  applied: boolean;
};

export function readOdrFilters(params: URLSearchParams): OdrFilters {
  const matter = (params.get("matter") ?? "").trim().toUpperCase();
  const status = (params.get("status") ?? "").trim().toUpperCase();
  const file = (params.get("file") ?? "").trim();
  return {
    q: (params.get("q") ?? "").trim().slice(0, 80),
    file: /^[a-z0-9]{10,32}$/i.test(file) ? file : "",
    matter: isOdrMatter(matter) ? matter : "",
    status: isOdrStatus(status) ? status : "",
    from: dateOnly(params.get("from")),
    to: dateOnly(params.get("to")),
    applied: params.get("applied") === "1",
  };
}

function dateOnly(value: string | null): string {
  const text = (value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

export function odrFiltersApplied(filters: OdrFilters): boolean {
  return filters.applied;
}

export function odrFiltersToSearch(filters: OdrFilters, bankId: string): string {
  const params = new URLSearchParams();
  params.set("view", "odr");
  params.set("bank", bankId);
  if (filters.applied) params.set("applied", "1");
  if (filters.q) params.set("q", filters.q);
  if (filters.file) params.set("file", filters.file);
  if (filters.matter) params.set("matter", filters.matter);
  if (filters.status) params.set("status", filters.status);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  return params.toString();
}

export function odrCaseWhere(bankId: string | null | undefined, filters?: OdrFilters): {
  bankId: string;
  batchId?: string;
  matterType?: string;
  status?: string;
  createdAt?: { gte?: Date; lte?: Date };
  OR?: Array<Record<string, { contains: string }>>;
} {
  const where: {
    bankId: string;
    batchId?: string;
    matterType?: string;
    status?: string;
    createdAt?: { gte?: Date; lte?: Date };
    OR?: Array<Record<string, { contains: string }>>;
  } = { bankId: requiredBankId(bankId) };
  if (!filters) return where;
  if (filters.file) where.batchId = filters.file;
  if (filters.matter) where.matterType = filters.matter;
  if (filters.status) where.status = filters.status;
  const createdAt = indiaDayRange(filters.from, filters.to);
  if (createdAt) where.createdAt = createdAt;
  if (filters.q) {
    where.OR = [
      { refNo: { contains: filters.q } },
      { customerName: { contains: filters.q } },
      { accountNumber: { contains: filters.q } },
    ];
  }
  return where;
}

export type OdrExportHearing = { number: number; attendance: string; scheduledAt: Date };
export type OdrExportMessage = { channel: string; kind: string; status: string; detail: string; createdAt: Date };

export type OdrExportSource = {
  bankId: string;
  bankName: string;
  refNo: string;
  customerName: string;
  accountNumber: string;
  matterType: string;
  neutralName: string;
  status: string;
  exParte: boolean;
  settlementAmount: string;
  settlementNote: string;
  agreedSettlement?: string;
  awardAt: Date | null;
  hearings: OdrExportHearing[];
  messages: OdrExportMessage[];
};

export type OdrExportRow = {
  ref: string;
  bank: string;
  customer: string;
  account: string;
  type: string;
  arbitrator: string;
  hearings: string;
  lastHearing: string;
  attended: string[];
  sms: string;
  email: string;
  whatsapp: string;
  status: string;
  settlement: string;
  agreedSettlement: string;
  awardDate: string;
};

const NOTICE_KINDS = new Set(["FIRST", "NEXT"]);

export function latestChannelStatus(messages: OdrExportMessage[], channel: string): string {
  const rows = messages
    .filter((row) => row.channel === channel && NOTICE_KINDS.has(row.kind))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const latest = rows[0];
  if (!latest) return "";
  if (latest.detail.trim()) return `${latest.status}: ${latest.detail.trim()}`;
  return latest.status;
}

export function attendedMark(attendance: string): string {
  if (attendance === "JOINED") return "Y";
  if (attendance === "NO_SHOW") return "N";
  return "";
}

export function buildOdrExportRows(rows: OdrExportSource[], bankId: string): { columns: string[]; rows: string[][] } {
  const own = rows.filter((row) => row.bankId === bankId);
  const maxHearing = own.reduce((max, row) => Math.max(max, ...row.hearings.map((hearing) => hearing.number), 0), 0);
  const hearingColumns = Array.from({ length: Math.min(maxHearing, 12) }, (_, index) => `Hearing ${index + 1} attended`);
  const columns = [
    "Ref",
    "Bank",
    "Customer",
    "Account",
    "Type",
    "Arbitrator",
    "Hearings count",
    "Last hearing date",
    ...hearingColumns,
    "SMS",
    "Email",
    "WhatsApp",
    "Current status",
    "Settlement offer",
    "Settlement amount",
    "Award date",
  ];
  const body = own.map((row) => {
    const ordered = [...row.hearings].sort((a, b) => a.number - b.number);
    const last = ordered[ordered.length - 1];
    const attended = hearingColumns.map((_, index) => {
      const hearing = ordered.find((item) => item.number === index + 1);
      return hearing ? attendedMark(hearing.attendance) : "";
    });
    const offer = [row.settlementAmount, row.settlementNote].filter(Boolean).join(" — ");
    const agreed = row.agreedSettlement?.trim() ?? "";
    return [
      row.refNo,
      row.bankName,
      row.customerName,
      row.accountNumber,
      odrMatterLabel(row.matterType),
      row.neutralName,
      String(ordered.length),
      last ? formatIndiaDateTime(last.scheduledAt) : "",
      ...attended,
      latestChannelStatus(row.messages, "SMS"),
      latestChannelStatus(row.messages, "EMAIL"),
      latestChannelStatus(row.messages, "WHATSAPP"),
      `${odrStatusLabel(row.status)}${row.exParte ? " (ex parte)" : ""}`,
      offer,
      agreed,
      row.awardAt ? formatIndiaDateTime(row.awardAt) : "",
    ];
  });
  return { columns, rows: body };
}

export function csvFromTable(columns: string[], rows: string[][]): string {
  const lines = [columns, ...rows].map((row) => row.map(csvCell).join(","));
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

function csvCell(value: string): string {
  let cell = value ?? "";
  if (/^[=+\-@\t\r]/.test(cell)) cell = `'${cell}`;
  if (/[",\r\n]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
  return cell;
}
