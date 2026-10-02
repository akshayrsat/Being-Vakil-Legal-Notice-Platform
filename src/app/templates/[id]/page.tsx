// Read or edit notice wording. Approved wording can be opened from any bank.
// A draft opens only for the bank it was written for. People and files are not loaded.

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
import { requiredBankId } from "@/lib/bank-data";
import { workingBank } from "@/lib/bank-context";
import { backToTemplates } from "@/lib/desk-back";
import { prisma } from "@/lib/db";
import { ROLE_ADMIN } from "@/lib/roles";
import {
  parseChannels,
  TEMPLATE_APPROVED,
  TEMPLATE_DRAFT,
  templateFormNote,
  type TemplateStatusValue,
} from "@/lib/templates";

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
    where: {
      id,
      OR: [
        { status: TEMPLATE_APPROVED },
        { bankId: requiredBankId(bank.id), status: TEMPLATE_DRAFT },
      ],
    },
    select: {
      id: true,
      bankId: true,
      name: true,
      dltTemplateId: true,
      channels: true,
      body: true,
      status: true,
      bank: { select: { name: true } },
    },
  });

  if (!template) {
    return (
      <div className="flex min-h-full flex-col">
        <AppHeader user={user} />
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-8 sm:px-6">
          <BackLinks links={[backToTemplates()]} />
          <h1 className="font-serif text-3xl">Template not found</h1>
          <p className="leading-7 text-muted-foreground">
            That template is not available for the bank you are working on.
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
          <p className="text-sm text-muted-foreground">
            {template.bankId === bank.id
              ? bank.name
              : `${bank.name} · written for ${template.bank.name}`}
          </p>
          <h1 className="mt-1 font-serif text-4xl tracking-tight">{template.name}</h1>
        </div>

        {query.saved === "1" ? (
          <p className="rounded-lg border border-border bg-card px-3 py-2 text-sm" role="status">
            {template.status === TEMPLATE_APPROVED
              ? "Template saved. Every bank can select this Approved wording. Spreadsheets and people stay on the bank you are working on."
              : `Draft saved for ${template.bank.name}. It stays on that bank until you mark it Approved.`}
          </p>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>{canEdit ? "Edit the notice" : "Template"}</CardTitle>
            <CardDescription>
              {canEdit
                ? template.status === TEMPLATE_APPROVED
                  ? "Change the wording, then save. This Approved template can be selected for every bank."
                  : "Change the wording, then save. Mark it Approved to list it for every bank."
                : isAdmin
                  ? "This bank is inactive, so the template cannot be changed."
                  : "You can read this template. You cannot change it."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canEdit ? (
              <TemplateForm
                note={templateFormNote({
                  isNew: false,
                  status: template.status,
                  homeBankName: template.bank.name,
                })}
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
