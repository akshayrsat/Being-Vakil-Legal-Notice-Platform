// Approved wording is listed for every bank. Drafts stay on the bank they were written for.
// Spreadsheets and people are not loaded here.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { ApprovedTemplateSelect } from "@/components/approved-template-select";
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
import { loadTemplateLibrary } from "@/lib/load-template-library";
import { ROLE_ADMIN } from "@/lib/roles";
import { templateLibraryNotes } from "@/lib/template-library";
import {
  channelLabels,
  isApprovedTemplateStatus,
  listTemplatesForBank,
  parseChannels,
  selectableApprovedTemplates,
  templateChoiceLabel,
  templateStatusLabel,
} from "@/lib/templates";

export const metadata: Metadata = {
  title: "Templates",
};

export default async function TemplatesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const bank = workingBank(user);
  const isAdmin = user.role === ROLE_ADMIN;

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader user={user} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">Notice templates</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            {bank
              ? isAdmin
                ? `Approved wording is shared. While you work on ${bank.name}, you can select any Approved template. A draft stays on the bank it was written for. Spreadsheets and the people in them stay on ${bank.name}.`
                : `Approved notice wording, plus drafts for ${bank.name}. You can read them. You cannot change them.`
              : "Choose a bank before opening notice templates."}
          </p>
        </div>

        {!bank ? (
          <Card>
            <CardHeader>
              <CardTitle>No bank selected</CardTitle>
              <CardDescription>
                Choose a bank first. Approved wording can be used for any bank. A spreadsheet stays
                on the bank you choose.
              </CardDescription>
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
          <TemplateLibrary
            bankId={bank.id}
            bankName={bank.name}
            canWrite={isAdmin && bank.active}
            isAdmin={isAdmin}
          />
        )}
      </main>
    </div>
  );
}

async function TemplateLibrary({
  bankId,
  bankName,
  canWrite,
  isAdmin,
}: {
  bankId: string;
  bankName: string;
  canWrite: boolean;
  isAdmin: boolean;
}) {
  const library = await loadTemplateLibrary(bankId, isAdmin);
  const templates = listTemplatesForBank(library.templates, bankId);
  const approved = selectableApprovedTemplates(templates);
  const notes = templateLibraryNotes({
    bankName,
    savedCount: templates.length,
    approvedCount: approved.length,
    elsewhere: library.elsewhere,
    canWrite,
  });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Templates for {bankName}</CardTitle>
          <CardDescription>
            {canWrite
              ? "Write a new template, or select an Approved one. Approved templates are listed A to Z for every bank."
              : "Approved templates are listed A to Z. You can open one to read it."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            {canWrite ? (
              <Link href="/templates/new" className={buttonVariants({ className: "h-11 px-4" })}>
                New template
              </Link>
            ) : isAdmin ? (
              <Link href="/banks" className={buttonVariants({ variant: "outline", className: "h-11 px-4" })}>
                Go to banks
              </Link>
            ) : null}
            <ApprovedTemplateSelect
              templates={approved.map((template) => ({
                id: template.id,
                label: templateChoiceLabel(
                  { name: template.name, bankId: template.bankId, bankName: template.bank.name },
                  bankId,
                ),
              }))}
            />
          </div>
          {approved.length > 0 ? (
            <p className="text-sm leading-6 text-muted-foreground">
              {approved.length === 1
                ? "1 Approved template can be selected for every bank."
                : `${approved.length} Approved templates can be selected for every bank.`}
            </p>
          ) : null}
          {notes.map((note) => (
            <p key={note} className="text-sm leading-6 text-muted-foreground">
              {note}
            </p>
          ))}
          {isAdmin && !canWrite ? (
            <p className="text-sm leading-6 text-muted-foreground">
              This bank is inactive. You can still read Approved wording. Mark the bank active
              before adding a template.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-2xl">Saved wording</h2>
        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {canWrite
              ? "No templates yet. Add one above and mark it Approved to list it for every bank."
              : "No templates yet."}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {templates.map((template) => {
              const approvedRow = isApprovedTemplateStatus(template.status);
              const channels = channelLabels(parseChannels(template.channels));
              const writtenFor =
                template.bankId === bankId ? "Written for this bank" : `Written for ${template.bank.name}`;
              return (
                <li
                  key={template.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10"
                >
                  <div>
                    <p className="font-medium">{template.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      <span className={approvedRow ? "font-medium text-foreground" : ""}>
                        {templateStatusLabel(template.status)}
                      </span>
                      {channels ? (
                        <>
                          <span className="mx-2">·</span>
                          {channels}
                        </>
                      ) : null}
                      {template.dltTemplateId ? (
                        <>
                          <span className="mx-2">·</span>
                          DLT {template.dltTemplateId}
                        </>
                      ) : null}
                      <span className="mx-2">·</span>
                      {writtenFor}
                      {approvedRow ? (
                        <>
                          <span className="mx-2">·</span>
                          Available for every bank
                        </>
                      ) : null}
                    </p>
                  </div>
                  <Link
                    href={`/templates/${template.id}`}
                    className={buttonVariants({ variant: "outline", className: "h-11 px-4" })}
                  >
                    {canWrite ? "Edit" : "View"}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
