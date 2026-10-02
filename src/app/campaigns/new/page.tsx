// Start a send for the bank the Admin is working on. Nothing is sent on this page.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { CampaignForm } from "@/components/campaign-form";
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
import { isSendChannel } from "@/lib/campaign-plan";
import { prisma } from "@/lib/db";
import { ROLE_ADMIN } from "@/lib/roles";
import { parseChannels, TEMPLATE_APPROVED } from "@/lib/templates";

export const metadata: Metadata = {
  title: "Prepare a send",
};

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ batch?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== ROLE_ADMIN) redirect("/campaigns");

  const bank = workingBank(user);
  if (!bank) redirect("/campaigns");

  const query = await searchParams;
  const batches = await prisma.uploadBatch.findMany({
    where: { bankId: bank.id, saved: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, fileName: true, rowCount: true },
  });
  const templates = await prisma.noticeTemplate.findMany({
    where: { bankId: bank.id, status: TEMPLATE_APPROVED },
    orderBy: { name: "asc" },
    select: { id: true, name: true, channels: true },
  });
  const ready = bank.active && batches.length > 0 && templates.length > 0;

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader user={user} />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <div>
          <p className="text-sm text-muted-foreground">{bank.name}</p>
          <h1 className="mt-1 font-serif text-4xl tracking-tight">Prepare a send</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Choose the file and the notice</CardTitle>
            <CardDescription>
              {bank.active
                ? "The next page is a review. Nothing is sent until you confirm."
                : "This bank is inactive, so a send cannot be prepared."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!bank.active ? (
              <Link
                href="/banks"
                className={buttonVariants({ variant: "outline", className: "h-11 w-fit px-4" })}
              >
                Go to banks
              </Link>
            ) : batches.length === 0 ? (
              <p className="text-sm leading-6 text-muted-foreground">
                Upload a spreadsheet and save the column match first.
              </p>
            ) : templates.length === 0 ? (
              <p className="text-sm leading-6 text-muted-foreground">
                Approve a notice template for this bank first. Drafts are not listed here.
              </p>
            ) : ready ? (
              <CampaignForm
                batches={batches}
                templates={templates.map((template) => ({
                  id: template.id,
                  name: template.name,
                  channels: parseChannels(template.channels).filter(isSendChannel),
                }))}
                initialBatchId={query.batch ?? ""}
              />
            ) : null}
          </CardContent>
        </Card>
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
