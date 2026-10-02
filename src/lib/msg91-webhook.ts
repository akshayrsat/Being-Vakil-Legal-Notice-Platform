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

export function collectStatusHits(body: unknown): StatusHit[] {
  const hits: StatusHit[] = [];
  walk(body, 0, hits);
  return hits;
}

export async function applyStatusHits(hits: StatusHit[]): Promise<number> {
  let updated = 0;
  for (const hit of hits) {
    const row = await findLiveRow(hit);
    if (!row) continue;
    const data: {
      status: StatusHit["status"];
      detail: string;
      openedAt?: Date;
    } = {
      status: hit.status,
      detail: detailFor(hit.status),
    };
    if (hit.status === "READ") {
      data.openedAt = hit.openedAt ?? new Date();
    }
    const result = await prisma.campaignDelivery.updateMany({
      where: {
        id: row.id,
        status: { in: UPDATABLE },
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
    const byEmail = await prisma.campaignDelivery.findFirst({
      where: {
        email: { contains: email },
        channel: "EMAIL",
        status: { in: UPDATABLE },
        campaign: { mode: "LIVE" },
      },
      orderBy: { campaign: { createdAt: "desc" } },
    });
    if (byEmail) return byEmail;
  }

  if (!mobile) return null;
  const mobileChannel = channel === "EMAIL" ? "" : channel;
  return prisma.campaignDelivery.findFirst({
    where: {
      mobile: { contains: mobile },
      status: { in: UPDATABLE },
      campaign: { mode: "LIVE" },
      channel: mobileChannel ? mobileChannel : { in: ["SMS", "WHATSAPP"] },
    },
    orderBy: { campaign: { createdAt: "desc" } },
  });
}

function detailFor(status: StatusHit["status"]): string {
  if (status === "READ") return "MSG91 reported this as opened/read.";
  if (status === "FAILED") return "MSG91 reported this as failed.";
  return "MSG91 reported this as delivered.";
}

function walk(node: unknown, depth: number, hits: StatusHit[]): void {
  if (depth > 6 || node == null) return;
  if (Array.isArray(node)) {
    for (const item of node) walk(item, depth + 1, hits);
    return;
  }
  if (typeof node !== "object") return;
  const record = node as Record<string, unknown>;
  const hit = hitFromRecord(record);
  if (hit) hits.push(hit);
  for (const value of Object.values(record)) {
    if (value && typeof value === "object") walk(value, depth + 1, hits);
  }
}

function hitFromRecord(record: Record<string, unknown>): StatusHit | null {
  const eventLabel = firstString(record, ["desc", "description", "event", "eventName"]);
  // Email Queued/Accepted must not fall through to numeric eventId 1 (SMS delivered).
  if (/^(queued|accepted|enqueued|sent)$/i.test(eventLabel.trim())) return null;
  const described = mapStatus(eventLabel);
  const mobile = firstString(record, ["mobile", "telNum", "number", "customerNumber", "phone"]);
  const email = emailFromRecord(record);
  const codedRaw = firstString(record, ["status", "eventId"]);
  // Email eventId 1/2 = Queued/Accepted. SMS status 1 = delivered. Prefer labels when present.
  let coded = mapStatus(codedRaw);
  if (email && (codedRaw === "1" || codedRaw === "2")) coded = null;
  const status = described ?? coded;
  if (!status) return null;
  const requestId = firstString(record, ["requestId", "request_id"]);
  const channel = inferChannel(record, email, mobile);
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
    value === "expired"
  ) {
    return "FAILED";
  }
  if (value.includes("undeliver") || value.includes("fail") || value.includes("reject")) return "FAILED";
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
