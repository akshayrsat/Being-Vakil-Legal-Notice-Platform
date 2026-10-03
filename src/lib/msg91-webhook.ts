// Turns an MSG91 delivery callback into a status on a live send.
// A dry-run row is never changed. If the webhook secret is missing, the route rejects the call.
// Email open events (eventName Opened / eventId 5) set status READ and openedAt.

import { timingSafeEqual } from "node:crypto";
import type { DeliveryStatus } from "@prisma/client";
import { prisma } from "./db";

const UPDATABLE: DeliveryStatus[] = ["QUEUED", "SENT", "DELIVERED", "FAILED"];

export type StatusHit = {
  requestId: string;
  mobile: string;
  email: string;
  channel: string;
  status: "DELIVERED" | "READ" | "FAILED";
  openedAt: Date | null;
};

export function webhookSecret(): string {
  return (process.env.MSG91_WEBHOOK_SECRET ?? "").trim();
}

export function isWebhookConfigured(): boolean {
  return webhookSecret().length >= 8;
}

export function secretMatches(provided: string, expected: string): boolean {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export const MAX_STATUS_HITS = 100;

export function collectStatusHits(body: unknown): StatusHit[] {
  const hits: StatusHit[] = [];
  walk(body, 0, hits);
  return hits.slice(0, MAX_STATUS_HITS);
}

export function storedReceipt(hit: StatusHit): { status: StatusHit["status"]; openedAt: Date | null } {
  // SMS cannot report an open. A read receipt is still proof the text was delivered.
  if (hit.channel === "SMS") {
    return { status: hit.status === "READ" ? "DELIVERED" : hit.status, openedAt: null };
  }
  if (hit.status === "READ") return { status: "READ", openedAt: hit.openedAt ?? new Date() };
  return { status: hit.status, openedAt: null };
}

export function parseWebhookPayload(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return JSON.parse(trimmed);
  const data = new URLSearchParams(trimmed).get("data");
  if (data) return JSON.parse(data);
  throw new SyntaxError("Send a JSON body.");
}

export async function applyStatusHits(hits: StatusHit[]): Promise<number> {
  let updated = 0;
  for (const hit of hits) {
    const row = await findLiveRow(hit);
    if (!row) continue;
    const stored = storedReceipt({ ...hit, channel: hit.channel || row.channel });
    const data: {
      status: StatusHit["status"];
      detail: string;
      openedAt?: Date;
    } = {
      status: stored.status,
      detail: detailFor(stored.status),
    };
    if (stored.openedAt) data.openedAt = stored.openedAt;
    const allowed: DeliveryStatus[] =
      row.channel === "SMS" && stored.status === "FAILED" ? [...UPDATABLE, "READ"] : [...UPDATABLE];
    const result = await prisma.campaignDelivery.updateMany({
      where: {
        id: row.id,
        status: { in: allowed },
        campaign: { mode: "LIVE" },
      },
      data,
    });
    updated += result.count;
  }
  return updated;
}

async function findLiveRow(hit: StatusHit) {
  const channel = hit.channel;
  if (hit.requestId) {
    const byProvider = await prisma.campaignDelivery.findFirst({
      where: {
        providerId: hit.requestId,
        status: { in: UPDATABLE },
        campaign: { mode: "LIVE" },
        ...(channel ? { channel } : {}),
      },
      orderBy: { campaign: { createdAt: "desc" } },
    });
    if (byProvider) return byProvider;
  }

  const mobile = lastTenDigits(hit.mobile);
  const email = hit.email.trim().toLowerCase();
  if (!mobile && !email) return null;

  if (email && (!channel || channel === "EMAIL")) {
    const byEmail = await prisma.campaignDelivery.findMany({
      where: {
        email: { contains: email },
        channel: "EMAIL",
        status: { in: UPDATABLE },
        campaign: { mode: "LIVE" },
      },
      orderBy: { campaign: { createdAt: "desc" } },
      take: 20,
    });
    const exact = byEmail.find((row) => row.email.trim().toLowerCase() === email);
    if (exact) return exact;
  }

  if (!mobile) return null;
  const mobileChannel = channel === "EMAIL" ? "" : channel;
  const byMobile = await prisma.campaignDelivery.findMany({
    where: {
      mobile: { contains: mobile },
      status: { in: UPDATABLE },
      campaign: { mode: "LIVE" },
      channel: mobileChannel ? mobileChannel : { in: ["SMS", "WHATSAPP"] },
    },
    orderBy: { campaign: { createdAt: "desc" } },
    take: 20,
  });
  return byMobile.find((row) => lastTenDigits(row.mobile) === mobile) ?? null;
}

function detailFor(status: StatusHit["status"]): string {
  if (status === "READ") return "Reported as opened or read.";
  if (status === "FAILED") return "Reported as failed.";
  return "Reported as delivered.";
}

function walk(node: unknown, depth: number, hits: StatusHit[], inherit?: Record<string, unknown>): void {
  if (depth > 6 || node == null) return;
  if (typeof node === "string") {
    const parsed = parseJsonString(node);
    if (parsed) walk(parsed, depth + 1, hits, inherit);
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) walk(item, depth + 1, hits, inherit);
    return;
  }
  if (typeof node !== "object") return;
  const record = inherit ? withParentIdentity(inherit, node as Record<string, unknown>) : (node as Record<string, unknown>);
  const hit = hitFromRecord(record);
  if (hit) hits.push(hit);
  for (const [key, value] of Object.entries(record)) {
    if (key === "numbers" && value && typeof value === "object" && !Array.isArray(value)) {
      for (const [mobile, detail] of Object.entries(value as Record<string, unknown>)) {
        if (!detail || typeof detail !== "object" || Array.isArray(detail)) continue;
        const merged: Record<string, unknown> = {
          ...record,
          ...(detail as Record<string, unknown>),
          mobile,
          number: mobile,
        };
        delete merged.numbers;
        const child = hitFromRecord(merged);
        if (child) hits.push(child);
      }
      continue;
    }
    if (value && typeof value === "object") walk(value, depth + 1, hits, record);
    else if (typeof value === "string") {
      const parsed = parseJsonString(value);
      if (parsed) walk(parsed, depth + 1, hits, record);
    }
  }
}

function withParentIdentity(parent: Record<string, unknown>, child: Record<string, unknown>): Record<string, unknown> {
  const merged = { ...child };
  for (const key of ["requestId", "request_id", "senderId", "DLT_TE_ID", "telNum"]) {
    if (!firstString(merged, [key]) && firstString(parent, [key])) merged[key] = parent[key];
  }
  return merged;
}

function parseJsonString(value: string): unknown | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

const SMS_FAILED_CODES = new Set(["2", "9", "16", "17", "20", "25"]);

function hitFromRecord(record: Record<string, unknown>): StatusHit | null {
  const labels = ["desc", "description", "event", "eventName", "upperCaseEventName"]
    .map((key) => firstString(record, [key]))
    .filter(Boolean);
  const eventLabel = labels[0] ?? "";
  const mobile = firstString(record, ["mobile", "telNum", "number", "customerNumber", "phone"]);
  const email = emailFromRecord(record);
  const channel = inferChannel(record, email, mobile);
  const smsLike = channel === "SMS" || (!email && channel !== "WHATSAPP" && channel !== "EMAIL");
  // Email Queued/Accepted/Sent must not fall through to numeric eventId 1 (SMS delivered).
  if (email && /^(queued|accepted|enqueued|sent)$/i.test(eventLabel.trim())) return null;
  const described = labels.map((label) => mapStatus(label)).find((status) => status != null) ?? null;
  const codedRaw = firstString(record, ["status", "eventId"]);
  // Email eventId 1/2 = Queued/Accepted. SMS status 1 = delivered. Prefer labels when present.
  let coded = mapStatus(codedRaw);
  if (email && (codedRaw === "1" || codedRaw === "2")) coded = null;
  // SMS 2/9/16/17/20/25 are failed, rejected, blocked, or NDNC. A failure code wins over "sent".
  if (smsLike && SMS_FAILED_CODES.has(codedRaw)) coded = "FAILED";
  if (smsLike && !described && !coded && (codedRaw === "0" || /^(sent|submitted)$/i.test(eventLabel.trim()))) {
    return null;
  }
  const status = (smsLike && SMS_FAILED_CODES.has(codedRaw) ? "FAILED" : null) ?? described ?? coded;
  if (!status) return null;
  const requestId = firstString(record, ["requestId", "request_id"]);
  if (!mobile && !email && !requestId) return null;
  const openedAt =
    status === "READ"
      ? parseDate(firstString(record, ["statusUpdatedAt", "ts", "deliveryTime", "requestedAt", "openedAt", "opened_at"]))
      : null;
  return { status, mobile, email, requestId, channel, openedAt };
}

function inferChannel(record: Record<string, unknown>, email: string, mobile: string): string {
  const explicit = normalizeChannel(firstString(record, ["channel"]));
  if (explicit) return explicit;
  if (firstString(record, ["customerNumber", "integratedNumber"])) return "WHATSAPP";
  if (firstString(record, ["telNum", "DLT_TE_ID", "senderId"]) && !email) return "SMS";
  if (firstString(record, ["number"]) && firstString(record, ["desc", "description"]) && !email) return "SMS";
  if (email && !mobile) return "EMAIL";
  if (email) return "EMAIL";
  return "";
}

function emailFromRecord(record: Record<string, unknown>): string {
  const direct = firstString(record, ["email", "recipient"]).toLowerCase();
  if (direct.includes("@")) return direct.replace(/\s+/g, "");
  const sendTo = firstString(record, ["sendTo"]);
  if (sendTo) {
    try {
      const parsed = JSON.parse(sendTo) as { email?: string } | Array<{ email?: string }>;
      if (Array.isArray(parsed)) {
        const first = parsed.find((item) => typeof item?.email === "string" && item.email.includes("@"));
        if (first?.email) return first.email.trim().toLowerCase().replace(/\s+/g, "");
      } else if (typeof parsed?.email === "string" && parsed.email.includes("@")) {
        return parsed.email.trim().toLowerCase().replace(/\s+/g, "");
      }
    } catch {
      const match = sendTo.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
      if (match) return match[0].toLowerCase();
    }
  }
  return direct.includes("@") ? direct.replace(/\s+/g, "") : "";
}

function mapStatus(raw: string): StatusHit["status"] | null {
  const value = raw.trim().toLowerCase();
  if (!value || value.length > 40) return null;
  // MSG91 email eventId: 1 Queued, 2 Accepted, 4 Delivered, 5 Opened, 9 Failed.
  // Prefer eventName when present. "1" is kept as DELIVERED for SMS-style callbacks.
  if (value === "2" || value === "queued" || value === "accepted" || value === "enqueued") {
    return null;
  }
  if (value === "1" || value === "4" || value === "delivered" || value === "delivery" || value === "delivrd") {
    return "DELIVERED";
  }
  if (value === "5" || value === "read" || value === "seen" || value === "opened" || value === "open") {
    return "READ";
  }
  if (
    value === "9" ||
    value === "failed" ||
    value === "fail" ||
    value === "undelivered" ||
    value === "rejected" ||
    value === "expired" ||
    value === "bounced" ||
    value === "bounce" ||
    value === "not delivered" ||
    value === "not_delivered"
  ) {
    return "FAILED";
  }
  if (value === "unread" || value.includes("not read") || value.includes("not open") || value.includes("not delivered")) {
    return null;
  }
  if (value.includes("undeliver") || value.includes("fail") || value.includes("reject") || value.includes("bounce")) {
    return "FAILED";
  }
  if (value.includes("open") || value.includes("read")) return "READ";
  if (value.includes("deliver")) return "DELIVERED";
  return null;
}

function normalizeChannel(raw: string): string {
  const value = raw.trim().toUpperCase();
  if (value === "SMS" || value === "EMAIL" || value === "WHATSAPP") return value;
  return "";
}

function firstString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim().slice(0, 200);
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function parseDate(raw: string): Date | null {
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function lastTenDigits(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}
