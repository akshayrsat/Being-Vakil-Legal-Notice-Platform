import { NextResponse } from "next/server";
import { auditCurrentUser } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import {
  loadDeskReport,
  readReportFilters,
  reportFileBelongsToBank,
  reportFiltersApplied,
  reportSummaryCsv,
} from "@/lib/desk-reports";
import { resolveReportBank } from "@/lib/report-bank";
import { isBankUser } from "@/lib/roles";

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

  const report = await loadDeskReport(bank.id, filters, { sentOnly: isBankUser(user.role) });
  await auditCurrentUser({
    action: "export",
    summary: `Downloaded a report summary for ${bank.name}.`,
    bankId: bank.id,
    bankName: bank.name,
    targetId: bank.id,
  });

  return new NextResponse(reportSummaryCsv(bank.name, report), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="notice-report-${bank.code}.csv"`,
    },
  });
}
