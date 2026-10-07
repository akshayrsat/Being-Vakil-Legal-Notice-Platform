"use server";

import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { auditCurrentUser } from "@/lib/audit";
import { getSessionContext } from "@/lib/auth";
import { canSetTemporaryPassword, draftLogin } from "@/lib/people";
import { hashPassword, otherSessionsWhere, temporaryPassword } from "@/lib/passwords";
import { prisma } from "@/lib/db";
import { canCreateLogins, roleTitle } from "@/lib/roles";

export type LoginFormState = { error: string } | null;

export type TemporaryPasswordState = { error: string } | { password: string; name: string } | null;

export async function createLogin(
  _previous: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const current = await getSessionContext();
  if (!current) redirect("/login");
  if (!canCreateLogins(current.user.role)) {
    return { error: "Only the owner or a legal coordinator can add a login." };
  }

  const draft = draftLogin({
    actorRole: current.user.role,
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    role: String(formData.get("role") ?? ""),
    bankId: String(formData.get("bankId") ?? ""),
  });
  if (!draft.ok) return { error: draft.error };

  if (draft.bankId) {
    const bank = await prisma.bank.findUnique({ where: { id: draft.bankId } });
    if (!bank) return { error: "Choose the one bank this person can see." };
  }

  const passwordHash = await hashPassword(draft.password);
  try {
    const created = await prisma.user.create({
      data: {
        name: draft.name,
        email: draft.email,
        passwordHash,
        role: draft.role,
        bankId: draft.bankId,
      },
    });
    const bankName = draft.bankId
      ? ((await prisma.bank.findUnique({ where: { id: draft.bankId }, select: { name: true } }))?.name ?? "")
      : "";
    await auditCurrentUser({
      action: "user.create",
      summary: bankName
        ? `Added a ${roleTitle(draft.role).toLowerCase()} login for ${draft.name} on ${bankName}.`
        : `Added a ${roleTitle(draft.role).toLowerCase()} login for ${draft.name}.`,
      bankId: draft.bankId,
      bankName,
      targetId: created.id,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "That email is already a login." };
    }
    throw error;
  }

  redirect("/people?added=1");
}

export async function setTemporaryPassword(
  _previous: TemporaryPasswordState,
  formData: FormData,
): Promise<TemporaryPasswordState> {
  const current = await getSessionContext();
  if (!current) redirect("/login");
  if (!canCreateLogins(current.user.role)) {
    return { error: "Only the owner or a legal coordinator can set a temporary password." };
  }

  const userId = String(formData.get("userId") ?? "").trim();
  if (!userId) return { error: "Choose a person first." };

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { error: "That login was not found." };
  if (!canSetTemporaryPassword(current.user.role, target.role, target.id === current.user.id)) {
    return { error: "You cannot set a temporary password for that person." };
  }

  const password = temporaryPassword();
  const passwordHash = await hashPassword(password);
  await prisma.user.update({
    where: { id: target.id },
    data: { passwordHash, mustChangePassword: true },
  });
  await prisma.session.deleteMany({ where: otherSessionsWhere(target.id, null) });
  await auditCurrentUser({
    action: "user.password",
    summary: `Set a temporary password for ${target.name}.`,
    targetId: target.id,
    bankId: null,
    bankName: "",
  });
  return { password, name: target.name };
}
