import { getCurrentUser } from "@/lib/auth";
import { workingBank } from "@/lib/bank-context";
import { prisma } from "@/lib/db";
import { safeDownloadName } from "@/lib/odr-access";
import { canReadOdrDocument } from "@/lib/odr-paper";
import { canSendNotices } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string; docId: string }> }) {
  const user = await getCurrentUser();
  const bank = user ? workingBank(user) : null;
  if (!user || !bank) return new Response("Sign in first.\n", { status: 401 });
  const { id, docId } = await context.params;
  const doc = await prisma.odrDocument.findFirst({ where: { id: docId, caseId: id, bankId: bank.id } });
  if (!doc || !canReadOdrDocument({ documentBankId: doc.bankId, viewerBankId: bank.id, kind: doc.kind, canGenerate: canSendNotices(user.role) })) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(Buffer.from(doc.content), {
    headers: {
      "Content-Type": doc.mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${safeDownloadName(doc.fileName)}"`,
    },
  });
}
