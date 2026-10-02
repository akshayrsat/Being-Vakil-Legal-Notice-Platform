// Turns an MSG91 delivery callback into a status on a live send.
// A dry-run row is never changed. If the webhook secret is missing, the route rejects the call.

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
    const result = await prisma.campaignDelivery.updateMany({
      where: {
        id: row.id,
        status: { in: UPDATABLE },
        campaign: { mode: "LIVE" },
      },
      data: {
        status: hit.status,
        detail: detailFor(hit.status),
      },
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
  if (status === "READ") return "MSG91 reported this as read.";
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
  const described = mapStatus(firstString(record, ["desc", "description", "event", "eventName"]));
  const coded = mapStatus(firstString(record, ["status"]));
  const status = described ?? coded;
  if (!status) return null;
  const mobile = firstString(record, ["mobile", "telNum", "number", "customerNumber", "phone"]);
  const email = firstString(record, ["email"]);
  const requestId = firstString(record, ["requestId", "request_id"]);
  const channel = normalizeChannel(firstString(record, ["channel"]));
  if (!mobile && !email && !requestId) return null;
  return { status, mobile, email: email.toLowerCase(), requestId, channel };
}

function mapStatus(raw: string): StatusHit["status"] | null {
  const value = raw.trim().toLowerCase();
  if (!value || value.length > 40) return null;
  if (value === "1" || value === "delivered" || value === "delivery" || value === "delivrd") return "DELIVERED";
  if (value === "read" || value === "seen") return "READ";
  if (
    value === "2" ||
    value === "failed" ||
    value === "fail" ||
    value === "undelivered" ||
    value === "rejected" ||
    value === "expired"
  ) {
    return "FAILED";
  }
  if (value.includes("undeliver") || value.includes("fail") || value.includes("reject")) return "FAILED";
  if (value.includes("read")) return "READ";
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

function lastTenDigits(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}
