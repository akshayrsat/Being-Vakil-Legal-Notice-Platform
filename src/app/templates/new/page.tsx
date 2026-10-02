// A blank notice template for the bank the Admin is working on.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { BackLinks } from "@/components/back-link";
import { TemplateForm } from "@/components/template-form";
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
import { backToTemplates } from "@/lib/desk-back";
import { ROLE_ADMIN } from "@/lib/roles";
import { TEMPLATE_DRAFT } from "@/lib/templates";

export const metadata: Metadata = {
  title: "New template",
};

export default async function NewTemplatePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== ROLE_ADMIN) redirect("/templates");

  const bank = workingBank(user);
  if (!bank) redirect("/templates");

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader user={user} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <BackLinks links={[backToTemplates()]} />
        <div>
          <p className="text-sm text-muted-foreground">{bank.name}</p>
          <h1 className="mt-1 font-serif text-4xl tracking-tight">New template</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Write the notice</CardTitle>
            <CardDescription>
              {bank.active
                ? "Leave it as Draft until the wording and the DLT id are ready."
                : "This bank is inactive, so a new template cannot be saved."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {bank.active ? (
              <TemplateForm
                bankName={bank.name}
                initial={{
                  id: "",
                  name: "",
                  dltTemplateId: "",
                  channels: ["SMS"],
                  status: TEMPLATE_DRAFT,
                  body: "",
                }}
              />
            ) : (
              <Link
                href="/banks"
                className={buttonVariants({ variant: "outline", className: "h-11 w-fit px-4" })}
              >
                Go to banks
              </Link>
            )}
          </CardContent>
        </Card>
        <BackLinks links={[backToTemplates()]} />
      </main>
    </div>
  );
}
