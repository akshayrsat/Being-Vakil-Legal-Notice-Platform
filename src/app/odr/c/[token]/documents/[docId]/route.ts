import { customerGrantMatches } from "@/app/actions/odr-public";
import { prisma } from "@/lib/db";
import { safeDownloadName } from "@/lib/odr-access";
import { customerCanSeeDocument } from "@/lib/odr-paper";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ token: string; docId: string }> }) {
  const { token, docId } = await context.params;
  if (!/^[A-Za-z0-9_-]{20,}$/.test(token)) return new Response("Not found", { status: 404 });
  const item = await prisma.odrCase.findFirst({ where: { publicToken: token }, select: { id: true, bankId: true } });
  if (!item || !(await customerGrantMatches(item.id))) return new Response("Not found", { status: 404 });
  const doc = await prisma.odrDocument.findFirst({ where: { id: docId, caseId: item.id, bankId: item.bankId } });
  if (!doc || !customerCanSeeDocument(doc.kind)) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(doc.content), {
    headers: {
      "Content-Type": doc.mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${safeDownloadName(doc.fileName)}"`,
    },
  });
}
