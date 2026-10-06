import ExcelJS from "exceljs";
import { getCurrentUser } from "@/lib/auth";
import { workingBank } from "@/lib/bank-context";
import { prisma } from "@/lib/db";
import { lokAdalatCells, lokAdalatColumns, lokAdalatCsv, lokAdalatSummaryDocx } from "@/lib/odr-lok-adalat";
import { lokAdalatStatusLabel, resolveLegalRoute } from "@/lib/odr-route";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in first.\n", { status: 401 });
  const bank = workingBank(user);
  if (!bank) return new Response("Choose a bank first.\n", { status: 400 });
  const { id } = await context.params;
  const item = await prisma.odrCase.findFirst({
    where: { id, bankId: bank.id },
    include: { bank: { select: { name: true } } },
  });
  if (!item) return new Response("That case was not found.\n", { status: 404 });
  if (resolveLegalRoute(item.legalRoute, item.matterType) !== "LOK_ADALAT") {
    return new Response("This export is for a Lok Adalat referral.\n", { status: 400 });
  }
  const pack = {
    refNo: item.refNo,
    bank: item.bank.name,
    customer: item.customerName,
    coParties: item.coParties,
    accountNumber: item.accountNumber,
    claimAmount: item.claimAmount,
    branch: item.branch,
    mobile: item.mobile,
    email: item.email,
    address: item.address,
    status: lokAdalatStatusLabel(item.lokAdalatStatus),
    limitationDate: item.limitationDate,
  };
  const format = new URL(request.url).searchParams.get("format");
  if (format === "xlsx") {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet("Lok Adalat");
    sheet.addRow(lokAdalatColumns());
    sheet.addRow(lokAdalatCells(pack));
    const buffer = await book.xlsx.writeBuffer();
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${item.refNo}-lok-adalat.xlsx"`,
      },
    });
  }
  if (format === "docx") {
    const bytes = await lokAdalatSummaryDocx(pack);
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${item.refNo}-lok-adalat.docx"`,
      },
    });
  }
  return new Response(lokAdalatCsv(pack), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${item.refNo}-lok-adalat.csv"`,
    },
  });
}
