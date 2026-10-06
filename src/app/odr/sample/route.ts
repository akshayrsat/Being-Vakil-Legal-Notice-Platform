import ExcelJS from "exceljs";
import { getCurrentUser } from "@/lib/auth";
import { ODR_SAMPLE_HEADERS } from "@/lib/odr-fields";
import { canSendNotices } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !canSendNotices(user.role)) return new Response("Sign in as staff first.\n", { status: 401 });
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("ODR");
  sheet.addRow([...ODR_SAMPLE_HEADERS]);
  sheet.addRow([
    "",
    "Ravi Shah",
    "Anita Shah",
    "1234567781",
    "Pune",
    "9876543210",
    "ravi@example.com",
    "12 Sample Road, Pune",
    "100000",
    "25000",
    "1 Oct 2026",
    "EMIs unpaid. Arbitration sought for the outstanding claim.",
  ]);
  const bytes = await workbook.xlsx.writeBuffer();
  return new Response(bytes, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="odr-sample.xlsx"',
    },
  });
}
