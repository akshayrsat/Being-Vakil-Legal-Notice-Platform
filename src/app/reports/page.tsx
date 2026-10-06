import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DeskShell } from "@/components/desk-shell";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { workingBank } from "@/lib/bank-context";
import { SEND_CHANNELS } from "@/lib/campaign-plan";
import { sendChannelLabel } from "@/lib/campaigns";
import {
  channelShowsOpens,
  listReportFiles,
  loadDeskReport,
  loadReportNotices,
  readReportFilters,
  reportFileLabel,
  reportFiltersApplied,
  reportFiltersToSearch,
  type ChannelReport,
} from "@/lib/desk-reports";
import { resolveReportBank } from "@/lib/report-bank";
import { isOwnerAdmin } from "@/lib/owner-admin";
import { canChooseBank, isBankUser } from "@/lib/roles";
import { RecordSwitch } from "@/components/record-switch";
import { OdrReportPanel } from "@/components/odr-report-panel";

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
  const requested = readReportFilters(params);
  const isAdmin = canChooseBank(user.role);
  const technical = isOwnerAdmin(user);
  const bankUser = isBankUser(user.role);
  const bank = await resolveReportBank(user, params.get("bank") ?? workingBank(user)?.id ?? "");
  const files = bank ? await listReportFiles(bank.id) : [];
  const fileNames = new Map<string, number>();
  for (const file of files) fileNames.set(file.fileName, (fileNames.get(file.fileName) ?? 0) + 1);
  const filters = {
    ...requested,
    file: files.some((file) => file.id === requested.file) ? requested.file : "",
  };
  const view = params.get("view") === "odr" ? "odr" : "notices";

  return (
    <DeskShell user={user}>
      <div>
        <h1 className="font-serif text-4xl tracking-tight">Reports</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
          {view === "odr"
            ? `ODR cases for ${bank?.name ?? "this bank"}. The Excel is one row per person, and it downloads only after Apply.`
            : technical
              ? "Failure rates and delivery. Email and WhatsApp also show opened and not opened. A dry run is counted apart from a live failure. The delivery Excel is one row for each person, for this bank only."
              : "Delivery status for notices already sent, for this bank only. You can download the report."}
        </p>
        <div className="mt-4">
          <RecordSwitch base="/reports" view={view} />
        </div>
      </div>

      {!bank ? (
        <EmptyState title="No bank selected">
          {isAdmin ? "Open Banks and press Use this bank." : "This login is not linked to a bank."}
        </EmptyState>
      ) : view === "odr" ? (
        <OdrReportPanel bankId={bank.id} bankName={bank.name} params={params} downloadBase="/reports" />
      ) : (
        <>
          <form action="/reports" method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input type="hidden" name="bank" value={bank.id} />
            <label className="flex flex-col gap-1 text-sm font-medium">
              File
              <select name="file" defaultValue={filters.file} className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal">
                <option value="">All files</option>
                {files.map((file) => (
                  <option key={file.id} value={file.id}>
                    {reportFileLabel(file.fileName, file.createdAt, (fileNames.get(file.fileName) ?? 0) > 1)}
                  </option>
                ))}
              </select>
            </label>
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
              {reportFiltersApplied(filters) ? (
                <ReportDownloads search={reportFiltersToSearch(filters, bank.id)} />
              ) : null}
            </div>
          </form>
          <ReportBody
            bankId={bank.id}
            bankName={bank.name}
            filters={filters}
            technical={technical}
            sentOnly={bankUser}
          />
        </>
      )}
    </DeskShell>
  );
}

function ReportDownloads({ search }: { search: string }) {
  const links = [
    { href: `/reports/export?${search}`, label: "Download summary CSV" },
    { href: `/reports/delivery-export?${search}`, label: "Download delivery Excel" },
    { href: `/deliveries/export?${search}`, label: "Download row CSV" },
  ];
  return (
    <>
      {links.map((link) => (
        <a
          key={link.label}
          href={link.href}
          className={buttonVariants({ variant: "outline", className: "h-11 px-4" })}
        >
          {link.label}
        </a>
      ))}
    </>
  );
}

function ChannelTable({
  rows,
  showOpens,
  dryRunLabel,
}: {
  rows: ChannelReport[];
  showOpens: boolean;
  dryRunLabel: string;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="overflow-x-auto rounded-lg ring-1 ring-foreground/10">
      <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
        <thead className="bg-muted/70">
          <tr>
            <th className="px-3 py-2 font-medium">Channel</th>
            <th className="px-3 py-2 font-medium">Attempted</th>
            <th className="px-3 py-2 font-medium">Failed or bounced</th>
            <th className="px-3 py-2 font-medium">Failure rate</th>
            <th className="px-3 py-2 font-medium">Delivered</th>
            {showOpens ? <th className="px-3 py-2 font-medium">Opened</th> : null}
            {showOpens ? <th className="px-3 py-2 font-medium">Not opened</th> : null}
            <th className="px-3 py-2 font-medium">{dryRunLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.channel} className="border-t border-border">
              <td className="px-3 py-2 font-medium">{row.label}</td>
              <td className="px-3 py-2">{row.attempted}</td>
              <td className="px-3 py-2">{row.failed}</td>
              <td className="px-3 py-2">{row.failureRate}</td>
              <td className="px-3 py-2">{row.delivered}</td>
              {showOpens ? <td className="px-3 py-2">{row.opened}</td> : null}
              {showOpens ? <td className="px-3 py-2">{row.unopened}</td> : null}
              <td className="px-3 py-2">{row.dryRun}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

async function ReportBody({
  bankId,
  bankName,
  filters,
  technical,
  sentOnly,
}: {
  bankId: string;
  bankName: string;
  filters: ReturnType<typeof readReportFilters>;
  technical: boolean;
  sentOnly: boolean;
}) {
  const report = await loadDeskReport(bankId, filters, { sentOnly });
  const notices = filters.file ? await loadReportNotices(bankId, filters, { sentOnly, technical }) : [];
  const empty = notices.length === 0 &&
    report.channels.every((row) => row.attempted + row.skipped + row.dryRun === 0) &&
    report.linkOpened + report.linkNotOpened === 0 &&
    report.speedPostTotal === 0;
  if (empty) {
    return (
      <EmptyState title={`Nothing to report for ${bankName}`}>
        {technical
          ? "Confirm a send, or widen the dates. Dry runs appear in the dry-run column and are not treated as failures."
          : "Widen the dates, or ask the firm to confirm a notice for this bank."}
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {filters.file ? (
        <section className="overflow-x-auto rounded-lg ring-1 ring-foreground/10">
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <thead className="bg-muted/70">
              <tr>
                <th className="px-3 py-2 font-medium">Person</th>
                <th className="px-3 py-2 font-medium">Notice</th>
                <th className="px-3 py-2 font-medium">Channel</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {notices.map((row, index) => (
                <tr key={`${row.notice}-${row.channel}-${index}`} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{row.person || "—"}</td>
                  <td className="px-3 py-2">{row.notice || "—"}</td>
                  <td className="px-3 py-2">{row.channel}</td>
                  <td className="px-3 py-2">{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
      <ChannelTable
        rows={report.channels.filter((row) => !channelShowsOpens(row.channel))}
        showOpens={false}
        dryRunLabel={technical ? "Dry run" : "Not sent"}
      />
      <ChannelTable
        rows={report.channels.filter((row) => channelShowsOpens(row.channel))}
        showOpens
        dryRunLabel={technical ? "Dry run" : "Not sent"}
      />

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
