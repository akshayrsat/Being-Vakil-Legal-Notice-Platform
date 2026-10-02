// CSV of the same rows the search page shows, for one bank only.

import { NextResponse } from "next/server";
import { auditCurrentUser } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deliveryWhere, filtersToSearch, readDeliveryFilters, reportCsv, type ReportRow } from "@/lib/delivery-report";
import { noticePublicUrl } from "@/lib/notice-link";
import { noticeLinkOpensByNumber } from "@/lib/public-notice";
import { resolveReportBank } from "@/lib/report-bank";

export const dynamic = "force-dynamic";

const EXPORT_LIMIT = 5000;

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return new NextResponse("Sign in first.\n", { status: 401 });
  }

  const url = new URL(request.url);
  const filters = readDeliveryFilters(url.searchParams);
  const bank = await resolveReportBank(user, url.searchParams.get("bank") ?? "");
  if (!bank) {
    return new NextResponse("Choose a bank first.\n", { status: 400 });
  }

  const rows = await prisma.campaignDelivery.findMany({
    where: deliveryWhere(bank.id, filters),
    include: {
      campaign: {
        select: {
          templateName: true,
          createdAt: true,
          bank: { select: { name: true } },
        },
      },
    },
    orderBy: [{ campaign: { createdAt: "desc" } }, { rowNumber: "asc" }],
    take: EXPORT_LIMIT,
  });

  const linkOpens = await noticeLinkOpensByNumber(rows.map((row) => row.noticeNumber));
  const report: ReportRow[] = rows.map((row) => {
    const linkOpen = row.noticeNumber ? linkOpens.get(row.noticeNumber) : undefined;
    return {
      bankName: row.campaign.bank.name,
      campaignName: row.campaign.templateName,
      when: row.campaign.createdAt,
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

  const matched = filters.text ? ` matching “${filters.text}”` : "";
  await auditCurrentUser({
    action: "export",
    summary: `Downloaded a status CSV for ${bank.name}${matched}.`,
    bankId: bank.id,
    bankName: bank.name,
    targetId: bank.id,
  });

  return new NextResponse(reportCsv(report), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="notice-status-${bank.code}.csv"`,
      "X-Report-Query": filtersToSearch(filters, bank.id),
    },
  });
}
