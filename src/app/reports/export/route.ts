import { NextResponse } from "next/server";
import { auditCurrentUser } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { loadDeskReport, readReportFilters, reportSummaryCsv } from "@/lib/desk-reports";
import { resolveReportBank } from "@/lib/report-bank";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Sign in first.\n", { status: 401 });

  const url = new URL(request.url);
  const filters = readReportFilters(url.searchParams);
  const bank = await resolveReportBank(user, url.searchParams.get("bank") ?? "");
  if (!bank) return new NextResponse("Choose a bank first.\n", { status: 400 });

  const report = await loadDeskReport(bank.id, filters);
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
