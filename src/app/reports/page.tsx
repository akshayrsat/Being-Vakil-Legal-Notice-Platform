import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DeskShell } from "@/components/desk-shell";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { workingBank } from "@/lib/bank-context";
import { SEND_CHANNELS } from "@/lib/campaign-plan";
import { sendChannelLabel } from "@/lib/campaigns";
import { prisma } from "@/lib/db";
import { loadDeskReport, readReportFilters, reportFiltersToSearch } from "@/lib/desk-reports";
import { resolveReportBank } from "@/lib/report-bank";
import { ROLE_ADMIN } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Reports",
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") params.set(key, value);
  }
  const filters = readReportFilters(params);
  const isAdmin = user.role === ROLE_ADMIN;
  const bank = await resolveReportBank(user, params.get("bank") ?? workingBank(user)?.id ?? "");
  const banks = isAdmin
    ? await prisma.bank.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
    : [];

  return (
    <DeskShell user={user}>
      <div>
        <h1 className="font-serif text-4xl tracking-tight">Reports</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
          Failure rates, opens, notice links, and Speed Post returns. A dry run is counted apart from a live failure.
          Delivery CSV is one row for each person and channel, for this bank only.
        </p>
      </div>

      {!bank ? (
        <EmptyState title="No bank selected">
          {isAdmin ? "Open Banks and press Use this bank." : "This login is not linked to a bank."}
        </EmptyState>
      ) : (
        <>
          <form action="/reports" method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {isAdmin ? (
              <label className="flex flex-col gap-1 text-sm font-medium">
                Bank
                <select name="bank" defaultValue={bank.id} className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal">
                  {banks.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <input type="hidden" name="bank" value={bank.id} />
            )}
            <label className="flex flex-col gap-1 text-sm font-medium">
              Channel
              <select name="channel" defaultValue={filters.channel} className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal">
                <option value="">All channels</option>
                {SEND_CHANNELS.map((channel) => (
                  <option key={channel} value={channel}>
                    {sendChannelLabel(channel)}
                  </option>
                ))}
                <option value="SPEED_POST">Speed Post</option>
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
            <div className="flex flex-wrap gap-2 lg:col-span-4">
              <button type="submit" className={buttonVariants({ className: "h-11 px-4" })}>
                Apply
              </button>
              <Link
                href={`/reports/export?${reportFiltersToSearch(filters, bank.id)}`}
                className={buttonVariants({ variant: "outline", className: "h-11 px-4" })}
              >
                Download summary CSV
              </Link>
              <Link
                href={`/reports/delivery-export?${reportFiltersToSearch(filters, bank.id)}`}
                className={buttonVariants({ variant: "outline", className: "h-11 px-4" })}
              >
                Download delivery CSV
              </Link>
              <Link
                href={`/deliveries/export?${reportFiltersToSearch(filters, bank.id)}`}
                className={buttonVariants({ variant: "outline", className: "h-11 px-4" })}
              >
                Download row CSV
              </Link>
            </div>
          </form>
          <ReportBody bankId={bank.id} bankName={bank.name} filters={filters} />
        </>
      )}
    </DeskShell>
  );
}

async function ReportBody({
  bankId,
  bankName,
  filters,
}: {
  bankId: string;
  bankName: string;
  filters: ReturnType<typeof readReportFilters>;
}) {
  const report = await loadDeskReport(bankId, filters);
  const empty =
    report.channels.every((row) => row.attempted + row.skipped + row.dryRun === 0) &&
    report.linkOpened + report.linkNotOpened === 0 &&
    report.speedPostTotal === 0;
  if (empty) {
    return (
      <EmptyState title={`Nothing to report for ${bankName}`}>
        Confirm a send, or widen the dates. Dry runs appear in the dry-run column and are not treated as failures.
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {report.channels.length > 0 ? (
        <section className="overflow-x-auto rounded-lg ring-1 ring-foreground/10">
          <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
            <thead className="bg-muted/70">
              <tr>
                <th className="px-3 py-2 font-medium">Channel</th>
                <th className="px-3 py-2 font-medium">Attempted</th>
                <th className="px-3 py-2 font-medium">Failed or bounced</th>
                <th className="px-3 py-2 font-medium">Failure rate</th>
                <th className="px-3 py-2 font-medium">Opened</th>
                <th className="px-3 py-2 font-medium">Not opened</th>
                <th className="px-3 py-2 font-medium">Dry run</th>
              </tr>
            </thead>
            <tbody>
              {report.channels.map((row) => (
                <tr key={row.channel} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{row.label}</td>
                  <td className="px-3 py-2">{row.attempted}</td>
                  <td className="px-3 py-2">{row.failed}</td>
                  <td className="px-3 py-2">{row.failureRate}</td>
                  <td className="px-3 py-2">{row.channel === "SMS" ? "—" : row.opened}</td>
                  <td className="px-3 py-2">{row.channel === "SMS" ? "—" : row.unopened}</td>
                  <td className="px-3 py-2">{row.dryRun}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {filters.channel !== "SPEED_POST" ? (
        <section className="grid gap-3 sm:grid-cols-2">
          <article className="rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10">
            <p className="text-sm text-muted-foreground">Notice link opened</p>
            <p className="mt-1 font-serif text-3xl">{report.linkOpened}</p>
          </article>
          <article className="rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10">
            <p className="text-sm text-muted-foreground">Notice link not opened</p>
            <p className="mt-1 font-serif text-3xl">{report.linkNotOpened}</p>
          </article>
        </section>
      ) : null}

      {report.speedPost.length > 0 ? (
        <section>
          <h2 className="font-serif text-2xl">Speed Post</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {report.speedPost.map((row) => (
              <li key={row.status} className="rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10">
                <p className="text-sm text-muted-foreground">{row.label}</p>
                <p className="mt-1 font-serif text-3xl">{row.count}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">
            Returned is the count to watch against a courier desk. Dates use the last status update.
          </p>
        </section>
      ) : null}
    </div>
  );
}
