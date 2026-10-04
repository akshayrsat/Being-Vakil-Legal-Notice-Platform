// Adds a printed legal notice for the firm.
// SMS, email, and WhatsApp wording is not written here.

"use server";

import { redirect } from "next/navigation";
import { auditCurrentUser } from "@/lib/audit";
import { getSessionContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { draftLegalNoticeTemplate, ensureStarterLegalNotice } from "@/lib/legal-notice-templates";
import { canSendNotices } from "@/lib/roles";
import { LEGAL_NOTICES_HREF } from "@/lib/send-notice";

export type LegalNoticeFormState = { error: string } | null;

async function requireSender() {
  const current = await getSessionContext();
  if (!current) redirect("/login");
  if (!canSendNotices(current.user.role)) redirect("/deliveries");
  return current;
}

export async function createLegalNoticeTemplate(
  _previous: LegalNoticeFormState,
  formData: FormData,
): Promise<LegalNoticeFormState> {
  await requireSender();
  await ensureStarterLegalNotice(prisma);

  const existing = await prisma.legalNoticeTemplate.findMany({ select: { name: true } });
  const draft = draftLegalNoticeTemplate({
    name: String(formData.get("name") ?? ""),
    body: String(formData.get("body") ?? ""),
    existingNames: existing.map((row) => row.name),
  });
  if (!draft.ok) return { error: draft.error };

  const created = await prisma.legalNoticeTemplate.create({
    data: {
      name: draft.name,
      body: draft.body,
      format: "text",
    },
  });

  await auditCurrentUser({
    action: "legal-notice.create",
    summary: `Added the legal notice “${created.name}”.`,
    bankId: null,
    bankName: "",
    targetId: created.id,
  });

  redirect(`${LEGAL_NOTICES_HREF}?added=1`);
}
