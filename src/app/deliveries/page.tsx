// Find people across sends for one bank. A Bank Viewer cannot leave their bank.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { DeliveryFiltersForm } from "@/components/delivery-filters";
import { MessageOpened, NoticeLinkOpened } from "@/components/notice-link-opened";
import { NoticeOpenLink } from "@/components/notice-open-link";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { workingBank } from "@/lib/bank-context";
import { deliveryStatusLabel, sendChannelLabel } from "@/lib/campaigns";
import { prisma } from "@/lib/db";
import {
  deliveryWhere,
  filtersToSearch,
  personHistoryHref,
  readDeliveryFilters,
} from "@/lib/delivery-report";
import { loanSearchHref } from "@/lib/loan-timeline";
import { noticeLinkOpensByNumber } from "@/lib/public-notice";
import { resolveReportBank } from "@/lib/report-bank";
import { ROLE_ADMIN } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Find a person",
};

const PAGE_LIMIT = 100;

export default async function DeliveriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = new URLSearchParams();
  const raw = await searchParams;
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") params.set(key, value);
  }
  const filters = readDeliveryFilters(params);
  const isAdmin = user.role === ROLE_ADMIN;
  const bank = await resolveReportBank(user, params.get("bank") ?? "");
  const banks = isAdmin
    ? await prisma.bank.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
    : [];

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader user={user} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">Find a person</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            {bank
              ? `Search sends for ${bank.name}. A dry run stays marked Dry run. It is not called delivered.`
              : "Choose a bank before searching."}
          </p>
        </div>

        {!bank ? (
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "Open Banks and press Use this bank, or pick a bank below once one exists." : "This login is not linked to a bank."}
          </p>
        ) : (
          <>
            {isAdmin && workingBank(user)?.id !== bank.id ? (
              <p className="text-sm text-muted-foreground">
                You are working on {workingBank(user)?.name ?? "no bank"}. This search is showing {bank.name}.
              </p>
            ) : null}
            <DeliveryFiltersForm
              action="/deliveries"
              filters={filters}
              bankId={bank.id}
              banks={banks}
              campaigns={await campaignOptions(bank.id)}
              showBank={isAdmin}
            />
            <Results bankId={bank.id} filters={filters} />
          </>
        )}
      </main>
    </div>
  );
}

async function campaignOptions(bankId: string) {
  const campaigns = await prisma.campaign.findMany({
    where: { bankId },
    orderBy: { createdAt: "desc" },
    select: { id: true, templateName: true, createdAt: true },
  });
  return campaigns.map((campaign) => ({
    id: campaign.id,
    name: `${campaign.templateName} · ${formatWhen(campaign.createdAt)}`,
  }));
}

async function Results({
  bankId,
  filters,
}: {
  bankId: string;
  filters: ReturnType<typeof readDeliveryFilters>;
}) {
  const rows = await prisma.campaignDelivery.findMany({
    where: deliveryWhere(bankId, filters),
    include: {
      campaign: { select: { id: true, templateName: true, createdAt: true } },
    },
    orderBy: [{ campaign: { createdAt: "desc" } }, { rowNumber: "asc" }],
    take: PAGE_LIMIT,
  });
  const linkOpens = await noticeLinkOpensByNumber(rows.map((row) => row.noticeNumber));
  const exportHref = `/deliveries/export?${filtersToSearch(filters, bankId)}`;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-2xl">
          {rows.length === PAGE_LIMIT ? `First ${PAGE_LIMIT} rows` : `${rows.length} ${rows.length === 1 ? "row" : "rows"}`}
        </h2>
        <Link
          href={exportHref}
          className={buttonVariants({ variant: "outline", className: "h-11 px-4" })}
        >
          Download CSV
        </Link>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No rows matched">
          Try a loan number from a dry run, such as LN10021, or clear the filters.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg ring-1 ring-foreground/10">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead className="bg-muted/70">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Loan</th>
                <th className="px-3 py-2 font-medium">Channel</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Campaign</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const history = personHistoryHref(row, bankId);
                const loanHref = loanSearchHref(bankId, row.loanNumber, row.customerId);
                return (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <p className="font-medium">{row.customerName}</p>
                      <p className="text-muted-foreground">{row.mobile || row.email || "—"}</p>
                      <NoticeOpenLink noticeNumber={row.noticeNumber} />
                    </td>
                    <td className="px-3 py-2">
                      <p>{row.loanNumber || "—"}</p>
                      <p className="text-muted-foreground">{row.customerId}</p>
                    </td>
                    <td className="px-3 py-2">{sendChannelLabel(row.channel)}</td>
                    <td className="px-3 py-2">
                      <p>{deliveryStatusLabel(row.status)}</p>
                      <p className="text-muted-foreground">{row.detail}</p>
                      <MessageOpened openedAt={row.openedAt} />
                      <NoticeLinkOpened open={linkOpens.get(row.noticeNumber)} />
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/campaigns/${row.campaign.id}`} className="font-medium underline">
                        {row.campaign.templateName}
                      </Link>
                      <p className="text-muted-foreground">{formatWhen(row.campaign.createdAt)}</p>
                      {loanHref ? (
                        <Link href={loanHref} className="underline">
                          Loan timeline
                        </Link>
                      ) : null}
                      {history ? (
                        <Link href={history} className="block text-muted-foreground underline">
                          Channel history
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function formatWhen(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
