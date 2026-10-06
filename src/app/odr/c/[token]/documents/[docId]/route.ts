import { customerGrantMatches } from "@/app/actions/odr-public";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { safeDownloadName } from "@/lib/odr-access";
import { customerCanSeeDocument } from "@/lib/odr-paper";
import { resolvePublicCase } from "@/lib/odr-public-case";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ token: string; docId: string }> }) {
  const { token, docId } = await context.params;
  const found = await resolvePublicCase(token);
  const item = found ? { id: found.item.id, bankId: found.item.bankId } : null;
  const staff = await getCurrentUser();
  if (!item || (!staff && !(await customerGrantMatches(item.id)))) return new Response("Not found", { status: 404 });
  const doc = await prisma.odrDocument.findFirst({ where: { id: docId, caseId: item.id, bankId: item.bankId } });
  if (!doc || !customerCanSeeDocument(doc.kind)) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(doc.content), {
    headers: {
      "Content-Type": doc.mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${safeDownloadName(doc.fileName)}"`,
    },
  });
}
