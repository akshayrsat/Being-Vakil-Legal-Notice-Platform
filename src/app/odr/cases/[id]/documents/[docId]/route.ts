import { getCurrentUser } from "@/lib/auth";
import { workingBank } from "@/lib/bank-context";
import { prisma } from "@/lib/db";
import { safePdfName } from "@/lib/odr-access";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string; docId: string }> }) {
  const user = await getCurrentUser();
  const bank = user ? workingBank(user) : null;
  if (!bank) return new Response("Sign in first.\n", { status: 401 });
  const { id, docId } = await context.params;
  const doc = await prisma.odrDocument.findFirst({ where: { id: docId, caseId: id, bankId: bank.id } });
  if (!doc) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(doc.content), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safePdfName(doc.fileName)}"`,
    },
  });
}
