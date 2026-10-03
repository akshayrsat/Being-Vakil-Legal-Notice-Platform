"use server";

import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { auditCurrentUser } from "@/lib/audit";
import { getSessionContext } from "@/lib/auth";
import { draftLogin } from "@/lib/people";
import { prisma } from "@/lib/db";
import { canCreateLogins, roleTitle } from "@/lib/roles";

export type LoginFormState = { error: string } | null;

async function hashPassword(password: string): Promise<string> {
  const loaded = (await import("bcryptjs")) as {
    hash?: (value: string, rounds: number) => Promise<string>;
    default?: { hash: (value: string, rounds: number) => Promise<string> };
  };
  const hash = loaded.hash ?? loaded.default?.hash;
  if (!hash) throw new Error("bcryptjs did not load");
  return hash(password, 10);
}

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
