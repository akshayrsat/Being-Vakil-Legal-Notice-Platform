// A short record of who did what. Firm staff read it on the Security page.
// Do not put passwords, notice text, or MSG91 keys in a summary.

import type { Prisma } from "@prisma/client";
import { getSessionContext } from "./auth";
import { prisma } from "./db";
import { indiaDayRange } from "./india-day";

export const AUDIT_ACTIONS = [
  { id: "login", label: "Signed in" },
  { id: "bank.create", label: "Added a bank" },
  { id: "bank.select", label: "Chose a bank" },
  { id: "bank.active", label: "Changed a bank" },
  { id: "upload", label: "Uploaded a spreadsheet" },
  { id: "mapping.save", label: "Saved a column match" },
  { id: "template.create", label: "Created a template" },
  { id: "template.approve", label: "Approved a template" },
  { id: "template.update", label: "Edited a template" },
  { id: "campaign.dry-run", label: "Confirmed a dry run" },
  { id: "campaign.confirm", label: "Confirmed a live send" },
  { id: "campaign.follow-up", label: "Prepared a follow-up" },
  { id: "export", label: "Downloaded a CSV" },
  { id: "status.webhook", label: "MSG91 status update" },
  { id: "speedpost.mark", label: "Marked Speed Post" },
  { id: "speedpost.update", label: "Updated Speed Post" },
  { id: "speedpost.import", label: "Imported Speed Post" },
  { id: "bank.pdf", label: "Changed notice PDF emails" },
] as const;

export type AuditActionId = (typeof AUDIT_ACTIONS)[number]["id"];

const ACTION_IDS = new Set<string>(AUDIT_ACTIONS.map((action) => action.id));

export function auditActionLabel(action: string): string {
  return AUDIT_ACTIONS.find((item) => item.id === action)?.label ?? action;
}

export function isAuditAction(value: string): value is AuditActionId {
  return ACTION_IDS.has(value);
}

export type AuditInput = {
  actorId: string | null;
  actorName: string;
  actorRole: string;
  action: AuditActionId;
  summary: string;
  bankId?: string | null;
  bankName?: string;
  targetId?: string;
};

export async function recordAudit(event: AuditInput): Promise<void> {
  const summary = event.summary.replace(/\s+/g, " ").trim().slice(0, 300);
  if (!summary) return;
  await prisma.auditEvent.create({
    data: {
      actorId: event.actorId,
      actorName: event.actorName.slice(0, 120) || "Unknown",
      actorRole: event.actorRole.slice(0, 40) || "unknown",
      action: event.action,
      summary,
      bankId: event.bankId || null,
      bankName: (event.bankName ?? "").slice(0, 120),
      targetId: (event.targetId ?? "").slice(0, 80),
    },
  });
}

export async function auditCurrentUser(
  event: Omit<AuditInput, "actorId" | "actorName" | "actorRole">,
): Promise<void> {
  const current = await getSessionContext();
  if (!current) return;
  await recordAudit({
    ...event,
    actorId: current.user.id,
    actorName: current.user.name,
    actorRole: current.user.role,
    bankId: event.bankId === undefined ? current.user.bank?.id : event.bankId,
    bankName: event.bankName === undefined ? (current.user.bank?.name ?? "") : event.bankName,
  });
}

export function auditWhere(filters: {
  action: string;
  bankId: string;
  text: string;
  from: string;
  to: string;
}): Prisma.AuditEventWhereInput {
  const where: Prisma.AuditEventWhereInput = {};
  if (isAuditAction(filters.action)) where.action = filters.action;
  if (filters.bankId) where.bankId = filters.bankId;
  const text = filters.text.trim().slice(0, 80);
  if (text) {
    where.OR = [{ actorName: { contains: text } }, { summary: { contains: text } }];
  }
  const createdAt = indiaDayRange(filters.from, filters.to);
  if (createdAt) where.createdAt = createdAt;
  return where;
}
