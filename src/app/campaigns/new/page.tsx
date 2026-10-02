// Start a send for the bank the Admin is working on. Nothing is sent on this page.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { BackLinks } from "@/components/back-link";
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
import { uploadBatchWhere } from "@/lib/bank-data";
import { workingBank } from "@/lib/bank-context";
import { isSendChannel } from "@/lib/campaign-plan";
import { prepareSendBack } from "@/lib/desk-back";
import { loadTemplateLibrary } from "@/lib/load-template-library";
import { prisma } from "@/lib/db";
import { ROLE_ADMIN } from "@/lib/roles";
import { templateLibraryNotes } from "@/lib/template-library";
import { parseChannels } from "@/lib/templates";

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
    where: { ...uploadBatchWhere(bank.id), saved: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, fileName: true, rowCount: true },
  });
  const library = await loadTemplateLibrary(bank.id, true);
  const templates = library.approved;
  const notes = templateLibraryNotes({
    bankName: bank.name,
    savedCount: library.templates.length,
    approvedCount: templates.length,
    elsewhere: library.elsewhere,
    canWrite: true,
  });
  const ready = bank.active && batches.length > 0 && templates.length > 0;

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader user={user} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <BackLinks links={prepareSendBack(query.batch)} />
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
              <div className="flex flex-col gap-3">
                <p className="text-sm leading-6 text-muted-foreground">
                  Upload a spreadsheet and save the column match first.
                  {templates.length > 0
                    ? ` ${templates.length === 1 ? "1 Approved template is" : `${templates.length} Approved templates are`} already saved for ${bank.name} and will be listed here once the file is saved.`
                    : ""}
                </p>
                {templates.length === 0
                  ? notes.map((note) => (
                      <p key={note} className="text-sm leading-6 text-muted-foreground">
                        {note}
                      </p>
                    ))
                  : null}
                <Link
                  href="/uploads"
                  className={buttonVariants({ variant: "outline", className: "h-11 w-fit px-4" })}
                >
                  Go to uploads
                </Link>
              </div>
            ) : templates.length === 0 ? (
              <div className="flex flex-col gap-3">
                {notes.map((note) => (
                  <p key={note} className="text-sm leading-6 text-muted-foreground">
                    {note}
                  </p>
                ))}
                <div className="flex flex-wrap gap-2">
                  <Link href="/templates" className={buttonVariants({ className: "h-11 px-4" })}>
                    Go to templates
                  </Link>
                  <Link
                    href="/templates/new"
                    className={buttonVariants({ variant: "outline", className: "h-11 px-4" })}
                  >
                    New template
                  </Link>
                </div>
              </div>
            ) : ready ? (
              <div className="flex flex-col gap-4">
                {notes.map((note) => (
                  <p key={note} className="text-sm leading-6 text-muted-foreground">
                    {note}
                  </p>
                ))}
              <CampaignForm
                batches={batches}
                templates={templates.map((template) => ({
                  id: template.id,
                  name: template.name,
                  channels: parseChannels(template.channels).filter(isSendChannel),
                }))}
                initialBatchId={query.batch ?? ""}
              />
              </div>
            ) : null}
          </CardContent>
        </Card>
        <BackLinks links={prepareSendBack(query.batch)} />
      </main>
    </div>
  );
}
