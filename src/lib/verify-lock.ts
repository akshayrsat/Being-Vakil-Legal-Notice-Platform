// Last-4 lockout for one notice or one ODR case. The counter is not an IP address.
// 5 wrong tries lock the link for 30 minutes. Each further block of 5 doubles that, up to 24 hours.

export const VERIFY_FAIL_LIMIT = 5;
export const VERIFY_LOCK_MINUTES = 30;
export const VERIFY_LOCK_MAX_MINUTES = 24 * 60;
export const PRIVACY_PHONE = "+91 9653331393";

export function lockoutAfterFailure(input: { failures: number; now: Date }): {
  failures: number;
  lockedUntil: Date | null;
} {
  const failures = input.failures + 1;
  if (failures % VERIFY_FAIL_LIMIT !== 0) return { failures, lockedUntil: null };
  const strikes = failures / VERIFY_FAIL_LIMIT;
  const minutes = Math.min(VERIFY_LOCK_MINUTES * 2 ** (strikes - 1), VERIFY_LOCK_MAX_MINUTES);
  return {
    failures,
    lockedUntil: new Date(input.now.getTime() + minutes * 60 * 1000),
  };
}

export function verifyLockActive(lockedUntil: Date | null, now: Date): boolean {
  return !!lockedUntil && lockedUntil.getTime() > now.getTime();
}

export function verifyLockMessage(until: Date): string {
  const when = until.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return `Too many wrong attempts. This link is locked until ${when} IST. Call Being Vakil Associates on ${PRIVACY_PHONE}.`;
}
