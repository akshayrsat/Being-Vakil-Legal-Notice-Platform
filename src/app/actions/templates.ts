// Saves a notice template under the bank the Admin is working on.

"use server";

import { redirect } from "next/navigation";
import { auditCurrentUser } from "@/lib/audit";
import { getSessionContext } from "@/lib/auth";
import { workingBank } from "@/lib/bank-context";
import { prisma } from "@/lib/db";
import { ROLE_ADMIN } from "@/lib/roles";
import {
  channelsFromForm,
  statusFromForm,
  TEMPLATE_APPROVED,
  type TemplateChannel,
} from "@/lib/templates";

export type TemplateFormState = { error: string } | null;

const NAME_MAX = 80;
const DLT_MAX = 64;
const BODY_MAX = 4000;

async function adminBank() {
  const current = await getSessionContext();
  if (!current) redirect("/login");
  if (current.user.role !== ROLE_ADMIN) {
    return { ok: false as const, error: "Only firm staff can change a notice template." };
  }
  const bank = workingBank(current.user);
  if (!bank) {
    return { ok: false as const, error: "Choose a bank before saving a template." };
  }
  if (!bank.active) {
    return {
      ok: false as const,
      error: "This bank is inactive. Mark it active on the Banks page before saving a template.",
    };
  }
  return { ok: true as const, bank };
}

export async function saveTemplate(
  _previous: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  const scope = await adminBank();
  if (!scope.ok) return { error: scope.error };

  const templateId = String(formData.get("templateId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
  const dltTemplateId = String(formData.get("dltTemplateId") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const channels = channelsFromForm(formData);
  const status = statusFromForm(formData);

  const problem = validateTemplate({ name, dltTemplateId, body, channels, status });
  if (problem) return { error: problem };

  let previousStatus = "";
  if (templateId) {
    const existing = await prisma.noticeTemplate.findFirst({
      where: { id: templateId, bankId: scope.bank.id },
      select: { id: true, status: true },
    });
    if (!existing) {
      return { error: "That template was not found for the bank you are working on." };
    }
    previousStatus = existing.status;
  }

  const duplicate = await nameTaken(scope.bank.id, name, templateId);
  if (duplicate) {
    return { error: "This bank already has a template with that name." };
  }

  const data = {
    name,
    dltTemplateId,
    channels: JSON.stringify(channels),
    body,
    status,
  };

  const bankNote = { bankId: scope.bank.id, bankName: scope.bank.name };

  if (templateId) {
    const updated = await prisma.noticeTemplate.updateMany({
      where: { id: templateId, bankId: scope.bank.id },
      data,
    });
    if (updated.count !== 1) {
      return { error: "That template was not found for the bank you are working on." };
    }
    if (status === TEMPLATE_APPROVED && previousStatus !== TEMPLATE_APPROVED) {
      await auditCurrentUser({
        action: "template.approve",
        summary: `Approved the template ${name}.`,
        ...bankNote,
        targetId: templateId,
      });
    } else {
      await auditCurrentUser({
        action: "template.update",
        summary: `Edited the template ${name}.`,
        ...bankNote,
        targetId: templateId,
      });
    }
    redirect(`/templates/${templateId}?saved=1`);
  }

  const created = await prisma.noticeTemplate.create({
    data: { ...data, bankId: scope.bank.id },
  });
  await auditCurrentUser({
    action: "template.create",
    summary: `Created the template ${name}.`,
    ...bankNote,
    targetId: created.id,
  });
  if (status === TEMPLATE_APPROVED) {
    await auditCurrentUser({
      action: "template.approve",
      summary: `Approved the template ${name}.`,
      ...bankNote,
      targetId: created.id,
    });
  }
  redirect(`/templates/${created.id}?saved=1`);
}

function validateTemplate(input: {
  name: string;
  dltTemplateId: string;
  body: string;
  channels: TemplateChannel[];
  status: string;
}): string | null {
  if (input.name.length < 2 || input.name.length > NAME_MAX) {
    return `Enter a template name, between 2 and ${NAME_MAX} characters.`;
  }
  if (input.channels.length === 0) {
    return "Tick at least one channel: SMS, Email, or WhatsApp.";
  }
  if (!input.body) {
    return "Write the notice text. Use a placeholder such as {{customer_name}} where a person’s detail should go.";
  }
  if (input.body.length > BODY_MAX) {
    return `The notice text is longer than ${BODY_MAX} characters. Shorten it.`;
  }
  if (input.dltTemplateId.length > DLT_MAX || /[\r\n]/.test(input.dltTemplateId)) {
    return `The DLT template id must be ${DLT_MAX} characters or fewer, on one line.`;
  }
  if (input.status === TEMPLATE_APPROVED && !input.dltTemplateId) {
    return "Enter the DLT template id before marking this template approved.";
  }
  return null;
}

async function nameTaken(bankId: string, name: string, templateId: string): Promise<boolean> {
  const others = await prisma.noticeTemplate.findMany({
    where: templateId ? { bankId, NOT: { id: templateId } } : { bankId },
    select: { name: true },
  });
  const wanted = name.toLowerCase();
  return others.some((template) => template.name.toLowerCase() === wanted);
}
