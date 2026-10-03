// CSV of the same rows the search page shows, for one bank only.

import { NextResponse } from "next/server";
import { auditCurrentUser } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deliveryWhere, filtersToSearch, readDeliveryFilters, reportCsv, type ReportRow } from "@/lib/delivery-report";
import { csvCell, indiaDayRange } from "@/lib/india-day";
import { noticePublicUrl } from "@/lib/notice-link";
import { postalStatusLabel } from "@/lib/postal";
import { noticeLinkOpensByNumber } from "@/lib/public-notice";
import { reportFileBelongsToBank } from "@/lib/desk-reports";
import { resolveReportBank } from "@/lib/report-bank";
import { isBankUser } from "@/lib/roles";
import { seesVendorDetail } from "@/lib/staff-language";

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
  if (filters.file && !(await reportFileBelongsToBank(bank.id, filters.file))) {
    return new NextResponse("That file is not on this bank.\n", { status: 400 });
  }

  if (filters.channel === "SPEED_POST") {
    return exportSpeedPost(bank, filters);
  }

  const rows = await prisma.campaignDelivery.findMany({
    where: deliveryWhere(bank.id, filters, { sentOnly: isBankUser(user.role) }),
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

  const linkOpens = await noticeLinkOpensByNumber(
    rows.map((row) => row.noticeNumber),
    bank.id,
  );
  const noticeNumbers = [...new Set(rows.map((row) => row.noticeNumber).filter(Boolean))];
  const consignments = noticeNumbers.length
    ? await prisma.speedPostConsignment.findMany({
        where: { bankId: bank.id, noticeNumber: { in: noticeNumbers } },
        select: { noticeNumber: true, articleNumber: true, status: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      })
    : [];
  const postalByNotice = new Map<string, { articleNumber: string; status: string }>();
  for (const item of consignments) {
    if (item.noticeNumber && !postalByNotice.has(item.noticeNumber)) {
      postalByNotice.set(item.noticeNumber, { articleNumber: item.articleNumber, status: item.status });
    }
  }
  const report: ReportRow[] = rows.map((row) => {
    const linkOpen = row.noticeNumber ? linkOpens.get(row.noticeNumber) : undefined;
    const postal = row.noticeNumber ? postalByNotice.get(row.noticeNumber) : undefined;
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
      speedPostArticle: postal?.articleNumber ?? "",
      speedPostStatus: postal ? postalStatusLabel(postal.status) : "",
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

  return new NextResponse(reportCsv(report, seesVendorDetail(user)), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="notice-status-${bank.code}.csv"`,
      "X-Report-Query": filtersToSearch(filters, bank.id),
    },
  });
}

async function exportSpeedPost(
  bank: { id: string; name: string; code: string },
  filters: { from: string; to: string; file: string },
) {
  const range = indiaDayRange(filters.from, filters.to);
  const rows = await prisma.speedPostConsignment.findMany({
    where: {
      bankId: bank.id,
      ...(range ? { updatedAt: range } : {}),
      ...(filters.file
        ? { campaign: { bankId: bank.id, batch: { id: filters.file, bankId: bank.id } } }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: EXPORT_LIMIT,
  });
  const lines = [
    ["Bank", "Customer", "Loan number", "Customer id", "Notice number", "Article", "Status", "Note", "Updated"]
      .map(csvCell)
      .join(","),
  ];
  for (const row of rows) {
    lines.push(
      [
        bank.name,
        row.customerName,
        row.loanNumber,
        row.customerId,
        row.noticeNumber,
        row.articleNumber,
        postalStatusLabel(row.status),
        row.note,
        row.updatedAt.toISOString(),
      ]
        .map(csvCell)
        .join(","),
    );
  }
  await auditCurrentUser({
    action: "export",
    summary: `Downloaded a Speed Post CSV for ${bank.name}.`,
    bankId: bank.id,
    bankName: bank.name,
    targetId: bank.id,
  });
  return new NextResponse(`\uFEFF${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="speed-post-${bank.code}.csv"`,
    },
  });
}
