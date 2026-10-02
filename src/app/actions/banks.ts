// Admin-only changes to the bank list: add a bank, mark it active or inactive, and choose which bank to work on.

"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auditCurrentUser } from "@/lib/audit";
import { getSessionContext } from "@/lib/auth";
import { normalizeBankCode, normalizeBankName } from "@/lib/banks";
import { prisma } from "@/lib/db";
import { ROLE_ADMIN } from "@/lib/roles";

export type BankFormState = { error: string } | null;

async function requireAdmin() {
  const current = await getSessionContext();
  if (!current) redirect("/login");
  if (current.user.role !== ROLE_ADMIN) redirect("/dashboard");
  return current;
}

export async function createBank(
  _previous: BankFormState,
  formData: FormData,
): Promise<BankFormState> {
  await requireAdmin();

  const name = normalizeBankName(String(formData.get("name") ?? ""));
  const code = normalizeBankCode(String(formData.get("code") ?? ""));

  if (!name) {
    return { error: "Enter a bank name, between 2 and 80 characters." };
  }
  if (!code) {
    return {
      error: "Enter a short code of 2 to 8 letters or numbers, such as NWH.",
    };
  }

  let created: { id: string; name: string; code: string };
  try {
    created = await prisma.bank.create({
      data: { name, code, active: true },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: `A bank with the short code ${code} already exists.` };
    }
    throw error;
  }

  await auditCurrentUser({
    action: "bank.create",
    summary: `Added ${created.name} (${created.code}).`,
    bankId: created.id,
    bankName: created.name,
    targetId: created.id,
  });

  redirect(`/banks?added=${encodeURIComponent(code)}`);
}

export async function selectBank(formData: FormData): Promise<void> {
  const current = await requireAdmin();
  const bankId = String(formData.get("bankId") ?? "");
  const bank = await prisma.bank.findUnique({ where: { id: bankId } });
  if (!bank) redirect("/banks");

  await prisma.user.update({
    where: { id: current.user.id },
    data: { selectedBankId: bank.id },
  });
  revalidatePath("/", "layout");

  await auditCurrentUser({
    action: "bank.select",
    summary: `Chose to work on ${bank.name}.`,
    bankId: bank.id,
    bankName: bank.name,
    targetId: bank.id,
  });

  redirect("/dashboard");
}

export async function setBankActive(formData: FormData): Promise<void> {
  await requireAdmin();
  const bankId = String(formData.get("bankId") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  const bank = await prisma.bank.findUnique({ where: { id: bankId } });
  if (!bank) redirect("/banks");

  await prisma.bank.update({
    where: { id: bank.id },
    data: { active },
  });

  await auditCurrentUser({
    action: "bank.active",
    summary: active ? `Marked ${bank.name} active.` : `Marked ${bank.name} inactive.`,
    bankId: bank.id,
    bankName: bank.name,
    targetId: bank.id,
  });

  redirect("/banks");
}

export async function setAttachNoticePdf(formData: FormData): Promise<void> {
  await requireAdmin();
  const bankId = String(formData.get("bankId") ?? "");
  const attach = String(formData.get("attachNoticePdf") ?? "") === "true";
  const bank = await prisma.bank.findUnique({ where: { id: bankId } });
  if (!bank) redirect("/banks");

  await prisma.bank.update({
    where: { id: bank.id },
    data: { attachNoticePdf: attach },
  });

  await auditCurrentUser({
    action: "bank.pdf",
    summary: attach
      ? `Turned on notice PDF attachments for ${bank.name}. The email link is unchanged.`
      : `Turned off notice PDF attachments for ${bank.name}.`,
    bankId: bank.id,
    bankName: bank.name,
    targetId: bank.id,
  });

  redirect("/banks");
}
