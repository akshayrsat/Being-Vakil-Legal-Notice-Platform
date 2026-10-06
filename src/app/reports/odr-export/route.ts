import ExcelJS from "exceljs";
import { auditCurrentUser } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { agreedSettlementAmount } from "@/lib/odr-paper";
import { buildOdrExportRows, odrCaseWhere, odrFiltersApplied, readOdrFilters } from "@/lib/odr-reports";
import { resolveReportBank } from "@/lib/report-bank";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in first.\n", { status: 401 });
  const url = new URL(request.url);
  const filters = readOdrFilters(url.searchParams);
  if (!odrFiltersApplied(filters)) return new Response("Apply the filters first.\n", { status: 400 });
  const bank = await resolveReportBank(user, url.searchParams.get("bank") ?? "");
  if (!bank) return new Response("Choose a bank first.\n", { status: 400 });

  const cases = await prisma.odrCase.findMany({
    where: odrCaseWhere(bank.id, filters),
    include: {
      bank: { select: { name: true } },
      hearings: { select: { number: true, attendance: true, scheduledAt: true } },
      messages: { select: { channel: true, kind: true, status: true, detail: true, createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });
  const table = buildOdrExportRows(
    cases.map((item) => ({
      bankId: item.bankId,
      bankName: item.bank.name,
      refNo: item.refNo,
      customerName: item.customerName,
      accountNumber: item.accountNumber,
      matterType: item.matterType,
      neutralName: item.neutralName,
      status: item.status,
      exParte: item.exParte,
      settlementAmount: item.settlementAmount,
      settlementNote: item.settlementNote,
      agreedSettlement: agreedSettlementAmount(item.paperJson),
      awardAt: item.awardAt,
      hearings: item.hearings,
      messages: item.messages,
    })),
    bank.id,
  );
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("ODR");
  sheet.addRow(table.columns);
  for (const row of table.rows) sheet.addRow(row);
  const bytes = await workbook.xlsx.writeBuffer();
  await auditCurrentUser({
    action: "odr.export",
    summary: `Downloaded the ODR Excel for ${bank.name}.`,
    bankId: bank.id,
    bankName: bank.name,
  });
  return new Response(bytes, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="odr-cases.xlsx"',
    },
  });
}
