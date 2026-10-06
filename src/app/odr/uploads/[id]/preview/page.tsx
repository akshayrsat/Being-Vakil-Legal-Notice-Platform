import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { OdrConfirmForm } from "@/components/odr-case-forms";
import { DeskShell } from "@/components/desk-shell";
import { getCurrentUser } from "@/lib/auth";
import { workingBank } from "@/lib/bank-context";
import { prisma } from "@/lib/db";
import { mapOdrRows, parseOdrMapping, suggestOdrMapping } from "@/lib/odr-fields";
import { odrEnvLive, odrLiveWarning } from "@/lib/odr-live";
import { planOdrChannels } from "@/lib/odr-plan";
import { formatHearingDate, formatHearingTime } from "@/lib/odr-ref";
import { readOdrRules } from "@/lib/odr-store";
import { templatesFor } from "@/lib/odr-templates";
import { canSendNotices } from "@/lib/roles";

export const metadata: Metadata = { title: "Review ODR" };

export default async function OdrPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canSendNotices(user.role)) redirect("/odr/cases");
  const bank = workingBank(user);
  if (!bank) redirect("/odr");
  const { id } = await params;
  const batch = await prisma.odrBatch.findFirst({ where: { id, bankId: bank.id } });
  if (!batch) notFound();
  const headers = JSON.parse(batch.headers) as string[];
  const rows = JSON.parse(batch.rawRows) as string[][];
  const mapped = mapOdrRows(headers, rows, suggestOdrMapping(headers, parseOdrMapping(batch.mappingUsed)));
  const rules = await readOdrRules();
  const templates = templatesFor(rules.templates, batch.matterType, "first");
  const sample = mapped.find((row) => row.problems.length === 0);
  const plan = sample
    ? planOdrChannels({ live: rules.live, mobile: sample.mobile, email: sample.email, templates })
    : [];

  return (
    <DeskShell user={user}>
      <div>
        <h1 className="font-serif text-4xl tracking-tight">Review who will get it</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
          {formatHearingDate(batch.hearingAt)} at {formatHearingTime(batch.hearingAt)}, {batch.durationMinutes} minutes, {batch.neutralName}.{" "}
          {odrLiveWarning({ storedOn: rules.liveStored, envOn: odrEnvLive() })}
        </p>
      </div>
      <ul className="text-sm leading-6">
        {plan.map((row) => (
          <li key={row.channel}>
            {row.channel}: {row.status === "QUEUED" ? "Will be queued" : row.detail}
          </li>
        ))}
      </ul>
      <div className="overflow-x-auto rounded-lg ring-1 ring-foreground/10">
        <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
          <thead className="bg-muted/70">
            <tr>
              <th className="px-3 py-2 font-medium">Customer</th>
              <th className="px-3 py-2 font-medium">Account</th>
              <th className="px-3 py-2 font-medium">Ref</th>
              <th className="px-3 py-2 font-medium">Check</th>
            </tr>
          </thead>
          <tbody>
            {mapped.slice(0, 50).map((row) => (
              <tr key={row.rowNumber} className="border-t border-border">
                <td className="px-3 py-2">{row.customerName || "—"}</td>
                <td className="px-3 py-2">{row.accountNumber || "—"}</td>
                <td className="px-3 py-2">{row.refNo || "Will be generated"}</td>
                <td className="px-3 py-2">{row.problems.join(" ") || "Ready"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted-foreground">
        {mapped.filter((row) => row.problems.length === 0).length} ready. {mapped.filter((row) => row.problems.length > 0).length} will be left out.
        {mapped.length > 50 ? " The first 50 rows are shown." : ""}
      </p>
      <OdrConfirmForm batchId={batch.id} live={rules.live} />
    </DeskShell>
  );
}
