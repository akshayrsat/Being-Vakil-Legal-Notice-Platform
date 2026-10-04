// Printed legal notices for the firm. Separate from SMS, email, and WhatsApp.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { AddLegalNoticeForm } from "@/components/add-legal-notice-form";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  ensureStarterLegalNotice,
  LEGAL_NOTICE_STARTER_KEY,
  sortLegalNotices,
} from "@/lib/legal-notice-templates";
import { canSendNotices, isBankUser } from "@/lib/roles";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Legal notice templates",
};

export default async function LegalNoticesPage({
  searchParams,
}: {
  searchParams: Promise<{ added?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (isBankUser(user.role) || !canSendNotices(user.role)) redirect("/deliveries");

  const query = await searchParams;
  await ensureStarterLegalNotice(prisma);
  const notices = sortLegalNotices(await prisma.legalNoticeTemplate.findMany());

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader user={user} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">Legal notice templates</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            These are the printed legal notices. They are shared by the firm, for every bank. SMS,
            email, and WhatsApp stay on Templates.
          </p>
        </div>

        {query.added === "1" ? (
          <p className="rounded-lg border border-border bg-card px-3 py-2 text-sm" role="status">
            Legal notice template added. You can choose it on Send notice.
          </p>
        ) : null}

        <section className="flex flex-col gap-3">
          <h2 className="font-serif text-2xl">Legal notices</h2>
          {notices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No legal notice yet. Add one below.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {notices.map((notice) => {
                const starter = notice.seedKey === LEGAL_NOTICE_STARTER_KEY;
                const preview = notice.body.replace(/\s+/g, " ").trim().slice(0, 180);
                return (
                  <li
                    key={notice.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10"
                  >
                    <div>
                      <p className="font-medium">{notice.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {starter
                          ? "The notice the firm already sends."
                          : "Added for the firm. A send can use this wording."}
                      </p>
                      {preview ? (
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{preview}</p>
                      ) : null}
                    </div>
                    <Link
                      href={`/legal-notices/${notice.id}`}
                      className={buttonVariants({ variant: "outline", className: "h-11 px-4" })}
                    >
                      View
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Add a legal notice</CardTitle>
            <CardDescription>
              Give it a name and write the notice. More formats can be added to this list later.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AddLegalNoticeForm />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
