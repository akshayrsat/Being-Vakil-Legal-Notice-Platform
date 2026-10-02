// Every send that shares a loan number, customer id, or mobile, inside one bank.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { BackLinks } from "@/components/back-link";
import { LoanTimelineList } from "@/components/loan-timeline-list";
import { MessageOpened, NoticeLinkOpened } from "@/components/notice-link-opened";
import { NoticeOpenLink } from "@/components/notice-open-link";
import { getCurrentUser } from "@/lib/auth";
import { campaignStatusLabel, deliveryStatusLabel, sendChannelLabel } from "@/lib/campaigns";
import { backToSearch } from "@/lib/desk-back";
import { prisma } from "@/lib/db";
import { loadAccountTimeline } from "@/lib/loan-timeline";
import { noticeLinkOpensByNumber } from "@/lib/public-notice";
import { resolveReportBank } from "@/lib/report-bank";

export const metadata: Metadata = {
  title: "Person history",
};

export default async function PersonHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ bank?: string; loan?: string; customer?: string; mobile?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const query = await searchParams;
  const bank = await resolveReportBank(user, query.bank ?? "");
  const loan = (query.loan ?? "").trim();
  const customer = (query.customer ?? "").trim();
  const mobile = (query.mobile ?? "").trim();

  if (!bank) redirect("/deliveries");

  const or = [
    loan ? { loanNumber: loan } : null,
    customer ? { customerId: customer } : null,
    mobile ? { mobile } : null,
  ].filter((item): item is { loanNumber: string } | { customerId: string } | { mobile: string } =>
    Boolean(item),
  );

  const rows =
    or.length === 0
      ? []
      : await prisma.campaignDelivery.findMany({
          where: { bankId: bank.id, OR: or },
          include: {
            campaign: {
              select: {
                id: true,
                templateName: true,
                createdAt: true,
                status: true,
                mode: true,
                followsCampaign: { select: { id: true, templateName: true } },
              },
            },
          },
          orderBy: [{ campaign: { createdAt: "desc" } }, { channel: "asc" }],
        });

  const name = rows[0]?.customerName ?? "This person";
  const linkOpens = await noticeLinkOpensByNumber(
    rows.map((row) => row.noticeNumber),
    bank.id,
  );
  const timeline = await loadAccountTimeline({
    bankId: bank.id,
    loan,
    account: loan ? "" : customer,
    mobile: loan || customer ? "" : mobile,
  });

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader user={user} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <BackLinks links={[backToSearch(bank.id)]} />
        <div>
          <p className="text-sm text-muted-foreground">{bank.name}</p>
          <h1 className="mt-1 font-serif text-4xl tracking-tight">{name}</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {[loan && `Loan ${loan}`, customer && `Customer ${customer}`, mobile && `Mobile ${mobile}`]
              .filter(Boolean)
              .join(" · ") || "No identifier was given."}{" "}
            Sends that share any of these are listed together. A follow-up stays tied to the same
            person.
          </p>
        </div>

        {timeline && timeline.events.length > 0 ? (
          <section>
            <h2 className="font-serif text-2xl">Timeline</h2>
            <div className="mt-4">
              <LoanTimelineList timeline={timeline} />
            </div>
          </section>
        ) : null}

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sends matched this person in {bank.name}.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((row) => (
              <li key={row.id} className="rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link href={`/campaigns/${row.campaign.id}?bank=${encodeURIComponent(bank.id)}`} className="font-medium underline">
                    {row.campaign.templateName}
                  </Link>
                  <p className="text-sm text-muted-foreground">{formatWhen(row.campaign.createdAt)}</p>
                </div>
                <p className="mt-2 text-sm">
                  {sendChannelLabel(row.channel)}
                  <span className="mx-2 text-muted-foreground">·</span>
                  {deliveryStatusLabel(row.status)}
                  <span className="mx-2 text-muted-foreground">·</span>
                  {campaignStatusLabel(row.campaign.status, row.campaign.mode)}
                </p>
                {row.detail ? <p className="mt-1 text-sm text-muted-foreground">{row.detail}</p> : null}
                <MessageOpened openedAt={row.openedAt} className="mt-1 text-sm text-muted-foreground" />
                <NoticeLinkOpened
                  open={linkOpens.get(row.noticeNumber)}
                  className="mt-1 text-sm text-muted-foreground"
                />
                {row.noticeNumber ? (
                  <p className="mt-2 text-sm">
                    Notice {row.noticeNumber}
                    <span className="mx-2 text-muted-foreground">·</span>
                    <NoticeOpenLink noticeNumber={row.noticeNumber} />
                  </p>
                ) : null}
                {row.campaign.followsCampaign ? (
                  <p className="mt-2 text-sm">
                    Follow-up to{" "}
                    <Link
                      href={`/campaigns/${row.campaign.followsCampaign.id}?bank=${encodeURIComponent(bank.id)}`}
                      className="underline"
                    >
                      {row.campaign.followsCampaign.templateName}
                    </Link>
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <BackLinks links={[backToSearch(bank.id)]} />
      </main>
    </div>
  );
}

function formatWhen(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
