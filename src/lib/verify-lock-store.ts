import { prisma } from "./db";
import { lockoutAfterFailure, verifyLockActive, verifyLockMessage } from "./verify-lock";

export async function verifyLockError(scope: "notice" | "odr", subject: string, now = new Date()): Promise<string> {
  const row = await prisma.verifyLock.findUnique({ where: { scope_subject: { scope, subject } } });
  if (!row || !verifyLockActive(row.lockedUntil, now)) return "";
  return verifyLockMessage(row.lockedUntil ?? now);
}

export async function recordVerifyFailure(scope: "notice" | "odr", subject: string, now = new Date()): Promise<string> {
  const row = await prisma.verifyLock.findUnique({ where: { scope_subject: { scope, subject } } });
  if (row && verifyLockActive(row.lockedUntil, now)) return verifyLockMessage(row.lockedUntil ?? now);
  const next = lockoutAfterFailure({ failures: row?.failures ?? 0, now });
  await prisma.verifyLock.upsert({
    where: { scope_subject: { scope, subject } },
    create: { scope, subject, failures: next.failures, lockedUntil: next.lockedUntil },
    update: { failures: next.failures, lockedUntil: next.lockedUntil },
  });
  if (next.lockedUntil) return verifyLockMessage(next.lockedUntil);
  return "";
}

export async function clearVerifyLock(scope: "notice" | "odr", subject: string): Promise<void> {
  await prisma.verifyLock.update({
    where: { scope_subject: { scope, subject } },
    data: { failures: 0, lockedUntil: null },
  }).catch(() => undefined);
}
