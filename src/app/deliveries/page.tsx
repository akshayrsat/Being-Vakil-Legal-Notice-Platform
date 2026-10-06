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
import { campaignWhere } from "@/lib/bank-data";
import { deliveryStatusLabel, sendChannelLabel } from "@/lib/campaigns";
import { hideVendorWording, seesVendorDetail } from "@/lib/staff-language";
import { prisma } from "@/lib/db";
import {
  deliveryWhere,
  filtersToSearch,
  personHistoryHref,
  readDeliveryFilters,
} from "@/lib/delivery-report";
import { loanSearchHref } from "@/lib/loan-timeline";
import { noticeLinkOpensByNumber } from "@/lib/public-notice";
import { formatIndiaDateTime } from "@/lib/india-day";
import { resolveReportBank } from "@/lib/report-bank";
import { canChooseBank, isBankUser } from "@/lib/roles";
import { RecordSwitch } from "@/components/record-switch";
import { OdrReportPanel } from "@/components/odr-report-panel";

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
  const isAdmin = canChooseBank(user.role);
  const bankUser = isBankUser(user.role);
  const technical = seesVendorDetail(user);
  const bank = await resolveReportBank(user, params.get("bank") ?? "");
  const view = params.get("view") === "odr" ? "odr" : "notices";

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader user={user} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">Find a person</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            {view === "odr"
              ? bank
                ? `ODR cases for ${bank.name}. Download the Excel only after Apply.`
                : "Choose a bank before searching."
              : bank
                ? technical
                  ? `Search sends for ${bank.name}. A dry run stays marked Dry run. It is not called delivered.`
                  : `Notices already sent for ${bank.name}, and the delivery status of each one.`
                : "Choose a bank before searching."}
          </p>
          <div className="mt-4">
            <RecordSwitch base="/deliveries" view={view} />
          </div>
        </div>

        {!bank ? (
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "Open Banks and press Use this bank, or pick a bank below once one exists." : "This login is not linked to a bank."}
          </p>
        ) : view === "odr" ? (
          <OdrReportPanel bankId={bank.id} bankName={bank.name} params={params} downloadBase="/deliveries" />
        ) : (
          <>
            <DeliveryFiltersForm
              action="/deliveries"
              filters={filters}
              bankId={bank.id}
              campaigns={await campaignOptions(bank.id, bankUser)}
              technical={technical}
            />
            <Results bankId={bank.id} filters={filters} technical={technical} sentOnly={bankUser} />
          </>
        )}
      </main>
    </div>
  );
}

async function campaignOptions(bankId: string, sentOnly: boolean) {
  const campaigns = await prisma.campaign.findMany({
    where: { ...campaignWhere(bankId), ...(sentOnly ? { status: { not: "REVIEW" } } : {}) },
    orderBy: { createdAt: "desc" },
    select: { id: true, templateName: true, createdAt: true },
  });
  return campaigns.map((campaign) => ({
    id: campaign.id,
    name: `${campaign.templateName} · ${formatIndiaDateTime(campaign.createdAt)}`,
  }));
}

async function Results({
  bankId,
  filters,
  technical,
  sentOnly,
}: {
  bankId: string;
  filters: ReturnType<typeof readDeliveryFilters>;
  technical: boolean;
  sentOnly: boolean;
}) {
  const rows = await prisma.campaignDelivery.findMany({
    where: deliveryWhere(bankId, filters, { sentOnly }),
    include: {
      campaign: { select: { id: true, templateName: true, createdAt: true } },
    },
    orderBy: [{ campaign: { createdAt: "desc" } }, { rowNumber: "asc" }],
    take: PAGE_LIMIT,
  });
  const linkOpens = await noticeLinkOpensByNumber(
    rows.map((row) => row.noticeNumber),
    bankId,
  );
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
          {technical
            ? "Try a loan number from a dry run, such as LN10021, or clear the filters."
            : "Try a loan number, such as LN10021, or clear the filters."}
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
                <th className="px-3 py-2 font-medium">Notice</th>
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
                      <p>{deliveryStatusLabel(row.status, technical)}</p>
                      <p className="text-muted-foreground">{hideVendorWording(row.detail, technical) || "—"}</p>
                      <MessageOpened openedAt={row.openedAt} channel={row.channel} />
                      <NoticeLinkOpened open={linkOpens.get(row.noticeNumber)} />
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/campaigns/${row.campaign.id}?bank=${encodeURIComponent(bankId)}`} className="font-medium underline">
                        {row.campaign.templateName}
                      </Link>
                      <p className="text-muted-foreground">{formatIndiaDateTime(row.campaign.createdAt)}</p>
                      {!sentOnly && loanHref ? (
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

