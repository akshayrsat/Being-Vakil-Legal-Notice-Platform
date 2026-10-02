// People who were skipped or failed. Preparing a follow-up does not send a message.
// Speed Post has no status and is not called.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { NoticeLinkOpened } from "@/components/notice-link-opened";
import { NoticeOpenLink } from "@/components/notice-open-link";
import { FollowUpButton } from "@/components/follow-up-button";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { workingBank } from "@/lib/bank-context";
import { deliveryStatusLabel, sendChannelLabel } from "@/lib/campaigns";
import { prisma } from "@/lib/db";
import { personHistoryHref } from "@/lib/delivery-report";
import { noticeLinkOpensByNumber } from "@/lib/public-notice";
import { scopedBankId, withBank } from "@/lib/report-bank";
import { ROLE_ADMIN } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Reminders",
};

export default async function RemindersPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ bank?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const query = await searchParams;
  const isAdmin = user.role === ROLE_ADMIN;
  const working = workingBank(user);
  const scope = scopedBankId(user, query.bank);

  const campaign = scope
    ? await prisma.campaign.findFirst({
        where: { id, bankId: scope },
        include: {
          bank: { select: { id: true, name: true, active: true } },
          deliveries: {
            where: { bankId: scope, status: { in: ["SKIPPED", "FAILED"] } },
            orderBy: [{ rowNumber: "asc" }, { channel: "asc" }],
          },
        },
      })
    : null;

  if (!campaign) {
    return (
      <div className="flex min-h-full flex-col">
        <AppHeader user={user} />
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-8 sm:px-6">
          <h1 className="font-serif text-3xl">Send not found</h1>
          <Link
            href="/campaigns"
            className={buttonVariants({ variant: "outline", className: "h-11 w-fit px-4" })}
          >
            Back to campaigns
          </Link>
        </main>
      </div>
    );
  }

  const linkOpens = await noticeLinkOpensByNumber(
    campaign.deliveries.map((row) => row.noticeNumber),
    campaign.bankId,
  );

  const canFollowUp =
    isAdmin && working?.id === campaign.bankId && campaign.bank.active && campaign.status !== "REVIEW";

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader user={user} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <div>
          <p className="text-sm text-muted-foreground">{campaign.bank.name}</p>
          <h1 className="mt-1 font-serif text-4xl tracking-tight">Reminders</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            These people were skipped or failed on {campaign.templateName}. A follow-up is another
            review for the same loan number, customer id, or mobile. It is not sent from this page.
            Speed Post has no status and is not used.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {campaign.deliveries.length}{" "}
              {campaign.deliveries.length === 1 ? "row" : "rows"} to follow up
            </CardTitle>
            <CardDescription>
              {campaign.status === "REVIEW"
                ? "Confirm the send before preparing a follow-up."
                : "Only skipped and failed rows are listed. A dry run that finished is not listed here."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {canFollowUp ? <FollowUpButton campaignId={campaign.id} /> : null}
            {isAdmin && campaign.status !== "REVIEW" && !canFollowUp ? (
              <p className="text-sm text-muted-foreground">
                Switch to {campaign.bank.name}
                {campaign.bank.active ? "" : " and mark it active"} before preparing a follow-up.
              </p>
            ) : null}
            {!isAdmin ? (
              <p className="text-sm text-muted-foreground">You can read this list. You cannot prepare a follow-up.</p>
            ) : null}
            {campaign.deliveries.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nobody was skipped or failed on this send.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-2 py-2 font-medium">Name</th>
                      <th className="px-2 py-2 font-medium">Loan</th>
                      <th className="px-2 py-2 font-medium">Channel</th>
                      <th className="px-2 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaign.deliveries.map((row) => {
                      const history = personHistoryHref(row, campaign.bankId);
                      return (
                        <tr key={row.id} className="border-b border-border">
                          <td className="px-2 py-2">
                            <p className="font-medium">{row.customerName}</p>
                            <p className="text-muted-foreground">{row.mobile || row.email || "—"}</p>
                            <NoticeOpenLink noticeNumber={row.noticeNumber} />
                          </td>
                          <td className="px-2 py-2">
                            <p>{row.loanNumber || "—"}</p>
                            <p className="text-muted-foreground">{row.customerId}</p>
                          </td>
                          <td className="px-2 py-2">{sendChannelLabel(row.channel)}</td>
                          <td className="px-2 py-2">
                            <p>{deliveryStatusLabel(row.status)}</p>
                            <p className="text-muted-foreground">{row.detail}</p>
                            <NoticeLinkOpened open={linkOpens.get(row.noticeNumber)} />
                            {history ? (
                              <Link href={history} className="underline">
                                History
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
          </CardContent>
        </Card>

        <Link
          href={withBank(`/campaigns/${campaign.id}`, campaign.bankId)}
          className={buttonVariants({ variant: "outline", className: "h-11 w-fit px-4" })}
        >
          Back to this send
        </Link>
      </main>
    </div>
  );
}
