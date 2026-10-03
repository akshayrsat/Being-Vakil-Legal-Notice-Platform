// Read one approved MSG91 template. Staff do not write or edit templates here.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { BackLinks } from "@/components/back-link";
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
import { firmLibraryTemplateWhere } from "@/lib/demo-templates";
import { parseChannels, templatePageKicker } from "@/lib/templates";

export const metadata: Metadata = {
  title: "Template",
};

export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const bank = workingBank(user);
  if (!bank) redirect("/templates");

  const { id } = await params;
  const template = await prisma.noticeTemplate.findFirst({
    where: { id, ...firmLibraryTemplateWhere() },
    select: {
      id: true,
      bankId: true,
      name: true,
      dltTemplateId: true,
      channels: true,
      body: true,
      status: true,
      seedKey: true,
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
            That template is not one of the firm’s approved MSG91 templates.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader user={user} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <BackLinks links={[backToTemplates()]} />
        <div>
          <p className="text-sm text-muted-foreground">
            {templatePageKicker({
              workingBankName: bank.name,
              workingBankId: bank.id,
              templateBankId: template.bankId,
              templateBankName: template.bank.name,
              seedKey: template.seedKey,
              dltTemplateId: template.dltTemplateId,
              name: template.name,
            })}
          </p>
          <h1 className="mt-1 font-serif text-4xl tracking-tight">{template.name}</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Template</CardTitle>
            <CardDescription>
              SMS templates are approved on DLT. WhatsApp templates are created on MSG91 or
              Facebook. Email uses the MSG91 template. This page does not change them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TemplateReadout
              name={template.name}
              dltTemplateId={template.dltTemplateId}
              channels={parseChannels(template.channels)}
              status={template.status}
              body={template.body}
            />
          </CardContent>
        </Card>

        <BackLinks links={[backToTemplates()]} />
      </main>
    </div>
  );
}
