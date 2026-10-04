// Read one printed legal notice. The letterhead is added when a notice is filled.

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { BackLink } from "@/components/back-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LEGAL_NOTICE_STARTER_KEY } from "@/lib/legal-notice-templates";
import { canSendNotices, isBankUser } from "@/lib/roles";
import { LEGAL_NOTICES_HREF } from "@/lib/send-notice";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Legal notice",
};

export default async function LegalNoticePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (isBankUser(user.role) || !canSendNotices(user.role)) redirect("/deliveries");

  const { id } = await params;
  const notice = await prisma.legalNoticeTemplate.findUnique({ where: { id } });
  if (!notice) notFound();

  const starter = notice.seedKey === LEGAL_NOTICE_STARTER_KEY;

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader user={user} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <BackLink href={LEGAL_NOTICES_HREF}>Back to legal notice templates</BackLink>
        <div>
          <h1 className="font-serif text-4xl tracking-tight">{notice.name}</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            {starter
              ? "This is the legal notice the firm already sends. A filled copy keeps the letterhead and the advocate stamp."
              : "A filled copy uses this wording, with the letterhead and the advocate stamp."}
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Notice wording</CardTitle>
            <CardDescription>
              Words in double braces, such as {"{{customer_name}}"}, are filled from the spreadsheet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap font-serif text-base leading-7">{notice.body}</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
