// Read one ODR template. Staff do not write or edit templates here.
// The message and the approval status are shown to everyone who can open the page.
// The reference id is shown only to the owner admin.

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
import { backToOdrTemplates } from "@/lib/desk-back";
import {
  odrTemplateDetailCard,
  odrTemplateLibrary,
  odrTemplateMissingCopy,
  parseOdrLibraryId,
} from "@/lib/odr-template-library";
import { readOdrRules } from "@/lib/odr-store";
import { isOwnerAdmin } from "@/lib/owner-admin";
import { isBankUser } from "@/lib/roles";

export const metadata: Metadata = {
  title: "ODR template",
};

export default async function OdrTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (isBankUser(user.role)) redirect("/deliveries");

  const bank = workingBank(user);
  if (!bank) redirect("/odr/templates");

  const showVendorDetail = isOwnerAdmin(user);
  const { id } = await params;
  const parsed = parseOdrLibraryId(id);
  const rules = parsed ? await readOdrRules() : null;
  const template = parsed && rules
    ? odrTemplateLibrary(rules.templates).find((item) => item.id === id) ?? null
    : null;

  if (!template) {
    return (
      <div className="flex min-h-full flex-col">
        <AppHeader user={user} />
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-8 sm:px-6">
          <BackLinks links={[backToOdrTemplates()]} />
          <h1 className="font-serif text-3xl">Template not found</h1>
          <p className="leading-7 text-muted-foreground">{odrTemplateMissingCopy()}</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader user={user} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <BackLinks links={[backToOdrTemplates()]} />
        <div>
          <p className="text-sm text-muted-foreground">
            {template.status === "APPROVED" ? "Approved for every bank" : "Pending. This template cannot be selected."}
          </p>
          <h1 className="mt-1 font-serif text-4xl tracking-tight">{template.name}</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Template</CardTitle>
            <CardDescription>{odrTemplateDetailCard(showVendorDetail)}</CardDescription>
          </CardHeader>
          <CardContent>
            <TemplateReadout
              name={template.name}
              channels={[template.channel]}
              status={template.status}
              statusText={template.status === "APPROVED" ? "Approved" : "Pending"}
              showStatus
              showVendorDetail={showVendorDetail}
              vendorLabel={template.vendorLabel}
              dltTemplateId={showVendorDetail ? template.vendorId : ""}
              body={template.body}
            />
          </CardContent>
        </Card>

        <BackLinks links={[backToOdrTemplates()]} />
      </main>
    </div>
  );
}
