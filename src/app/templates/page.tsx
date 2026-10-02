// Notice templates for the current bank. Firm staff can add and edit. A bank viewer can only look.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
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
import { prisma } from "@/lib/db";
import { ROLE_ADMIN } from "@/lib/roles";
import {
  channelLabels,
  parseChannels,
  TEMPLATE_APPROVED,
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
                ? `Templates for ${bank.name}. Each bank has its own wording. Only an Approved template can be filled in from a spreadsheet.`
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
          <>
            {isAdmin ? (
              <Card>
                <CardHeader>
                  <CardTitle>Add a template</CardTitle>
                  <CardDescription>
                    {bank.active
                      ? "Write the notice once. Placeholders such as {{customer_name}} are filled from the spreadsheet."
                      : "This bank is inactive. Mark it active before adding a template."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {bank.active ? (
                    <Link
                      href="/templates/new"
                      className={buttonVariants({ className: "h-11 px-4" })}
                    >
                      New template
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

            <TemplateList bankId={bank.id} canEdit={isAdmin && bank.active} />
          </>
        )}
      </main>
    </div>
  );
}

async function TemplateList({ bankId, canEdit }: { bankId: string; canEdit: boolean }) {
  const templates = await prisma.noticeTemplate.findMany({
    where: { bankId },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-serif text-2xl">Templates for this bank</h2>
      {templates.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {canEdit ? "No templates yet. Add the first one above." : "No templates yet."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {templates.map((template) => {
            const approved = template.status === TEMPLATE_APPROVED;
            const channels = channelLabels(parseChannels(template.channels));
            return (
              <li
                key={template.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10"
              >
                <div>
                  <p className="font-medium">{template.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <span className={approved ? "font-medium text-foreground" : ""}>
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
                  {canEdit ? "Edit" : "View"}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
