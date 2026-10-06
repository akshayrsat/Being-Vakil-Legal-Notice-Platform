import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { OdrColumnMapper } from "@/components/odr-column-mapper";
import { OdrBackLink } from "@/components/odr-back-link";
import { DeskShell } from "@/components/desk-shell";
import { getCurrentUser } from "@/lib/auth";
import { workingBank } from "@/lib/bank-context";
import { prisma } from "@/lib/db";
import { parseOdrMapping, suggestOdrMapping } from "@/lib/odr-fields";
import { backToOdr } from "@/lib/odr-back";
import { canSendNotices } from "@/lib/roles";

export const metadata: Metadata = { title: "Match ODR columns" };

export default async function OdrMappingPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canSendNotices(user.role)) redirect("/odr/cases");
  const bank = workingBank(user);
  if (!bank) redirect("/odr");
  const { id } = await params;
  const batch = await prisma.odrBatch.findFirst({ where: { id, bankId: bank.id } });
  if (!batch) notFound();
  const headers = JSON.parse(batch.headers) as string[];
  const initial = suggestOdrMapping(headers, parseOdrMapping(batch.mappingUsed));
  return (
    <DeskShell user={user}>
      <OdrBackLink target={backToOdr()} />
      <div>
        <h1 className="font-serif text-4xl tracking-tight">Match the columns</h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          {batch.fileName} for {bank.name}. {batch.matterType === "MEDIATION" ? "Mediation" : "Arbitration"} with {batch.neutralName}.
        </p>
      </div>
      <OdrColumnMapper batchId={batch.id} headers={headers} initial={initial} />
    </DeskShell>
  );
}
