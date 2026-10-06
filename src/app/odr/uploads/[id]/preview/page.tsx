import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { OdrConfirmForm } from "@/components/odr-case-forms";
import { OdrBackLink } from "@/components/odr-back-link";
import { DeskShell } from "@/components/desk-shell";
import { getCurrentUser } from "@/lib/auth";
import { workingBank } from "@/lib/bank-context";
import { prisma } from "@/lib/db";
import { mapOdrRows, parseOdrMapping, suggestOdrMapping } from "@/lib/odr-fields";
import { odrEnvLive, odrLiveWarning } from "@/lib/odr-live";
import { planOdrChannels } from "@/lib/odr-plan";
import { formatHearingDate, formatHearingTime } from "@/lib/odr-ref";
import { planBatchHearings } from "@/lib/odr-slot-store";
import { readOdrRules } from "@/lib/odr-store";
import { templatesFor } from "@/lib/odr-templates";
import { backToOdr } from "@/lib/odr-back";
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
  const ready = mapped.filter((row) => row.problems.length === 0);
  const sample = ready[0];
  const plan = sample
    ? planOdrChannels({ live: rules.live, mobile: sample.mobile, email: sample.email, templates })
    : [];
  const seats = ready.length
    ? await planBatchHearings(batch, ready.map((row) => ({ key: String(row.rowNumber), label: row.customerName })))
    : null;

  return (
    <DeskShell user={user}>
      <OdrBackLink target={backToOdr()} />
      <div>
        <h1 className="font-serif text-4xl tracking-tight">Review who will get it</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
          {batch.durationMinutes} minutes each. {batch.neutralName}.{" "}
          {seats?.ok ? seats.summary : "Hearing times will appear once every row can be placed."}{" "}
          {odrLiveWarning({ storedOn: rules.liveStored, envOn: odrEnvLive() })}
        </p>
      </div>
      {seats && !seats.ok ? (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {seats.error}
        </p>
      ) : null}
      {seats?.ok ? (
        <div className="max-h-[32rem] overflow-auto rounded-lg ring-1 ring-foreground/10">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead className="sticky top-0 bg-muted/70">
              <tr>
                <th className="px-3 py-2 font-medium">Customer</th>
                <th className="px-3 py-2 font-medium">Arbitrator</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {ready.map((row) => {
                const seat = seats.seatFor(String(row.rowNumber));
                return (
                  <tr key={row.rowNumber} className="border-t border-border">
                    <td className="px-3 py-2">{row.customerName}</td>
                    <td className="px-3 py-2">{seat.name}</td>
                    <td className="px-3 py-2">{formatHearingDate(seat.start)}</td>
                    <td className="px-3 py-2">{formatHearingTime(seat.start)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
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
      {seats?.ok ? <OdrConfirmForm batchId={batch.id} live={rules.live} /> : null}
    </DeskShell>
  );
}
