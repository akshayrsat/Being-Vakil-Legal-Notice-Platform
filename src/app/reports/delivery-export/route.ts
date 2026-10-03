// Per-person delivery CSV for the bank chosen on Reports.
// Summary CSV stays at /reports/export. This file does not replace it.

import { NextResponse } from "next/server";
import { auditCurrentUser } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { deliveryExportXlsx, loadDeliveryExportRows, loadSpeedPostExportRows } from "@/lib/delivery-export";
import { readReportFilters, reportFileBelongsToBank, reportFiltersApplied } from "@/lib/desk-reports";
import { resolveReportBank } from "@/lib/report-bank";
import { isBankUser } from "@/lib/roles";
import { seesVendorDetail } from "@/lib/staff-language";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Sign in first.\n", { status: 401 });

  const url = new URL(request.url);
  const filters = readReportFilters(url.searchParams);
  if (!reportFiltersApplied(filters)) {
    return new NextResponse("Choose a file, a channel, or a date, then press Apply, before downloading.\n", { status: 400 });
  }
  const bank = await resolveReportBank(user, url.searchParams.get("bank") ?? "");
  if (!bank) return new NextResponse("Choose a bank first.\n", { status: 400 });
  if (filters.file && !(await reportFileBelongsToBank(bank.id, filters.file))) {
    return new NextResponse("That file is not on this bank.\n", { status: 400 });
  }

  const sentOnly = isBankUser(user.role);
  const [rows, speedPost] = await Promise.all([
    loadDeliveryExportRows(bank.id, filters, { sentOnly }),
    loadSpeedPostExportRows(bank.id, filters, { sentOnly }),
  ]);
  await auditCurrentUser({
    action: "export",
    summary: `Downloaded a delivery sheet for ${bank.name}.`,
    bankId: bank.id,
    bankName: bank.name,
    targetId: bank.id,
  });

  const code = bank.code.replace(/[^A-Za-z0-9_-]/g, "") || "bank";
  const file = await deliveryExportXlsx(bank, rows, seesVendorDetail(user), speedPost, filters.channel);
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="notice-deliveries-${code}.xlsx"`,
    },
  });
}
