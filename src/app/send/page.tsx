// One place to send a notice for the bank in use. Nothing is sent on this page.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AppHeader } from "@/components/app-header";
import { CampaignForm } from "@/components/campaign-form";
import { EmptyState } from "@/components/empty-state";
import { SendSteps } from "@/components/send-steps";
import { UploadForm } from "@/components/upload-form";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { campaignWhere, uploadBatchWhere } from "@/lib/bank-data";
import { workingBank } from "@/lib/bank-context";
import { isSendChannel, parseSendChannels } from "@/lib/campaign-plan";
import { campaignStatusLabel, labelsForChannels } from "@/lib/campaigns";
import { prisma } from "@/lib/db";
import { formatIndiaDateTime } from "@/lib/india-day";
import { liveSendIsOn } from "@/lib/live-send-store";
import { loadTemplateLibrary } from "@/lib/load-template-library";
import { msg91AuthKey } from "@/lib/msg91";
import { canSendNotices, isOwner } from "@/lib/roles";
import {
  confirmWarning,
  sendNoticeIntro,
  spreadsheetAction,
  type SendStepNumber,
} from "@/lib/send-notice";
import { templateLibraryNotes } from "@/lib/template-library";
import { parseChannels, templateChoiceLabel } from "@/lib/templates";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Send notice",
};

export default async function SendNoticePage({
  searchParams,
}: {
  searchParams: Promise<{ batch?: string }>;
}) {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const bank = workingBank(user);
  const isAdmin = canSendNotices(user.role);
  const owner = isOwner(user.role);
  const query = await searchParams;
  const switchOn = await liveSendIsOn();
  const warning = confirmWarning({ switchOn, authKeySet: Boolean(msg91AuthKey()) });

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader user={user} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">Send notice</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            {bank
              ? sendNoticeIntro(bank.name, isAdmin && bank.active)
              : "Choose a bank before sending a notice."}
          </p>
        </div>
        <p className="rounded-lg border border-border bg-card px-3 py-2 text-sm" role="status">
          {warning}
          {owner ? (
            <>
              {" "}
              <Link href="/settings" className="font-medium underline">
                Change this in Settings
              </Link>
              .
            </>
          ) : null}
        </p>

        {!bank ? (
          <Card>
            <CardHeader>
              <CardTitle>No bank selected</CardTitle>
              <CardDescription>A spreadsheet and a send have to belong to one bank.</CardDescription>
            </CardHeader>
            <CardContent>
              {isAdmin ? (
                <Link href="/banks" className={buttonVariants({ variant: "outline", className: "h-11 px-4" })}>
                  Choose a bank
                </Link>
              ) : (
                <p>This login is not linked to a bank. Ask the firm administrator.</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <SendNoticeBody
            bankId={bank.id}
            bankName={bank.name}
            bankActive={bank.active}
            isAdmin={isAdmin}
            requestedBatchId={query.batch ?? ""}
            warning={warning}
          />
        )}
      </main>
    </div>
  );
}

async function SendNoticeBody({
  bankId,
  bankName,
  bankActive,
  isAdmin,
  requestedBatchId,
  warning,
}: {
  bankId: string;
  bankName: string;
  bankActive: boolean;
  isAdmin: boolean;
  requestedBatchId: string;
  warning: string;
}) {
  const canSend = isAdmin && bankActive;
  const batches = await prisma.uploadBatch.findMany({
    where: uploadBatchWhere(bankId),
    orderBy: { createdAt: "desc" },
    select: { id: true, fileName: true, saved: true, rowCount: true, createdAt: true },
  });
  const selected = batches.find((batch) => batch.id === requestedBatchId && batch.saved) ?? null;
  const requested = batches.find((batch) => batch.id === requestedBatchId) ?? null;
  const currentStep: SendStepNumber = selected ? 2 : 1;
  const library = await loadTemplateLibrary(bankId, isAdmin);
  const templates = library.approved;
  const notes = templateLibraryNotes({
    bankName,
    savedCount: library.templates.length,
    approvedCount: templates.length,
    elsewhere: library.elsewhere,
    canWrite: canSend,
  });
  const savedBatches = batches.filter((batch) => batch.saved);

  return (
    <>
      <SendSteps current={currentStep} />

      <Card>
        <CardHeader>
          <CardTitle>1. Choose the spreadsheet of people</CardTitle>
          <CardDescription>
            {canSend
              ? `Upload ${bankName}’s Excel file, or use one already saved. The people stay on this bank.`
              : bankActive
                ? `Spreadsheets the firm has saved for ${bankName}.`
                : "This bank is inactive. Mark it active before uploading or sending."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {canSend ? <UploadForm /> : null}
          {batches.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {canSend ? "No spreadsheets yet. Upload the first one above." : "No spreadsheets yet."}
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {batches.map((batch) => {
                const action = spreadsheetAction(batch, canSend);
                const chosen = selected?.id === batch.id;
                return (
                  <li
                    key={batch.id}
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-4 ring-1 ${
                      chosen ? "bg-card ring-primary" : "bg-card ring-foreground/10"
                    }`}
                  >
                    <div>
                      <p className="font-medium">{batch.fileName}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatIndiaDateTime(batch.createdAt)}
                        <span className="mx-2">·</span>
                        {batch.saved
                          ? `${batch.rowCount} ${batch.rowCount === 1 ? "person" : "people"} saved`
                          : "Needs a column match"}
                        {chosen ? (
                          <>
                            <span className="mx-2">·</span>
                            Chosen
                          </>
                        ) : null}
                      </p>
                    </div>
                    <Link
                      href={action.href}
                      className={buttonVariants({
                        variant: chosen ? "default" : "outline",
                        className: "h-11 px-4",
                      })}
                    >
                      {action.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Choose the approved notice wording</CardTitle>
          <CardDescription>
            {selected
              ? `${selected.fileName}. Nothing is sent until you review who will get it.`
              : "Choose a saved spreadsheet above. Then pick the approved wording here."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {!canSend ? (
            <p className="text-sm leading-6 text-muted-foreground">
              {isAdmin
                ? "This bank is inactive, so a notice cannot be prepared."
                : "You can look at a spreadsheet. You cannot send."}
            </p>
          ) : requested && !requested.saved ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm leading-6 text-muted-foreground">
                {requested.fileName} still needs a column match before you can choose the wording.
              </p>
              <Link
                href={`/uploads/${requested.id}`}
                className={buttonVariants({ variant: "outline", className: "h-11 w-fit px-4" })}
              >
                Match the columns
              </Link>
            </div>
          ) : savedBatches.length === 0 ? (
            <p className="text-sm leading-6 text-muted-foreground">
              Upload a spreadsheet and match the columns first. Approved wording is already kept
              separately and will be listed here once the people are saved.
            </p>
          ) : !selected ? (
            <p className="text-sm leading-6 text-muted-foreground">
              Press Choose the notice wording on a spreadsheet above.
            </p>
          ) : templates.length === 0 ? (
            <div className="flex flex-col gap-3">
              {notes.map((note) => (
                <p key={note} className="text-sm leading-6 text-muted-foreground">
                  {note}
                </p>
              ))}
              <Link href="/templates" className={buttonVariants({ className: "h-11 w-fit px-4" })}>
                Go to templates
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {notes.map((note) => (
                <p key={note} className="text-sm leading-6 text-muted-foreground">
                  {note}
                </p>
              ))}
              <CampaignForm
                batches={savedBatches.map((batch) => ({
                  id: batch.id,
                  fileName: batch.fileName,
                  rowCount: batch.rowCount,
                }))}
                templates={templates.map((template) => ({
                  id: template.id,
                  name: templateChoiceLabel(
                    {
                      name: template.name,
                      bankId: template.bankId,
                      bankName: template.bank.name,
                    },
                    bankId,
                  ),
                  channels: parseChannels(template.channels).filter(isSendChannel),
                }))}
                initialBatchId={selected.id}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <EarlierNotices bankId={bankId} warning={warning} />
    </>
  );
}

async function EarlierNotices({ bankId, warning }: { bankId: string; warning: string }) {
  const campaigns = await prisma.campaign.findMany({
    where: campaignWhere(bankId),
    orderBy: { createdAt: "desc" },
    include: { batch: { select: { fileName: true } } },
  });

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-2xl">Notices already prepared</h2>
        <Link
          href={`/deliveries?bank=${bankId}`}
          className={buttonVariants({ variant: "outline", className: "h-11 px-4" })}
        >
          Find a person
        </Link>
      </div>
      {campaigns.length === 0 ? (
        <EmptyState title="No notices yet">
          Choose a spreadsheet and the approved wording above. {warning}
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
                  Review
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
