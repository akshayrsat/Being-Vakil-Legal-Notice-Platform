// Notice templates for the current bank. Firm staff can add and edit. A bank viewer can only look.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ApprovedTemplateSelect } from "@/components/approved-template-select";
import { AppHeader } from "@/components/app-header";
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
import { sortTemplatesByName, templateLibraryNotes } from "@/lib/template-library";
import {
  channelLabels,
  isApprovedTemplateStatus,
  parseChannels,
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
                ? `Saved wording for ${bank.name}. Each bank has its own templates. Approved ones stay in this list and are what you select when you prepare a send. Uploading a spreadsheet does not add a template.`
                : `Templates the firm has saved for ${bank.name}. You can read them. You cannot change them.`
              : "Choose a bank before writing a notice template."}
          </p>
        </div>

        {!bank ? (
          <Card>
            <CardHeader>
              <CardTitle>No bank selected</CardTitle>
              <CardDescription>A template has to belong to one bank.</CardDescription>
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
          <TemplateLibrary bankId={bank.id} bankName={bank.name} canWrite={isAdmin && bank.active} isAdmin={isAdmin} />
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
  const saved = sortTemplatesByName(library.templates);
  const approved = library.approved.map((template) => ({ id: template.id, name: template.name }));
  const notes = templateLibraryNotes({
    bankName,
    savedCount: saved.length,
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
              ? "Write a new template, or select an Approved one already saved for this bank. Listed A to Z."
              : "Approved templates for this bank are listed A to Z. You can open one to read it."}
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
            <ApprovedTemplateSelect templates={approved} />
          </div>
          {approved.length > 0 ? (
            <p className="text-sm leading-6 text-muted-foreground">
              {approved.length === 1
                ? "1 Approved template is saved for this bank. It stays selectable for later sends."
                : `${approved.length} Approved templates are saved for this bank. They stay selectable for later sends.`}
            </p>
          ) : null}
          {notes.map((note) => (
            <p key={note} className="text-sm leading-6 text-muted-foreground">
              {note}
            </p>
          ))}
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-2xl">Saved for this bank</h2>
        {saved.length === 0 ? (
          <p className="text-sm text-muted-foreground">No templates saved for {bankName} yet.</p>
        ) : (
        <ul className="flex flex-col gap-3">
          {saved.map((template) => {
            const isApproved = isApprovedTemplateStatus(template.status);
            const channels = channelLabels(parseChannels(template.channels));
            return (
              <li
                key={template.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10"
              >
                <div>
                  <p className="font-medium">{template.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <span className={isApproved ? "font-medium text-foreground" : ""}>
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
