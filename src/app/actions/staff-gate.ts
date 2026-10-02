// Checks the staff entry code and, when it matches, opens sign-in for two hours.

"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { tooManyAttempts } from "@/lib/rate-limit";
import {
  STAFF_GATE_ATTEMPT_COOKIE,
  STAFF_GATE_COOKIE,
  STAFF_GATE_LOCK_MS,
  STAFF_GATE_MAX_AGE_SECONDS,
  STAFF_GATE_MAX_ATTEMPTS,
  attemptIsLocked,
  codesMatch,
  createStaffGateToken,
  encodeAttemptState,
  entryCode,
  nextFailedAttempt,
  readAttemptState,
  staffGateCookieOptions,
} from "@/lib/staff-gate";

export type StaffGateState = { error: string } | null;

const WRONG = "That entry code is not correct.";
const LOCKED = "Too many incorrect codes. Wait 15 minutes and try again.";

let warned = false;

function warnIfUnset(): void {
  if (warned || entryCode()) return;
  warned = true;
  console.warn(
    "NOTICE_DESK_ENTRY_CODE is missing, shorter than 8 characters, or still the example placeholder in production. Staff access stays locked.",
  );
}

export async function unlockStaffAccess(
  _previous: StaffGateState,
  formData: FormData,
): Promise<StaffGateState> {
  warnIfUnset();
  const submitted = String(formData.get("code") ?? "");
  const code = submitted.trim().slice(0, 200);
  const cookieStore = await cookies();
  const now = Date.now();
  const headerList = await headers();
  const ip = (headerList.get("x-forwarded-for") ?? "local").split(",")[0]?.trim() || "local";
  const current = readAttemptState(cookieStore.get(STAFF_GATE_ATTEMPT_COOKIE)?.value);

  if (attemptIsLocked(current, now)) {
    return { error: LOCKED };
  }

  if (!codesMatch(code)) {
    const ipLocked = tooManyAttempts(`staff-gate-fail:${ip}`, STAFF_GATE_MAX_ATTEMPTS, STAFF_GATE_LOCK_MS);
    const next = nextFailedAttempt(current, now);
    cookieStore.set(
      STAFF_GATE_ATTEMPT_COOKIE,
      encodeAttemptState(next),
      staffGateCookieOptions(STAFF_GATE_LOCK_MS / 1000),
    );
    return { error: attemptIsLocked(next, now) || ipLocked ? LOCKED : WRONG };
  }

  const token = createStaffGateToken(now);
  if (!token) return { error: WRONG };

  cookieStore.set(STAFF_GATE_COOKIE, token, staffGateCookieOptions(STAFF_GATE_MAX_AGE_SECONDS));
  cookieStore.delete(STAFF_GATE_ATTEMPT_COOKIE);
  redirect("/login");
}
