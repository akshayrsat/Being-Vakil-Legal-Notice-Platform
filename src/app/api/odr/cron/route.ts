// Cloud Scheduler can call this with header x-odr-cron-secret.
// It refreshes attendance, sends due reminders, and applies the auto-reschedule rule.

import { timingSafeEqual } from "node:crypto";
import { runOdrMaintenance } from "@/lib/odr-runner";

export const dynamic = "force-dynamic";

function secretOk(header: string | null): boolean {
  const expected = (process.env.ODR_CRON_SECRET ?? "").trim();
  const got = (header ?? "").trim();
  if (expected.length < 16 || got.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

export async function POST(request: Request) {
  if (!secretOk(request.headers.get("x-odr-cron-secret"))) {
    return new Response("Not found", { status: 404 });
  }
  const result = await runOdrMaintenance();
  return Response.json(result);
}

export async function GET() {
  return new Response("Not found", { status: 404 });
}
