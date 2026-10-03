// The firm’s approved notice templates. Staff do not write templates on this page.
// Bank users and legal coordinators see the name and the channel.
// The owner admin also sees the reference id. Sending still uses the stored id.

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
import { isOwnerAdmin } from "@/lib/owner-admin";
import { canChooseBank } from "@/lib/roles";
import {
  templateLibraryNotes,
  templatesEmptyLibrary,
  templatesListCard,
  templatesListIntro,
} from "@/lib/template-library";
import { staffTemplateLibraryView } from "@/lib/templates";

export const metadata: Metadata = {
  title: "Templates",
};

export default async function TemplatesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const bank = workingBank(user);
  const isAdmin = canChooseBank(user.role);
  const showVendorDetail = isOwnerAdmin(user);

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader user={user} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">Notice templates</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            {bank
              ? templatesListIntro(bank.name, showVendorDetail)
              : "Choose a bank before opening notice templates."}
          </p>
        </div>

        {!bank ? (
          <Card>
            <CardHeader>
              <CardTitle>No bank selected</CardTitle>
              <CardDescription>
                Choose a bank first. The approved templates can be used for any bank. A spreadsheet
                stays on the bank you choose.
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
            inactive={isAdmin && !bank.active}
            showVendorDetail={showVendorDetail}
          />
        )}
      </main>
    </div>
  );
}

async function TemplateLibrary({
  bankId,
  bankName,
  inactive,
  showVendorDetail,
}: {
  bankId: string;
  bankName: string;
  inactive: boolean;
  showVendorDetail: boolean;
}) {
  const library = await loadTemplateLibrary(bankId, false);
  const view = staffTemplateLibraryView(
    library.templates.map((template) => ({
      id: template.id,
      name: template.name,
      bankId: template.bankId,
      bankName: template.bank.name,
      status: template.status,
      channels: template.channels,
      dltTemplateId: template.dltTemplateId,
      seedKey: template.seedKey,
    })),
    bankId,
    { showVendorDetail },
  );
  const notes = templateLibraryNotes({
    bankName,
    savedCount: view.saved.length,
    approvedCount: view.saved.length,
    elsewhere: library.elsewhere,
  });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Templates for {bankName}</CardTitle>
          <CardDescription>{templatesListCard(showVendorDetail)}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ApprovedTemplateSelect
            templates={view.saved.map((template) => ({
              id: template.id,
              label: template.name,
            }))}
          />
          {view.saved.length > 0 ? (
            <p className="text-sm leading-6 text-muted-foreground">
              {view.saved.length === 1
                ? "1 Approved template can be selected for every bank."
                : `${view.saved.length} Approved templates can be selected for every bank.`}
            </p>
          ) : null}
          {notes.map((note) => (
            <p key={note} className="text-sm leading-6 text-muted-foreground">
              {note}
            </p>
          ))}
          {inactive ? (
            <p className="text-sm leading-6 text-muted-foreground">
              This bank is inactive. You can still read the approved templates.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-2xl">Approved templates</h2>
        {view.saved.length === 0 ? (
          <p className="text-sm text-muted-foreground">{templatesEmptyLibrary()}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {view.saved.map((template) => (
              <li
                key={template.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10"
              >
                <div>
                  <p className="font-medium">{template.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{template.detail}</p>
                </div>
                <Link
                  href={`/templates/${template.id}`}
                  className={buttonVariants({ variant: "outline", className: "h-11 px-4" })}
                >
                  View
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
