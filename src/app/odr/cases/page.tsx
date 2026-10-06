import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { OdrBackLink } from "@/components/odr-back-link";
import { DeskShell } from "@/components/desk-shell";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { workingBank } from "@/lib/bank-context";
import { redactCell } from "@/lib/data-min";
import { prisma } from "@/lib/db";
import { formatHearingDate, formatHearingTime } from "@/lib/odr-ref";
import { odrCaseWhere, odrFiltersApplied, odrFiltersToSearch, readOdrFilters } from "@/lib/odr-reports";
import { ODR_MATTERS, ODR_STATUSES, odrMatterLabel, odrStatusLabel } from "@/lib/odr-status";
import { odrListBack } from "@/lib/odr-back";
import { canSendNotices, isBankUser } from "@/lib/roles";

export const metadata: Metadata = { title: "ODR cases" };

export default async function OdrCasesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const bank = workingBank(user);
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") params.set(key, value);
  }
  const filters = readOdrFilters(params);
  const canSend = canSendNotices(user.role);
  const files = bank
    ? await prisma.odrBatch.findMany({ where: { bankId: bank.id }, orderBy: { createdAt: "desc" }, take: 100 })
    : [];

  return (
    <DeskShell user={user}>
      <OdrBackLink target={odrListBack(isBankUser(user.role))} />
      <div>
        <h1 className="font-serif text-4xl tracking-tight">ODR cases</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
          {bank
            ? canSend
              ? `Cases for ${bank.name}. You can open a case, schedule a hearing, and update the status.`
              : `Cases for ${bank.name}. You can look. You cannot change a case or see another bank.`
            : "Choose a bank first."}
        </p>
      </div>
      {!bank ? (
        <EmptyState title="No bank selected">Open Banks and press Use this bank.</EmptyState>
      ) : (
        <>
          <form action="/odr/cases" method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                <option value="">All types</option>
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
              <input type="hidden" name="applied" value="1" />
              <button type="submit" className={buttonVariants({ className: "h-11 px-4" })}>
                Apply
              </button>
              {odrFiltersApplied(filters) ? (
                <a href={`/reports/odr-export?${odrFiltersToSearch(filters, bank.id)}`} className={buttonVariants({ variant: "outline", className: "h-11 px-4" })}>
                  Download Excel
                </a>
              ) : null}
            </div>
          </form>
          <CaseTable bankId={bank.id} filters={{ ...filters, applied: true }} showCustomerPage={canSend} />
        </>
      )}
    </DeskShell>
  );
}

async function CaseTable({
  bankId,
  filters,
  showCustomerPage,
}: {
  bankId: string;
  filters: ReturnType<typeof readOdrFilters>;
  showCustomerPage: boolean;
}) {
  if (!filters.applied && !filters.q) {
    const count = await prisma.odrCase.count({ where: { bankId } });
    return <p className="text-sm text-muted-foreground">{count} cases on this bank. Press Apply to list them.</p>;
  }
  const cases = await prisma.odrCase.findMany({
    where: odrCaseWhere(bankId, filters),
    include: { hearings: { orderBy: { number: "desc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  if (cases.length === 0) return <EmptyState title="No cases matched">Try another name, reference, or status.</EmptyState>;
  return (
    <div className="overflow-x-auto rounded-lg ring-1 ring-foreground/10">
      <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
        <thead className="bg-muted/70">
          <tr>
            <th className="px-3 py-2 font-medium">Ref</th>
            <th className="px-3 py-2 font-medium">Customer</th>
            <th className="px-3 py-2 font-medium">Account</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Arbitrator</th>
            <th className="px-3 py-2 font-medium">Hearing</th>
            {showCustomerPage ? <th className="px-3 py-2 font-medium">Customer page</th> : null}
            <th className="px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {cases.map((item) => {
            const hearing = item.hearings[0];
            return (
              <tr key={item.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <Link href={`/odr/cases/${item.id}`} className="font-medium underline">
                    {item.refNo}
                  </Link>
                </td>
                <td className="px-3 py-2">{item.customerName}</td>
                <td className="px-3 py-2">{redactCell(item.accountNumber)}</td>
                <td className="px-3 py-2">{odrMatterLabel(item.matterType)}</td>
                <td className="px-3 py-2">{item.neutralName || "—"}</td>
                <td className="px-3 py-2">
                  {hearing ? `${hearing.number} · ${formatHearingDate(hearing.scheduledAt)} ${formatHearingTime(hearing.scheduledAt)}` : "—"}
                </td>
                {showCustomerPage ? (
                  <td className="px-3 py-2">
                    <a href={`/odr/c/${item.publicToken}`} target="_blank" rel="noopener noreferrer" className="underline">
                      Open
                    </a>
                  </td>
                ) : null}
                <td className="px-3 py-2">
                  {odrStatusLabel(item.status)}
                  {item.matterType !== "MEDIATION" && (item.exParte || item.flaggedExParte) ? " · Ex parte" : ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
