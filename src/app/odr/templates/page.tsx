// The firm’s ODR templates. Staff do not write templates on this page.
// An approved template can be selected. A pending template is listed and cannot be selected.
// The owner admin also sees the reference id. Sending stays on the ODR switch in Settings.

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
import {
  odrLibraryDetail,
  odrTemplateLibrary,
  odrTemplatesListCard,
  odrTemplatesListIntro,
  odrWordingPreview,
  pendingOdrTemplates,
  selectableOdrTemplates,
  type OdrLibraryItem,
} from "@/lib/odr-template-library";
import { readOdrRules } from "@/lib/odr-store";
import { isOwnerAdmin } from "@/lib/owner-admin";
import { canChooseBank, isBankUser } from "@/lib/roles";

export const metadata: Metadata = {
  title: "ODR templates",
};

export default async function OdrTemplatesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (isBankUser(user.role)) redirect("/deliveries");

  const bank = workingBank(user);
  const isAdmin = canChooseBank(user.role);
  const showVendorDetail = isOwnerAdmin(user);

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader user={user} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">ODR templates</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            {bank
              ? odrTemplatesListIntro(bank.name, showVendorDetail)
              : "Choose a bank before opening ODR templates."}
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
          <OdrTemplateLibrary bankName={bank.name} showVendorDetail={showVendorDetail} />
        )}
      </main>
    </div>
  );
}

async function OdrTemplateLibrary({
  bankName,
  showVendorDetail,
}: {
  bankName: string;
  showVendorDetail: boolean;
}) {
  const rules = await readOdrRules();
  const items = odrTemplateLibrary(rules.templates);
  const approved = selectableOdrTemplates(items);
  const pending = pendingOdrTemplates(items);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Templates for {bankName}</CardTitle>
          <CardDescription>{odrTemplatesListCard(showVendorDetail)}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ApprovedTemplateSelect
            basePath="/odr/templates"
            templates={approved.map((template) => ({
              id: template.id,
              label: template.name,
            }))}
          />
          {approved.length > 0 ? (
            <p className="text-sm leading-6 text-muted-foreground">
              {approved.length === 1
                ? "1 approved template can be selected for every bank."
                : `${approved.length} approved templates can be selected for every bank.`}
            </p>
          ) : null}
          <p className="text-sm leading-6 text-muted-foreground">
            Pending templates are listed below. They cannot be selected.
          </p>
        </CardContent>
      </Card>

      <TemplateRows title="Approved templates" items={approved} showVendorDetail={showVendorDetail} />
      <TemplateRows title="Pending templates" items={pending} showVendorDetail={showVendorDetail} />
    </>
  );
}

function TemplateRows({
  title,
  items,
  showVendorDetail,
}: {
  title: string;
  items: OdrLibraryItem[];
  showVendorDetail: boolean;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-serif text-2xl">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">None.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((template) => (
            <li
              key={template.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10"
            >
              <div>
                <p className="font-medium">{template.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{odrLibraryDetail(template, showVendorDetail)}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{odrWordingPreview(template.body)}</p>
              </div>
              <Link
                href={`/odr/templates/${template.id}`}
                className={buttonVariants({ variant: "outline", className: "h-11 px-4" })}
              >
                View
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
