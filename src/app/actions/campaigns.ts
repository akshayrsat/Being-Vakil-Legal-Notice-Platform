// Prepares a send for the current bank, then confirms it.
// With no MSG91 live-send switch, confirm records a dry run and does not call MSG91.

"use server";

import { redirect } from "next/navigation";
import { auditCurrentUser } from "@/lib/audit";
import { getSessionContext } from "@/lib/auth";
import { workingBank } from "@/lib/bank-context";
import { isSendChannel, type SendChannel } from "@/lib/campaign-plan";
import { prisma } from "@/lib/db";
import { deliverNotice, dryRunReason, isLiveSendEnabled } from "@/lib/msg91";
import { emailNoticeVars, whatsappNoticeVars, smsNoticeVars } from "@/lib/notice-link";
import { writePreparedDeliveries } from "@/lib/prepare-send";
import { ROLE_ADMIN } from "@/lib/roles";
import { TEMPLATE_APPROVED } from "@/lib/templates";

export type CampaignFormState = { error: string } | null;

async function adminBank() {
  const current = await getSessionContext();
  if (!current) redirect("/login");
  if (current.user.role !== ROLE_ADMIN) {
    return { ok: false as const, error: "Only firm staff can prepare a send." };
  }
  const bank = workingBank(current.user);
  if (!bank) {
    return { ok: false as const, error: "Choose a bank before preparing a send." };
  }
  if (!bank.active) {
    return {
      ok: false as const,
      error: "This bank is inactive. Mark it active on the Banks page before preparing a send.",
    };
  }
  return { ok: true as const, bank, userId: current.user.id };
}

export async function createCampaign(
  _previous: CampaignFormState,
  formData: FormData,
): Promise<CampaignFormState> {
  const scope = await adminBank();
  if (!scope.ok) return { error: scope.error };

  const batchId = String(formData.get("batchId") ?? "");
  const templateId = String(formData.get("templateId") ?? "");
  const channels = formData
    .getAll("channel")
    .map((value) => String(value).trim().toUpperCase())
    .filter(isSendChannel);

  if (channels.length === 0) {
    return { error: "Tick at least one channel: SMS, Email, or WhatsApp." };
  }

  const batch = await prisma.uploadBatch.findFirst({
    where: { id: batchId, bankId: scope.bank.id, saved: true },
  });
  if (!batch) {
    return { error: "Choose a spreadsheet that already has a saved column match." };
  }

  const template = await prisma.noticeTemplate.findFirst({
    where: { id: templateId, bankId: scope.bank.id, status: TEMPLATE_APPROVED },
  });
  if (!template) {
    return { error: "Choose an approved template. Drafts cannot be sent." };
  }

  const rows = await prisma.recipientRow.findMany({
    where: { batchId: batch.id },
    orderBy: { rowNumber: "asc" },
  });
  if (rows.length === 0) {
    return { error: "That spreadsheet has no saved people." };
  }

  const live = isLiveSendEnabled();
  const campaign = await prisma.$transaction(
    async (tx) => {
      const created = await tx.campaign.create({
        data: {
          bankId: scope.bank.id,
          batchId: batch.id,
          templateId: template.id,
          templateName: template.name,
          templateBody: template.body,
          dltTemplateId: template.dltTemplateId,
          channels: JSON.stringify(channels),
          mode: live ? "LIVE" : "DRY_RUN",
          status: "REVIEW",
          dryRunNote: live ? "" : dryRunReason(),
          createdById: scope.userId,
        },
      });
      await writePreparedDeliveries(tx, {
        campaignId: created.id,
        bankId: scope.bank.id,
        bankName: scope.bank.name,
        templateBody: template.body,
        rows,
        channels,
      });
      return created;
    },
    { timeout: 30000 },
  );

  redirect(`/campaigns/${campaign.id}`);
}

export async function startFollowUp(
  _previous: CampaignFormState,
  formData: FormData,
): Promise<CampaignFormState> {
  const scope = await adminBank();
  if (!scope.ok) return { error: scope.error };

  const parentId = String(formData.get("campaignId") ?? "");
  const parent = await prisma.campaign.findFirst({
    where: { id: parentId, bankId: scope.bank.id },
    include: { deliveries: true },
  });
  if (!parent) {
    return { error: "That send was not found for the bank you are working on." };
  }
  if (parent.status === "REVIEW") {
    return { error: "Confirm the send before preparing a follow-up." };
  }

  const openFollowUp = await prisma.campaign.findFirst({
    where: { followsCampaignId: parent.id, bankId: scope.bank.id, status: "REVIEW" },
    select: { id: true },
  });
  if (openFollowUp) redirect(`/campaigns/${openFollowUp.id}`);

  const missed = parent.deliveries.filter(
    (row) => row.status === "SKIPPED" || row.status === "FAILED",
  );
  if (missed.length === 0) {
    return { error: "Nobody was skipped or failed, so there is nobody to follow up." };
  }

  const channels = [...new Set(missed.map((row) => row.channel))].filter(isSendChannel);
  const rowIds = [...new Set(missed.map((row) => row.recipientRowId))];
  const rows = await prisma.recipientRow.findMany({
    where: { id: { in: rowIds }, bankId: scope.bank.id },
    orderBy: { rowNumber: "asc" },
  });
  if (rows.length === 0) {
    return { error: "The people on that send could not be found." };
  }

  const missedKeys = new Set(missed.map((row) => `${row.recipientRowId}:${row.channel}`));
  const live = isLiveSendEnabled();
  const note = `Follow-up to “${parent.templateName}”. People are matched on loan number, customer id, or mobile. ${
    live ? "Live send is on." : dryRunReason()
  }`;
  let campaign;
  try {
    campaign = await prisma.$transaction(
      async (tx) => {
        const created = await tx.campaign.create({
          data: {
            bankId: scope.bank.id,
            batchId: parent.batchId,
            templateId: parent.templateId,
            templateName: parent.templateName,
            templateBody: parent.templateBody,
            dltTemplateId: parent.dltTemplateId,
            channels: JSON.stringify(channels),
            mode: live ? "LIVE" : "DRY_RUN",
            status: "REVIEW",
            dryRunNote: note,
            createdById: scope.userId,
            followsCampaignId: parent.id,
          },
        });
        const kept = await writePreparedDeliveries(tx, {
          campaignId: created.id,
          bankId: scope.bank.id,
          bankName: scope.bank.name,
          templateBody: parent.templateBody,
          rows,
          channels,
          include: missedKeys,
        });
        if (kept === 0) throw new Error("NO_FOLLOW_UP");
        return created;
      },
      { timeout: 30000 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "NO_FOLLOW_UP") {
      return { error: "Nobody was skipped or failed, so there is nobody to follow up." };
    }
    throw error;
  }

  await auditCurrentUser({
    action: "campaign.follow-up",
    summary: `Prepared a follow-up to ${parent.templateName}. Nothing was sent.`,
    bankId: scope.bank.id,
    bankName: scope.bank.name,
    targetId: campaign.id,
  });

  redirect(`/campaigns/${campaign.id}`);
}

export async function confirmCampaign(
  _previous: CampaignFormState,
  formData: FormData,
): Promise<CampaignFormState> {
  const scope = await adminBank();
  if (!scope.ok) return { error: scope.error };

  const campaignId = String(formData.get("campaignId") ?? "");
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, bankId: scope.bank.id },
  });
  if (!campaign) {
    return { error: "That send was not found for the bank you are working on." };
  }
  if (campaign.status !== "REVIEW") {
    return { error: "This send was already confirmed." };
  }

  if (campaign.mode === "DRY_RUN") {
    const done = await finishDryRun(campaign.id, scope.bank.id);
    if (done) {
      await auditCurrentUser({
        action: "campaign.dry-run",
        summary: `Confirmed a dry run of ${campaign.templateName}. Nothing was sent.`,
        bankId: scope.bank.id,
        bankName: scope.bank.name,
        targetId: campaign.id,
      });
    }
    redirect(`/campaigns/${campaign.id}?done=1`);
  }

  const done = await finishLiveSend(campaign.id, scope.bank.id, campaign.dltTemplateId);
  if (done) {
    await auditCurrentUser({
      action: "campaign.confirm",
      summary: `Confirmed a live send of ${campaign.templateName}.`,
      bankId: scope.bank.id,
      bankName: scope.bank.name,
      targetId: campaign.id,
    });
  }
  redirect(`/campaigns/${campaign.id}?done=1`);
}

async function finishDryRun(campaignId: string, bankId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.campaign.updateMany({
      where: { id: campaignId, bankId, status: "REVIEW" },
      data: {
        status: "COMPLETED",
        mode: "DRY_RUN",
        confirmedAt: new Date(),
      },
    });
    if (updated.count !== 1) return false;
    await tx.campaignDelivery.updateMany({
      where: { campaignId, status: "PENDING" },
      data: {
        status: "SIMULATED_SENT",
        detail: "Dry run. Queued here as a simulated send. Nothing was sent.",
      },
    });
    return true;
  });
}

async function finishLiveSend(
  campaignId: string,
  bankId: string,
  dltTemplateId: string,
): Promise<boolean> {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, bankId },
    select: { bank: { select: { name: true } } },
  });
  const bankName = campaign?.bank.name ?? "";
  const pending = await prisma.campaignDelivery.findMany({
    where: { campaignId, status: "PENDING" },
    orderBy: { rowNumber: "asc" },
  });

  for (const row of pending) {
    const channel = row.channel as SendChannel;
    const to = channel === "EMAIL" ? row.email : row.mobile;
    const result = await deliverNotice({
      channel,
      to,
      body: row.messageText,
      dltTemplateId,
      sms:
        channel === "SMS" && row.noticeNumber
          ? smsNoticeVars({
              customerName: row.customerName,
              bankName,
              noticeNumber: row.noticeNumber,
            })
          : undefined,
      email:
        channel === "EMAIL" && row.noticeNumber
          ? emailNoticeVars({
              customerName: row.customerName,
              loanAccount: row.loanNumber,
              noticeNumber: row.noticeNumber,
            })
          : undefined,
      whatsapp:
        channel === "WHATSAPP" && row.noticeNumber
          ? whatsappNoticeVars({
              customerName: row.customerName,
              bankName,
              noticeNumber: row.noticeNumber,
            })
          : undefined,
    });
    await prisma.campaignDelivery.updateMany({
      where: { id: row.id, campaignId, status: "PENDING" },
      data: result.ok
        ? { status: "DELIVERED", detail: "Handed to MSG91.", providerId: result.providerId }
        : { status: "FAILED", detail: result.error },
    });
  }

  const failed = await prisma.campaignDelivery.count({
    where: { campaignId, status: "FAILED" },
  });
  const updated = await prisma.campaign.updateMany({
    where: { id: campaignId, bankId, status: "REVIEW" },
    data: {
      status: failed > 0 && failed === pending.length ? "FAILED" : "COMPLETED",
      mode: "LIVE",
      confirmedAt: new Date(),
    },
  });
  return updated.count === 1;
}
