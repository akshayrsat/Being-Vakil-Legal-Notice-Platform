// MSG91 calls this address when a live message is delivered, opened/read, or fails.
// The call is refused unless MSG91_WEBHOOK_SECRET is set. A dry run is never updated.

import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit";
import { logDesk } from "@/lib/desk-log";
import { tooManyAttempts } from "@/lib/rate-limit";
import {
  applyStatusHits,
  collectStatusHits,
  isWebhookConfigured,
  secretMatches,
  webhookSecret,
} from "@/lib/msg91-webhook";

export const dynamic = "force-dynamic";

const MAX_BODY = 100_000;

export async function POST(request: Request) {
  const ip = (request.headers.get("x-forwarded-for") ?? "unknown").split(",")[0]?.trim() || "unknown";
  if (tooManyAttempts(`webhook:${ip}`, 240, 60 * 1000)) {
    return NextResponse.json({ ok: false, error: "Too many updates. Try again shortly." }, { status: 429 });
  }

  if (!isWebhookConfigured()) {
    return NextResponse.json({ ok: false, error: "Webhook secret is not set." }, { status: 401 });
  }

  const provided = secretFrom(request);
  if (!secretMatches(provided, webhookSecret())) {
    return NextResponse.json({ ok: false, error: "That webhook secret is not correct." }, { status: 401 });
  }

  const text = await request.text();
  if (text.length > MAX_BODY) {
    return NextResponse.json({ ok: false, error: "That update is too large." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    return NextResponse.json({ ok: false, error: "Send a JSON body." }, { status: 400 });
  }

  let updated = 0;
  try {
    const hits = collectStatusHits(body);
    updated = hits.length === 0 ? 0 : await applyStatusHits(hits);
  } catch (error) {
    logDesk("webhook.error", { message: error instanceof Error ? error.message.slice(0, 160) : "failed" });
    return NextResponse.json({ ok: false, error: "Could not save that update." }, { status: 500 });
  }

  if (updated > 0) {
    try {
      await recordAudit({
        actorId: null,
        actorName: "MSG91",
        actorRole: "webhook",
        action: "status.webhook",
        summary: `MSG91 updated ${updated} ${updated === 1 ? "delivery status" : "delivery statuses"}.`,
      });
    } catch (error) {
      logDesk("webhook.audit", { message: error instanceof Error ? error.message.slice(0, 160) : "failed" });
    }
  }

  return NextResponse.json({ ok: true, updated });
}

export function GET() {
  return NextResponse.json({ ok: false, error: "Send a POST request." }, { status: 405 });
}

function secretFrom(request: Request): string {
  const header = request.headers.get("x-notice-desk-secret") ?? "";
  if (header.trim()) return header.trim();
  const authorization = request.headers.get("authorization") ?? "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i);
  if (bearer?.[1]) return bearer[1].trim();
  return new URL(request.url).searchParams.get("secret")?.trim() ?? "";
}
