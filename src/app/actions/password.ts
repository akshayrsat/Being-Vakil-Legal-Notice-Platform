"use server";

import { redirect } from "next/navigation";
import { auditCurrentUser } from "@/lib/audit";
import { getSessionContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { changePasswordError, hashPassword, otherSessionsWhere, passwordMatches } from "@/lib/passwords";

export type ChangePasswordState = { error: string } | { done: true } | null;

export async function changePassword(
  _previous: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const current = await getSessionContext({ allowStalePassword: true });
  if (!current) redirect("/login");

  const next = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const existing = String(formData.get("current") ?? "");
  const problem = changePasswordError({ current: existing, next, confirm });
  if (problem) return { error: problem };

  const user = await prisma.user.findUnique({
    where: { id: current.user.id },
    select: { passwordHash: true },
  });
  const matches = await passwordMatches(existing, user?.passwordHash ?? null);
  if (!user || !matches) return { error: "The current password is not correct." };

  const passwordHash = await hashPassword(next);
  await prisma.user.update({
    where: { id: current.user.id },
    data: { passwordHash, mustChangePassword: false },
  });
  await prisma.session.deleteMany({
    where: otherSessionsWhere(current.user.id, current.sessionId),
  });
  await auditCurrentUser({
    action: "user.password",
    summary: "Changed their password.",
    targetId: current.user.id,
  });
  return { done: true };
}
