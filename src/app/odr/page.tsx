import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { OdrBackLink } from "@/components/odr-back-link";
import { OdrUploadForm } from "@/components/odr-upload-form";
import { DeskShell } from "@/components/desk-shell";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { workingBank } from "@/lib/bank-context";
import { prisma } from "@/lib/db";
import { approvedWording } from "@/lib/odr-templates";
import { odrEnvLive, odrLiveWarning } from "@/lib/odr-live";
import { readOdrRules } from "@/lib/odr-store";
import { isOwnerAdmin } from "@/lib/owner-admin";
import { backToDesk } from "@/lib/odr-back";
import { canSendNotices } from "@/lib/roles";

export const metadata: Metadata = { title: "ODR" };

export default async function OdrPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canSendNotices(user.role)) redirect("/odr/cases");
  const bank = workingBank(user);
  const rules = await readOdrRules();
  const neutrals = await prisma.odrNeutral.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  const alerts = bank
    ? await prisma.odrAlert.count({ where: { bankId: bank.id, readAt: null } })
    : 0;
  const vendor = isOwnerAdmin(user);

  return (
    <DeskShell user={user}>
      <OdrBackLink target={backToDesk()} />
      <div>
        <h1 className="font-serif text-4xl tracking-tight">ODR</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
          {bank
            ? `Open an arbitration or mediation for ${bank.name}. Choose the type before you upload the bank’s Excel file. The spreadsheet and the cases stay on this bank.`
            : "Choose a bank before uploading an ODR sheet."}
        </p>
      </div>
      <p className="rounded-lg border border-border bg-card px-3 py-2 text-sm leading-6">
        {odrLiveWarning({ storedOn: rules.liveStored, envOn: odrEnvLive() })}
      </p>
      <div className="flex flex-wrap gap-2">
        <Link href="/odr/cases" className={buttonVariants({ variant: "outline", className: "h-11 px-4" })}>
          Cases
        </Link>
        <Link href="/odr/today" className={buttonVariants({ variant: "outline", className: "h-11 px-4" })}>
          Today’s hearings
        </Link>
        <Link href="/odr/queue" className={buttonVariants({ variant: "outline", className: "h-11 px-4" })}>
          Next hearing needed{alerts ? ` · ${alerts} new` : ""}
        </Link>
        <Link href="/odr/neutrals" className={buttonVariants({ variant: "outline", className: "h-11 px-4" })}>
          Arbitrators
        </Link>
        <Link href="/odr/templates" className={buttonVariants({ variant: "outline", className: "h-11 px-4" })}>
          Templates
        </Link>
        <a href="/odr/sample" className={buttonVariants({ variant: "outline", className: "h-11 px-4" })}>
          Download sample sheet
        </a>
      </div>
      {!bank ? null : neutrals.length === 0 ? (
        <p className="text-sm leading-6">
          Add an arbitrator or mediator before the upload.{" "}
          <Link href="/odr/neutrals" className="underline">
            Open the list
          </Link>
          .
        </p>
      ) : (
        <OdrUploadForm neutrals={neutrals} />
      )}
      <section className="rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10">
        <h2 className="font-serif text-2xl">First hearing wording</h2>
        <pre className="mt-3 whitespace-pre-wrap text-sm leading-6">{approvedWording("arbitration.first")}</pre>
        {vendor ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Email template id arbitration_first_hearing. WhatsApp template arbitration_first_hearing, language en. SMS is not configured until a flow id is saved.
          </p>
        ) : null}
      </section>
    </DeskShell>
  );
}
