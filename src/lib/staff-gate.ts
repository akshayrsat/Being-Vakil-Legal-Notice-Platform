// The public site stays on the customer page until someone enters NOTICE_DESK_ENTRY_CODE.
// The browser then keeps a short-lived httpOnly cookie. The code itself is never stored in the repo.

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const STAFF_GATE_COOKIE = "noticedesk_staff_gate";
export const STAFF_GATE_ATTEMPT_COOKIE = "noticedesk_gate_attempts";
export const STAFF_GATE_MAX_AGE_SECONDS = 2 * 60 * 60;
export const STAFF_GATE_MAX_ATTEMPTS = 8;
export const STAFF_GATE_LOCK_MS = 15 * 60 * 1000;

const MIN_CODE_LENGTH = 8;
const EXAMPLE_PLACEHOLDER = "replace-with-a-long-random-code";
const UNSET_HASH_MATERIAL = "noticedesk-unset-entry-code";

export type GateAttemptState = {
  fails: number;
  lockedUntil: number;
};

export function entryCode(): string | null {
  const code = process.env.NOTICE_DESK_ENTRY_CODE?.trim() ?? "";
  if (code.length < MIN_CODE_LENGTH) return null;
  if (process.env.NODE_ENV === "production" && code === EXAMPLE_PLACEHOLDER) return null;
  return code;
}

export function codesMatch(input: string): boolean {
  const expected = entryCode();
  const left = createHash("sha256").update(input, "utf8").digest();
  const right = createHash("sha256").update(expected ?? UNSET_HASH_MATERIAL, "utf8").digest();
  return Boolean(expected) && timingSafeEqual(left, right);
}

export function staffGateCookieOptions(maxAge: number) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export function createStaffGateToken(now = Date.now()): string | null {
  const code = entryCode();
  if (!code) return null;
  const exp = now + STAFF_GATE_MAX_AGE_SECONDS * 1000;
  const nonce = randomBytes(16).toString("hex");
  const payload = `${exp}.${nonce}`;
  const sig = createHmac("sha256", code).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function staffGateTokenValid(token: string | undefined, now = Date.now()): boolean {
  const code = entryCode();
  if (!code || !token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [expRaw, nonce, sig] = parts;
  if (!expRaw || !nonce || !sig) return false;
  if (!/^\d+$/.test(expRaw) || !/^[a-f0-9]{32}$/.test(nonce)) return false;
  const payload = `${expRaw}.${nonce}`;
  const expected = createHmac("sha256", code).update(payload).digest("base64url");
  if (!fixedEqual(sig, expected)) return false;
  return Number(expRaw) > now;
}

export function readAttemptState(token: string | undefined): GateAttemptState {
  const empty = { fails: 0, lockedUntil: 0 };
  if (!token) return empty;
  const parts = token.split(".");
  if (parts.length !== 3) return empty;
  const [failsRaw, untilRaw, sig] = parts;
  if (!failsRaw || !untilRaw || !sig) return empty;
  const payload = `${failsRaw}.${untilRaw}`;
  const expected = createHmac("sha256", attemptKey()).update(payload).digest("base64url");
  if (!fixedEqual(sig, expected)) return empty;
  const fails = Number(failsRaw);
  const lockedUntil = Number(untilRaw);
  if (!Number.isInteger(fails) || fails < 0 || !Number.isFinite(lockedUntil)) return empty;
  return { fails, lockedUntil };
}

export function encodeAttemptState(state: GateAttemptState): string {
  const payload = `${state.fails}.${state.lockedUntil}`;
  const sig = createHmac("sha256", attemptKey()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function attemptIsLocked(state: GateAttemptState, now = Date.now()): boolean {
  return state.lockedUntil > now;
}

export function nextFailedAttempt(state: GateAttemptState, now = Date.now()): GateAttemptState {
  if (state.lockedUntil > now) return state;
  const fails = state.fails + 1;
  if (fails >= STAFF_GATE_MAX_ATTEMPTS) {
    return { fails: 0, lockedUntil: now + STAFF_GATE_LOCK_MS };
  }
  return { fails, lockedUntil: 0 };
}

function attemptKey(): string {
  return entryCode() ?? UNSET_HASH_MATERIAL;
}

function fixedEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
