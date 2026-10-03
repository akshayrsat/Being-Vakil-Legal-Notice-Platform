// Per-person delivery CSV for the bank chosen on Reports.
// Summary CSV stays at /reports/export. This file does not replace it.

import { NextResponse } from "next/server";
import { auditCurrentUser } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { deliveryExportCsv, loadDeliveryExportRows } from "@/lib/delivery-export";
import { readReportFilters } from "@/lib/desk-reports";
import { resolveReportBank } from "@/lib/report-bank";
import { isBankUser } from "@/lib/roles";
import { seesVendorDetail } from "@/lib/staff-language";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Sign in first.\n", { status: 401 });

  const url = new URL(request.url);
  const filters = readReportFilters(url.searchParams);
  const bank = await resolveReportBank(user, url.searchParams.get("bank") ?? "");
  if (!bank) return new NextResponse("Choose a bank first.\n", { status: 400 });

  const rows = await loadDeliveryExportRows(bank.id, filters, { sentOnly: isBankUser(user.role) });
  await auditCurrentUser({
    action: "export",
    summary: `Downloaded a delivery CSV for ${bank.name}.`,
    bankId: bank.id,
    bankName: bank.name,
    targetId: bank.id,
  });

  const code = bank.code.replace(/[^A-Za-z0-9_-]/g, "") || "bank";
  return new NextResponse(deliveryExportCsv(bank, rows, seesVendorDetail(user)), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="notice-deliveries-${code}.csv"`,
    },
  });
}
