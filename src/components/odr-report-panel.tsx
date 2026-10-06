import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { prisma } from "@/lib/db";
import { formatIndiaDateTime } from "@/lib/india-day";
import { agreedSettlementAmount, isPaperSigned } from "@/lib/odr-paper";
import { formatHearingDate, formatHearingTime } from "@/lib/odr-ref";
import { odrCaseWhere, odrFiltersApplied, odrFiltersToSearch, readOdrFilters, type OdrFilters } from "@/lib/odr-reports";
import { ODR_MATTERS, ODR_STATUSES, odrDocumentLabel, odrMatterLabel, odrStatusLabel } from "@/lib/odr-status";

export async function OdrReportPanel({
  bankId,
  bankName,
  params,
  downloadBase,
}: {
  bankId: string;
  bankName: string;
  params: URLSearchParams;
  downloadBase: "/reports" | "/deliveries";
}) {
  const filters = readOdrFilters(params);
  const files = await prisma.odrBatch.findMany({
    where: { bankId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const search = odrFiltersToSearch(filters, bankId);
  return (
    <>
      <form action={downloadBase} method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <input type="hidden" name="view" value="odr" />
        <input type="hidden" name="bank" value={bankId} />
        <input type="hidden" name="applied" value="1" />
        <label className="flex flex-col gap-1 text-sm font-medium">
          Search
          <input name="q" defaultValue={filters.q} className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          File
          <select name="file" defaultValue={filters.file} className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal">
            <option value="">All files</option>
            {files.map((file) => (
              <option key={file.id} value={file.id}>
                {file.fileName}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Type
          <select name="matter" defaultValue={filters.matter} className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal">
            <option value="">Arbitration and mediation</option>
            {ODR_MATTERS.map((matter) => (
              <option key={matter} value={matter}>
                {odrMatterLabel(matter)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Status
          <select name="status" defaultValue={filters.status} className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal">
            <option value="">All statuses</option>
            {ODR_STATUSES.map((status) => (
              <option key={status.id} value={status.id}>
                {status.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          From
          <input name="from" type="date" defaultValue={filters.from} className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          To
          <input name="to" type="date" defaultValue={filters.to} className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal" />
        </label>
        <div className="flex flex-wrap gap-2 lg:col-span-3">
          <button type="submit" className={buttonVariants({ className: "h-11 px-4" })}>
            Apply
          </button>
          {odrFiltersApplied(filters) ? (
            <a href={`/reports/odr-export?${search}`} className={buttonVariants({ variant: "outline", className: "h-11 px-4" })}>
              Download Excel
            </a>
          ) : (
            <p className="self-center text-sm text-muted-foreground">Press Apply before downloading.</p>
          )}
        </div>
      </form>
      {odrFiltersApplied(filters) ? <OdrRows bankId={bankId} bankName={bankName} filters={filters} returnTo={`${downloadBase}?${search}`} /> : (
        <p className="text-sm text-muted-foreground">Choose the file, type, status, or dates, then press Apply. The Excel is one row per person.</p>
      )}
    </>
  );
}

async function OdrRows({
  bankId,
  bankName,
  filters,
  returnTo,
}: {
  bankId: string;
  bankName: string;
  filters: OdrFilters;
  returnTo: string;
}) {
  const cases = await prisma.odrCase.findMany({
    where: odrCaseWhere(bankId, filters),
    include: {
      hearings: { orderBy: { number: "desc" }, take: 1 },
      documents: {
        where: { kind: { in: ["AWARD_SIGNED", "SETTLEMENT_SIGNED"] } },
        select: { id: true, kind: true },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  if (cases.length === 0) {
    return <EmptyState title={`Nothing to report for ${bankName}`}>No ODR cases matched these filters.</EmptyState>;
  }
  return (
    <div className="overflow-x-auto rounded-lg ring-1 ring-foreground/10">
      <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
        <thead className="bg-muted/70">
          <tr>
            <th className="px-3 py-2 font-medium">Ref</th>
            <th className="px-3 py-2 font-medium">Customer</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Hearing</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Settlement amount</th>
            <th className="px-3 py-2 font-medium">Award date</th>
            <th className="px-3 py-2 font-medium">Signed final</th>
          </tr>
        </thead>
        <tbody>
          {cases.map((item) => (
            <tr key={item.id} className="border-t border-border">
              <td className="px-3 py-2">
                <Link href={`/odr/cases/${item.id}?from=${encodeURIComponent(returnTo)}`} className="font-medium underline">
                  {item.refNo}
                </Link>
              </td>
              <td className="px-3 py-2">{item.customerName}</td>
              <td className="px-3 py-2">{odrMatterLabel(item.matterType)}</td>
              <td className="px-3 py-2">
                {item.hearings[0]
                  ? `${formatHearingDate(item.hearings[0].scheduledAt)} ${formatHearingTime(item.hearings[0].scheduledAt)}`
                  : "—"}
              </td>
              <td className="px-3 py-2">{odrStatusLabel(item.status)}</td>
              <td className="px-3 py-2">{agreedSettlementAmount(item.paperJson) || "—"}</td>
              <td className="px-3 py-2">{item.awardAt ? formatIndiaDateTime(item.awardAt) : "—"}</td>
              <td className="px-3 py-2">
                {item.documents.filter((doc) => isPaperSigned(doc.kind)).length ? (
                  item.documents.filter((doc) => isPaperSigned(doc.kind)).map((doc) => (
                    <a key={doc.id} href={`/odr/cases/${item.id}/documents/${doc.id}`} className="block underline">
                      {odrDocumentLabel(doc.kind)}
                    </a>
                  ))
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
