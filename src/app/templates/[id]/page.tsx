// Read or edit one notice template. It must belong to the bank currently in use.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { BackLinks } from "@/components/back-link";
import { TemplateForm } from "@/components/template-form";
import { TemplateReadout } from "@/components/template-readout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { workingBank } from "@/lib/bank-context";
import { backToTemplates } from "@/lib/desk-back";
import { prisma } from "@/lib/db";
import { ROLE_ADMIN } from "@/lib/roles";
import { parseChannels, type TemplateStatusValue } from "@/lib/templates";

export const metadata: Metadata = {
  title: "Template",
};

export default async function TemplatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const bank = workingBank(user);
  if (!bank) redirect("/templates");

  const { id } = await params;
  const query = await searchParams;
  const isAdmin = user.role === ROLE_ADMIN;
  const canEdit = isAdmin && bank.active;

  const template = await prisma.noticeTemplate.findFirst({
    where: { id, bankId: bank.id },
  });

  if (!template) {
    return (
      <div className="flex min-h-full flex-col">
        <AppHeader user={user} />
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-8 sm:px-6">
          <BackLinks links={[backToTemplates()]} />
          <h1 className="font-serif text-3xl">Template not found</h1>
          <p className="leading-7 text-muted-foreground">
            That template is not under the bank you are working on. Switch bank if it was saved on another one.
          </p>
        </main>
      </div>
    );
  }

  const channels = parseChannels(template.channels);

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader user={user} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <BackLinks links={[backToTemplates()]} />
        <div>
          <p className="text-sm text-muted-foreground">{bank.name}</p>
          <h1 className="mt-1 font-serif text-4xl tracking-tight">{template.name}</h1>
        </div>

        {query.saved === "1" ? (
          <p className="rounded-lg border border-border bg-card px-3 py-2 text-sm" role="status">
            Template saved for {bank.name}.
            {template.status === "APPROVED"
              ? " It can be used when you fill a notice from a spreadsheet."
              : " It is still a draft, so it will not appear in the filled-notice list."}
          </p>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>{canEdit ? "Edit the notice" : "Template"}</CardTitle>
            <CardDescription>
              {canEdit
                ? "Change the wording, then save. Approving it makes it available on a spreadsheet."
                : isAdmin
                  ? "This bank is inactive, so the template cannot be changed."
                  : "You can read this template. You cannot change it."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canEdit ? (
              <TemplateForm
                bankName={bank.name}
                initial={{
                  id: template.id,
                  name: template.name,
                  dltTemplateId: template.dltTemplateId,
                  channels,
                  status: template.status as TemplateStatusValue,
                  body: template.body,
                }}
              />
            ) : (
              <TemplateReadout
                name={template.name}
                dltTemplateId={template.dltTemplateId}
                channels={channels}
                status={template.status}
                body={template.body}
              />
            )}
          </CardContent>
        </Card>

        <BackLinks links={[backToTemplates()]} />
      </main>
    </div>
  );
}
