// Admin-only changes to the bank list: add a bank, mark it active or inactive, and choose which bank to work on.

"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auditCurrentUser } from "@/lib/audit";
import { getSessionContext } from "@/lib/auth";
import { normalizeBankCode, normalizeBankName } from "@/lib/banks";
import { prisma } from "@/lib/db";
import { approvedOnLabel } from "@/lib/grievance";
import { validGuestEmail } from "@/lib/odr-guests";
import { canChooseBank, isOwner } from "@/lib/roles";

export type BankFormState = { error: string } | null;

async function requireOwner() {
  const current = await getSessionContext();
  if (!current) redirect("/login");
  if (!isOwner(current.user.role)) redirect("/dashboard");
  return current;
}

async function requireChooser() {
  const current = await getSessionContext();
  if (!current) redirect("/login");
  if (!canChooseBank(current.user.role)) redirect("/dashboard");
  return current;
}

export async function createBank(
  _previous: BankFormState,
  formData: FormData,
): Promise<BankFormState> {
  await requireOwner();

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
  const current = await requireChooser();
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
  await requireOwner();
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

export async function saveBankGrievance(
  _previous: BankFormState,
  formData: FormData,
): Promise<BankFormState> {
  await requireOwner();
  const bankId = String(formData.get("bankId") ?? "");
  const bank = await prisma.bank.findUnique({ where: { id: bankId } });
  if (!bank) return { error: "That bank was not found." };
  const wordingApprovedOn = String(formData.get("wordingApprovedOn") ?? "").trim();
  if (wordingApprovedOn && !approvedOnLabel(wordingApprovedOn)) {
    return { error: "The approval date must be a calendar date, or left blank." };
  }
  const email = String(formData.get("grievanceOfficerEmail") ?? "").trim().slice(0, 160);
  if (email && !email.includes("@")) return { error: "Enter a grievance officer email, or leave it blank." };
  await prisma.bank.update({
    where: { id: bank.id },
    data: {
      grievanceOfficerName: String(formData.get("grievanceOfficerName") ?? "").trim().slice(0, 160),
      grievanceOfficerPhone: String(formData.get("grievanceOfficerPhone") ?? "").trim().slice(0, 40),
      grievanceOfficerEmail: email,
      grievanceOmbudsman: String(formData.get("grievanceOmbudsman") ?? "").trim().slice(0, 500),
      wordingApprovedOn,
    },
  });
  await auditCurrentUser({
    action: "bank.grievance",
    summary: wordingApprovedOn
      ? `Recorded the grievance officer for ${bank.name}. Wording approved by the bank on ${wordingApprovedOn}.`
      : `Recorded the grievance officer for ${bank.name}.`,
    bankId: bank.id,
    bankName: bank.name,
    targetId: bank.id,
  });
  redirect("/banks?saved=grievance");
}

export async function setAttachNoticePdf(formData: FormData): Promise<void> {
  await requireOwner();
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

export async function saveBankRepresentative(
  _previous: BankFormState,
  formData: FormData,
): Promise<BankFormState> {
  await requireChooser();
  const bankId = String(formData.get("bankId") ?? "");
  const bank = await prisma.bank.findUnique({ where: { id: bankId } });
  if (!bank) return { error: "That bank was not found." };
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 160);
  const mobile = String(formData.get("mobile") ?? "").trim().slice(0, 40);
  if (name.length < 2) return { error: "Enter the representative’s name." };
  if (!validGuestEmail(email)) return { error: "Enter the representative’s email." };
  const count = await prisma.bankRepresentative.count({ where: { bankId: bank.id } });
  await prisma.bankRepresentative.create({
    data: { bankId: bank.id, name, email, mobile, sortOrder: count },
  });
  await auditCurrentUser({
    action: "bank.representative",
    summary: `Added ${name} as a bank representative for ${bank.name}.`,
    bankId: bank.id,
    bankName: bank.name,
    targetId: bank.id,
  });
  const { syncBankCalendarGuests } = await import("@/lib/odr-runner");
  await syncBankCalendarGuests(prisma, bank.id);
  redirect("/banks");
}

export async function removeBankRepresentative(formData: FormData): Promise<void> {
  await requireChooser();
  const id = String(formData.get("representativeId") ?? "");
  const row = await prisma.bankRepresentative.findUnique({ where: { id }, include: { bank: true } });
  if (!row) redirect("/banks");
  await prisma.bankRepresentative.delete({ where: { id: row.id } });
  await auditCurrentUser({
    action: "bank.representative",
    summary: `Removed ${row.name} as a bank representative for ${row.bank.name}.`,
    bankId: row.bank.id,
    bankName: row.bank.name,
    targetId: row.id,
  });
  const { syncBankCalendarGuests } = await import("@/lib/odr-runner");
  await syncBankCalendarGuests(prisma, row.bank.id);
  redirect("/banks");
}
