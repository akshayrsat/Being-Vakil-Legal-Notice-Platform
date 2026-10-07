import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { OdrConfirmForm } from "@/components/odr-case-forms";
import { OdrBackLink } from "@/components/odr-back-link";
import { DeskShell } from "@/components/desk-shell";
import { getCurrentUser } from "@/lib/auth";
import { workingBank } from "@/lib/bank-context";
import { prisma } from "@/lib/db";
import { flagOdrDuplicates, mapOdrRows, parseOdrMapping, suggestOdrMapping } from "@/lib/odr-fields";
import { arbitrationNoticeError, ARBITRATION_NOTICE_DOCS } from "@/lib/odr-notice-gate";
import { resolveLegalRoute } from "@/lib/odr-route";
import { odrKillSwitch, odrLiveWarning } from "@/lib/odr-live";
import { planOdrChannels } from "@/lib/odr-plan";
import { formatHearingDate, formatHearingTime } from "@/lib/odr-ref";
import { planBatchHearings } from "@/lib/odr-slot-store";
import { readOdrRules } from "@/lib/odr-store";
import { templateSlot, templatesFor } from "@/lib/odr-templates";
import { backToOdr } from "@/lib/odr-back";
import { canSendNotices } from "@/lib/roles";

export const metadata: Metadata = { title: "Review ODR" };

export default async function OdrPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canSendNotices(user.role)) redirect("/odr/cases");
  const bank = workingBank(user);
  if (!bank) redirect("/odr");
  const { id } = await params;
  const query = await searchParams;
  const batch = await prisma.odrBatch.findFirst({ where: { id, bankId: bank.id } });
  if (!batch) notFound();
  const headers = JSON.parse(batch.headers) as string[];
  const rows = JSON.parse(batch.rawRows) as string[][];
  const mappedRaw = mapOdrRows(headers, rows, suggestOdrMapping(headers, parseOdrMapping(batch.mappingUsed)));
  const [openCases, existingRefs] = await Promise.all([
    prisma.odrCase.findMany({
      where: { bankId: bank.id, status: { notIn: ["SETTLED", "AWARD_PASSED", "CLOSED"] } },
      select: { accountNumber: true },
    }),
    prisma.odrCase.findMany({ select: { refNo: true } }),
  ]);
  const mapped = flagOdrDuplicates(mappedRaw, {
    openAccounts: openCases.map((item) => item.accountNumber),
    refs: existingRefs.map((item) => item.refNo),
  });
  const rules = await readOdrRules();
  const legalRoute = resolveLegalRoute(batch.legalRoute, batch.matterType);
  const slot = templateSlot(batch.matterType, "first");
  const templates = templatesFor(rules.templates, batch.matterType, "first");
  const ready = mapped.filter((row) => row.problems.length === 0);
  const problems = mapped.filter((row) => row.problems.length > 0);
  const sample = ready[0];
  const plan = sample
    ? planOdrChannels({ live: rules.live, mobile: sample.mobile, email: sample.email, templates, slot })
    : [];
  const noticesHeld = legalRoute === "ARBITRATION" || legalRoute === "CONCILIATION";
  const channelLines = plan.map((row) =>
    noticesHeld && row.status === "QUEUED"
      ? { ...row, detail: "Held until the tribunal papers are on the case" }
      : row,
  );
  const sendNow = rules.live && !noticesHeld && channelLines.some((row) => row.status === "QUEUED");
  const pageSize = 50;
  const pageCount = Math.max(1, Math.ceil(mapped.length / pageSize));
  const page = Math.min(pageCount, Math.max(1, Number(query.page) || 1));
  const pageRows = mapped.slice((page - 1) * pageSize, page * pageSize);
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
          {odrLiveWarning({ storedOn: rules.liveStored, killed: odrKillSwitch() })}
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
      {noticesHeld ? (
        <p className="rounded-lg border border-border bg-card px-3 py-2 text-sm leading-6">
          {arbitrationNoticeError(ARBITRATION_NOTICE_DOCS.map((doc) => doc.label))} Hearing messages are recorded only after those files are on the case.
        </p>
      ) : null}
      <ul className="text-sm leading-6">
        {channelLines.map((row) => (
          <li key={row.channel}>
            {row.channel}: {row.status === "QUEUED" && !noticesHeld ? "Will be queued" : row.detail}
          </li>
        ))}
      </ul>
      {problems.length > 0 ? (
        <div className="overflow-x-auto rounded-lg ring-1 ring-foreground/10">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead className="bg-muted/70">
              <tr>
                <th className="px-3 py-2 font-medium">Left out</th>
                <th className="px-3 py-2 font-medium">Account</th>
                <th className="px-3 py-2 font-medium">Ref</th>
                <th className="px-3 py-2 font-medium">Why</th>
              </tr>
            </thead>
            <tbody>
              {problems.map((row) => (
                <tr key={`problem-${row.rowNumber}`} className="border-t border-border">
                  <td className="px-3 py-2">{row.customerName || "—"}</td>
                  <td className="px-3 py-2">{row.accountNumber || "—"}</td>
                  <td className="px-3 py-2">{row.refNo || "—"}</td>
                  <td className="px-3 py-2">{row.problems.join(" ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
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
            {pageRows.map((row) => (
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
        {ready.length} ready. {problems.length} will be left out.
        {pageCount > 1 ? ` Page ${page} of ${pageCount}.` : ""}
      </p>
      {pageCount > 1 ? (
        <p className="flex gap-3 text-sm">
          {page > 1 ? <a className="underline" href={`/odr/uploads/${batch.id}/preview?page=${page - 1}`}>Previous</a> : null}
          {page < pageCount ? <a className="underline" href={`/odr/uploads/${batch.id}/preview?page=${page + 1}`}>Next</a> : null}
        </p>
      ) : null}
      {seats?.ok ? <OdrConfirmForm batchId={batch.id} sendNow={sendNow} /> : null}
    </DeskShell>
  );
}
