// Staff updates for Speed Post. A Bank Viewer can look, not change a consignment.

"use server";

import { redirect } from "next/navigation";
import { auditCurrentUser } from "@/lib/audit";
import { getSessionContext } from "@/lib/auth";
import { requiredBankId } from "@/lib/bank-data";
import { workingBank } from "@/lib/bank-context";
import { logDesk } from "@/lib/desk-log";
import { prisma } from "@/lib/db";
import { parsePostalCsv } from "@/lib/postal-import";
import {
  activePostalProvider,
  articleNumberError,
  isPostalStatus,
  normalizeArticleNumber,
  parsePostalInstant,
  postalStatusLabel,
  type PostalStatus,
} from "@/lib/postal";
import { canSendNotices } from "@/lib/roles";

export type SpeedPostFormState = { error: string; saved?: string } | null;

async function adminBank() {
  const current = await getSessionContext();
  if (!current) redirect("/login");
  if (!canSendNotices(current.user.role)) {
    return { ok: false as const, error: "Only the owner or a legal coordinator can update Speed Post." };
  }
  const bank = workingBank(current.user);
  if (!bank) return { ok: false as const, error: "Choose a bank before updating Speed Post." };
  if (!bank.active) {
    return { ok: false as const, error: "This bank is inactive. Mark it active before updating Speed Post." };
  }
  return { ok: true as const, bank };
}

export async function markCampaignSpeedPost(
  _previous: SpeedPostFormState,
  formData: FormData,
): Promise<SpeedPostFormState> {
  const scope = await adminBank();
  if (!scope.ok) return { error: scope.error };
  const campaignId = String(formData.get("campaignId") ?? "");
  const onlyRecipient = String(formData.get("recipientRowId") ?? "").trim();
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, bankId: scope.bank.id },
    select: { id: true, templateName: true },
  });
  if (!campaign) return { error: "That send was not found for the bank you are working on." };

  const deliveries = await prisma.campaignDelivery.findMany({
    where: {
      campaignId: campaign.id,
      bankId: requiredBankId(scope.bank.id),
      ...(onlyRecipient ? { recipientRowId: onlyRecipient } : {}),
    },
    orderBy: { rowNumber: "asc" },
  });
  const seen = new Set<string>();
  let created = 0;
  for (const row of deliveries) {
    if (!row.recipientRowId || seen.has(row.recipientRowId)) continue;
    seen.add(row.recipientRowId);
    const existing = await prisma.speedPostConsignment.findFirst({
      where: { bankId: scope.bank.id, campaignId: campaign.id, recipientRowId: row.recipientRowId },
      select: { id: true },
    });
    if (existing) continue;
    const notice = row.noticeNumber
      ? await prisma.publicNotice.findFirst({
          where: { noticeNumber: row.noticeNumber, bankId: scope.bank.id },
          select: { id: true },
        })
      : null;
    await prisma.speedPostConsignment.create({
      data: {
        bankId: scope.bank.id,
        campaignId: campaign.id,
        publicNoticeId: notice?.id,
        recipientRowId: row.recipientRowId,
        customerName: row.customerName,
        loanNumber: row.loanNumber,
        customerId: row.customerId,
        noticeNumber: row.noticeNumber,
        status: "BOOKED",
        note: "Marked as Speed Post.",
        events: {
          create: {
            status: "BOOKED",
            note: "Marked as Speed Post.",
            source: "manual",
            occurredAt: new Date(),
          },
        },
      },
    });
    created += 1;
  }

  await auditCurrentUser({
    action: "speedpost.mark",
    summary: `Marked ${created} ${created === 1 ? "person" : "people"} on ${campaign.templateName} as Speed Post.`,
    bankId: scope.bank.id,
    bankName: scope.bank.name,
    targetId: campaign.id,
  });
  logDesk("speedpost.mark", { bankId: scope.bank.id, campaignId: campaign.id, created });
  if (created === 0) {
    return { error: "Those people are already marked as Speed Post.", saved: "" };
  }
  return { error: "", saved: `Marked ${created} ${created === 1 ? "person" : "people"} as Speed Post.` };
}

export async function saveArticleNumber(
  _previous: SpeedPostFormState,
  formData: FormData,
): Promise<SpeedPostFormState> {
  const scope = await adminBank();
  if (!scope.ok) return { error: scope.error };
  const id = String(formData.get("consignmentId") ?? "");
  const article = normalizeArticleNumber(String(formData.get("articleNumber") ?? ""));
  const problem = articleNumberError(article);
  if (problem) return { error: problem };

  const consignment = await prisma.speedPostConsignment.findFirst({
    where: { id, bankId: scope.bank.id },
  });
  if (!consignment) return { error: "That consignment was not found for this bank." };
  const duplicate = await prisma.speedPostConsignment.findFirst({
    where: { bankId: scope.bank.id, articleNumber: article, NOT: { id } },
    select: { id: true },
  });
  if (duplicate) return { error: "That article number is already on another consignment for this bank." };

  await prisma.speedPostConsignment.update({
    where: { id },
    data: { articleNumber: article },
  });
  await auditCurrentUser({
    action: "speedpost.update",
    summary: `Saved Speed Post article ${article} for ${consignment.customerName || "a recipient"}.`,
    bankId: scope.bank.id,
    bankName: scope.bank.name,
    targetId: id,
  });
  return { error: "", saved: "Article number saved." };
}

export async function addSpeedPostEvent(
  _previous: SpeedPostFormState,
  formData: FormData,
): Promise<SpeedPostFormState> {
  const scope = await adminBank();
  if (!scope.ok) return { error: scope.error };
  const id = String(formData.get("consignmentId") ?? "");
  const status = String(formData.get("status") ?? "").trim().toUpperCase();
  if (!isPostalStatus(status)) return { error: "Choose a Speed Post status." };
  const note = String(formData.get("note") ?? "").trim().slice(0, 300);
  const occurredAt = parsePostalInstant(String(formData.get("occurredAt") ?? "")) ?? new Date();
  const consignment = await prisma.speedPostConsignment.findFirst({
    where: { id, bankId: scope.bank.id },
  });
  if (!consignment) return { error: "That consignment was not found for this bank." };

  await prisma.$transaction([
    prisma.speedPostEvent.create({
      data: { consignmentId: id, status, note, occurredAt, source: "manual" },
    }),
    prisma.speedPostConsignment.update({
      where: { id },
      data: { status, note },
    }),
  ]);
  await auditCurrentUser({
    action: "speedpost.update",
    summary: `Set Speed Post for ${consignment.customerName || consignment.articleNumber || "a recipient"} to ${postalStatusLabel(status)}.`,
    bankId: scope.bank.id,
    bankName: scope.bank.name,
    targetId: id,
  });
  return { error: "", saved: "Status saved." };
}

export async function refreshSpeedPost(
  _previous: SpeedPostFormState,
  formData: FormData,
): Promise<SpeedPostFormState> {
  const scope = await adminBank();
  if (!scope.ok) return { error: scope.error };
  const id = String(formData.get("consignmentId") ?? "");
  const consignment = await prisma.speedPostConsignment.findFirst({
    where: { id, bankId: scope.bank.id },
  });
  if (!consignment) return { error: "That consignment was not found for this bank." };
  if (!consignment.articleNumber) return { error: "Enter an article number before asking for a tracking update." };

  const provider = activePostalProvider();
  const result = await provider.track(consignment.articleNumber);
  if (!result.ok) return { error: result.error };

  const latest = result.snapshot.events[result.snapshot.events.length - 1];
  const fresh = await eventsNotYetStored(
    id,
    result.snapshot.events.map((event) => ({
      status: event.status,
      note: event.note,
      occurredAt: event.occurredAt,
      source: provider.id,
    })),
  );
  await prisma.$transaction([
    ...(fresh.length
      ? [
          prisma.speedPostEvent.createMany({
            data: fresh.map((event) => ({
              consignmentId: id,
              status: event.status,
              note: event.note,
              occurredAt: event.occurredAt,
              source: event.source,
            })),
          }),
        ]
      : []),
    prisma.speedPostConsignment.update({
      where: { id: consignment.id },
      data: {
        status: result.snapshot.status,
        note: latest?.note || consignment.note,
      },
    }),
  ]);
  await auditCurrentUser({
    action: "speedpost.update",
    summary: `India Post update set ${consignment.articleNumber} to ${postalStatusLabel(result.snapshot.status)}.`,
    bankId: scope.bank.id,
    bankName: scope.bank.name,
    targetId: id,
  });
  return { error: "", saved: "Tracking update saved." };
}

export async function importSpeedPostCsv(
  _previous: SpeedPostFormState,
  formData: FormData,
): Promise<SpeedPostFormState> {
  const scope = await adminBank();
  if (!scope.ok) return { error: scope.error };
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Choose a CSV file." };
  if (file.size > 1_000_000) return { error: "That file is larger than 1 MB." };
  const parsed = parsePostalCsv(await file.text());
  if (parsed.rows.length === 0) {
    return { error: parsed.issues[0]?.message ?? "No rows could be read." };
  }

  let applied = 0;
  const issues = [...parsed.issues];
  for (const row of parsed.rows) {
    try {
      const appliedRow = await applyImportRow(scope.bank.id, row);
      if (appliedRow) applied += 1;
      else issues.push({ line: row.line, message: "No matching notice or loan was found for this bank." });
    } catch (error) {
      logDesk("speedpost.import.error", { line: row.line, bankId: scope.bank.id });
      console.error(error instanceof Error ? error.message : "import failed");
      issues.push({ line: row.line, message: "That row could not be saved." });
    }
  }

  await auditCurrentUser({
    action: "speedpost.import",
    summary: `Imported ${applied} Speed Post ${applied === 1 ? "row" : "rows"} for ${scope.bank.name}.`,
    bankId: scope.bank.id,
    bankName: scope.bank.name,
  });
  const problem = issues[0] ? ` ${issues.length} ${issues.length === 1 ? "row needs" : "rows need"} a look: ${issues[0].message}` : "";
  if (applied === 0) return { error: problem.trim() || "Nothing was imported." };
  return { error: "", saved: `Imported ${applied} ${applied === 1 ? "row" : "rows"}.${problem}` };
}

function postalEventKey(event: { status: string; occurredAt: Date; source: string }): string {
  return `${event.status}|${event.source}|${event.occurredAt.toISOString()}`;
}

async function eventsNotYetStored<T extends { status: string; occurredAt: Date; source: string }>(
  consignmentId: string,
  events: T[],
): Promise<T[]> {
  if (events.length === 0) return [];
  const existing = await prisma.speedPostEvent.findMany({
    where: { consignmentId },
    select: { status: true, occurredAt: true, source: true },
  });
  const seen = new Set(existing.map((row) => postalEventKey(row)));
  return events.filter((event) => {
    const key = postalEventKey(event);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function applyImportRow(
  bankId: string,
  row: {
    articleNumber: string;
    noticeNumber: string;
    loanNumber: string;
    customerId: string;
    customerName: string;
    status: PostalStatus | null;
    note: string;
    occurredAt: Date | null;
  },
): Promise<boolean> {
  const status = row.status ?? "BOOKED";
  const occurredAt = row.occurredAt ?? new Date();
  let consignment = row.articleNumber
    ? await prisma.speedPostConsignment.findFirst({
        where: { bankId, articleNumber: row.articleNumber },
      })
    : null;

  if (!consignment && row.noticeNumber) {
    consignment = await prisma.speedPostConsignment.findFirst({
      where: { bankId, noticeNumber: row.noticeNumber },
      orderBy: { updatedAt: "desc" },
    });
  }
  if (!consignment && row.loanNumber) {
    consignment = await prisma.speedPostConsignment.findFirst({
      where: { bankId, loanNumber: row.loanNumber, articleNumber: "" },
      orderBy: { updatedAt: "desc" },
    });
  }

  const notice = row.noticeNumber
    ? await prisma.publicNotice.findFirst({
        where: { bankId, noticeNumber: row.noticeNumber },
        select: { id: true, customerName: true, loanNumber: true, customerId: true, campaignId: true, recipientRowId: true },
      })
    : null;

  if (!consignment && !notice && !row.loanNumber && !row.articleNumber && !row.customerId) return false;

  if (!consignment) {
    if (row.articleNumber) {
      const duplicate = await prisma.speedPostConsignment.findFirst({
        where: { bankId, articleNumber: row.articleNumber },
        select: { id: true },
      });
      if (duplicate) return false;
    }
    await prisma.speedPostConsignment.create({
      data: {
        bankId,
        publicNoticeId: notice?.id,
        campaignId: notice?.campaignId,
        recipientRowId: notice?.recipientRowId ?? "",
        customerName: row.customerName || notice?.customerName || "",
        loanNumber: row.loanNumber || notice?.loanNumber || "",
        customerId: row.customerId || notice?.customerId || "",
        noticeNumber: row.noticeNumber || "",
        articleNumber: row.articleNumber,
        status,
        note: row.note,
        events: {
          create: { status, note: row.note, occurredAt, source: "csv" },
        },
      },
    });
    return true;
  }

  if (row.articleNumber && consignment.articleNumber && consignment.articleNumber !== row.articleNumber) {
    return false;
  }
  const fresh = await eventsNotYetStored(consignment.id, [
    { status, note: row.note, occurredAt, source: "csv" },
  ]);
  await prisma.$transaction([
    ...(fresh.length
      ? [
          prisma.speedPostEvent.create({
            data: {
              consignmentId: consignment.id,
              status,
              note: row.note,
              occurredAt,
              source: "csv",
            },
          }),
        ]
      : []),
    prisma.speedPostConsignment.update({
      where: { id: consignment.id },
      data: {
        articleNumber: consignment.articleNumber || row.articleNumber,
        status,
        note: row.note || consignment.note,
        customerName: consignment.customerName || row.customerName,
        loanNumber: consignment.loanNumber || row.loanNumber,
        customerId: consignment.customerId || row.customerId,
        noticeNumber: consignment.noticeNumber || row.noticeNumber,
        publicNoticeId: consignment.publicNoticeId ?? notice?.id,
      },
    }),
  ]);
  return true;
}
