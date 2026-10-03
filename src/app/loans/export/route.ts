// Excel for the person on the loan page. The file is built when this address is opened.
// The loan page only links here. It does not request the file while the page is rendering.

import { auditCurrentUser } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { loadPersonNoticeRows, personExcelFilename, personNoticeWorkbook } from "@/lib/person-excel";
import { resolveReportBank } from "@/lib/report-bank";
import { isBankUser } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in first.\n", { status: 401 });
  if (isBankUser(user.role)) {
    return new Response("This login cannot download a loan file.\n", { status: 403 });
  }

  const url = new URL(request.url);
  const bank = await resolveReportBank(user, url.searchParams.get("bank") ?? "");
  if (!bank) return new Response("Choose a bank first.\n", { status: 400 });

  const loan = (url.searchParams.get("loan") ?? "").trim();
  const account = (url.searchParams.get("account") ?? "").trim();
  if (!loan && !account) return new Response("Search a loan or account first.\n", { status: 400 });

  const rows = await loadPersonNoticeRows({ bankId: bank.id, loan, account });
  const bytes = await personNoticeWorkbook(rows);
  const who = loan ? `loan ${loan}` : `account ${account}`;
  await auditCurrentUser({
    action: "export",
    summary: `Downloaded an Excel file for ${who} at ${bank.name}.`,
    bankId: bank.id,
    bankName: bank.name,
    targetId: (loan || account).slice(0, 80),
  });

  const filename = personExcelFilename(loan || account);
  return new Response(bytes, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
