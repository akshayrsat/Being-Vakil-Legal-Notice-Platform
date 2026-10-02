// Sends prepared for the current bank. Firm staff can start one. A bank viewer can only look.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
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
import { campaignStatusLabel, labelsForChannels } from "@/lib/campaigns";
import { parseSendChannels } from "@/lib/campaign-plan";
import { prisma } from "@/lib/db";
import { ROLE_ADMIN } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Campaigns",
};

export default async function CampaignsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const bank = workingBank(user);
  const isAdmin = user.role === ROLE_ADMIN;

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader user={user} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">Campaigns</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            {bank
              ? isAdmin
                ? `Prepare a send for ${bank.name}. With MSG91 switched off, confirming only records a dry run.`
                : `Sends the firm prepared for ${bank.name}. You can look. You cannot start one.`
              : "Choose a bank before preparing a send."}
          </p>
          {bank ? (
            <Link
              href={`/deliveries?bank=${bank.id}`}
              className={buttonVariants({ variant: "outline", className: "mt-4 h-11 w-fit px-4" })}
            >
              Find a person
            </Link>
          ) : null}
        </div>

        {!bank ? (
          <Card>
            <CardHeader>
              <CardTitle>No bank selected</CardTitle>
              <CardDescription>A send has to belong to one bank.</CardDescription>
            </CardHeader>
            <CardContent>
              {isAdmin ? (
                <Link
                  href="/banks"
                  className={buttonVariants({ variant: "outline", className: "h-11 px-4" })}
                >
                  Choose a bank
                </Link>
              ) : (
                <p>This login is not linked to a bank. Ask the firm administrator.</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {isAdmin ? (
              <Card>
                <CardHeader>
                  <CardTitle>New send</CardTitle>
                  <CardDescription>
                    {bank.active
                      ? "Pick a saved spreadsheet and an approved template, then review it before confirming."
                      : "This bank is inactive. Mark it active before preparing a send."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {bank.active ? (
                    <Link
                      href="/campaigns/new"
                      className={buttonVariants({ className: "h-11 px-4" })}
                    >
                      Prepare a send
                    </Link>
                  ) : (
                    <Link
                      href="/banks"
                      className={buttonVariants({ variant: "outline", className: "h-11 px-4" })}
                    >
                      Go to banks
                    </Link>
                  )}
                </CardContent>
              </Card>
            ) : null}
            <CampaignList bankId={bank.id} />
          </>
        )}
      </main>
    </div>
  );
}

async function CampaignList({ bankId }: { bankId: string }) {
  const campaigns = await prisma.campaign.findMany({
    where: { bankId },
    orderBy: { createdAt: "desc" },
    include: {
      batch: { select: { fileName: true } },
    },
  });

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-serif text-2xl">Sends for this bank</h2>
      {campaigns.length === 0 ? (
        <EmptyState title="No sends yet">
          Prepare a send from a saved spreadsheet and an approved template. Confirming with live send off records a dry run.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {campaigns.map((campaign) => {
            const channels = labelsForChannels(parseSendChannels(campaign.channels));
            return (
              <li
                key={campaign.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10"
              >
                <div>
                  <p className="font-medium">{campaign.templateName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {campaign.batch.fileName}
                    <span className="mx-2">·</span>
                    {campaignStatusLabel(campaign.status, campaign.mode)}
                    {channels ? (
                      <>
                        <span className="mx-2">·</span>
                        {channels}
                      </>
                    ) : null}
                  </p>
                </div>
                <Link
                  href={`/campaigns/${campaign.id}`}
                  className={buttonVariants({ variant: "outline", className: "h-11 px-4" })}
                >
                  View
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
