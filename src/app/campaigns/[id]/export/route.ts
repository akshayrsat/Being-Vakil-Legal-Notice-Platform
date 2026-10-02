// CSV of one campaign. A Bank Viewer can download only a campaign for their bank.

import { NextResponse } from "next/server";
import { auditCurrentUser } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { isSendChannel } from "@/lib/campaign-plan";
import { isDeliveryStatus, statusesForFilter } from "@/lib/campaigns";
import { prisma } from "@/lib/db";
import { reportCsv, type ReportRow } from "@/lib/delivery-report";
import { noticePublicUrl } from "@/lib/notice-link";
import { noticeLinkOpensByNumber } from "@/lib/public-notice";
import { canReadBank } from "@/lib/report-bank";

export const dynamic = "force-dynamic";

const EXPORT_LIMIT = 5000;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return new NextResponse("Sign in first.\n", { status: 401 });
  }

  const { id } = await context.params;
  const campaign = await prisma.campaign.findFirst({
    where: { id },
    select: {
      id: true,
      bankId: true,
      templateName: true,
      createdAt: true,
      bank: { select: { name: true, code: true } },
    },
  });
  if (!campaign || !canReadBank(user, campaign.bankId)) {
    return new NextResponse("That send was not found.\n", { status: 404 });
  }

  const url = new URL(request.url);
  const channel = (url.searchParams.get("channel") ?? "").trim().toUpperCase();
  const status = (url.searchParams.get("status") ?? "").trim().toUpperCase();

  const rows = await prisma.campaignDelivery.findMany({
    where: {
      campaignId: campaign.id,
      bankId: campaign.bankId,
      ...(isSendChannel(channel) ? { channel } : {}),
      ...(isDeliveryStatus(status) ? { status: { in: statusesForFilter(status) } } : {}),
    },
    orderBy: [{ rowNumber: "asc" }, { channel: "asc" }],
    take: EXPORT_LIMIT,
  });

  const linkOpens = await noticeLinkOpensByNumber(rows.map((row) => row.noticeNumber));
  const report: ReportRow[] = rows.map((row) => {
    const linkOpen = row.noticeNumber ? linkOpens.get(row.noticeNumber) : undefined;
    return {
      bankName: campaign.bank.name,
      campaignName: campaign.templateName,
      when: campaign.createdAt,
      customerName: row.customerName,
      mobile: row.mobile,
      email: row.email,
      loanNumber: row.loanNumber,
      customerId: row.customerId,
      channel: row.channel,
      status: row.status,
      detail: row.detail,
      rowNumber: row.rowNumber,
      noticeNumber: row.noticeNumber,
      noticeUrl: row.noticeNumber ? noticePublicUrl(row.noticeNumber) : "",
      openedAt: row.openedAt,
      linkOpenedAt: linkOpen?.linkOpenedAt ?? null,
      linkViewCount: linkOpen?.linkViewCount ?? 0,
    };
  });

  await auditCurrentUser({
    action: "export",
    summary: `Downloaded the campaign CSV for ${campaign.templateName}.`,
    bankId: campaign.bankId,
    bankName: campaign.bank.name,
    targetId: campaign.id,
  });

  return new NextResponse(reportCsv(report), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="notice-campaign-${campaign.bank.code}.csv"`,
    },
  });
}
