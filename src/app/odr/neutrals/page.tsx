import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OdrNeutralForm } from "@/components/odr-case-forms";
import { OdrBackLink } from "@/components/odr-back-link";
import { DeskShell } from "@/components/desk-shell";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { backToOdr } from "@/lib/odr-back";
import { canSendNotices } from "@/lib/roles";

export const metadata: Metadata = { title: "Arbitrators" };

export default async function NeutralsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canSendNotices(user.role)) redirect("/odr/cases");
  const neutrals = await prisma.odrNeutral.findMany({ orderBy: { name: "asc" } });
  return (
    <DeskShell user={user}>
      <OdrBackLink target={backToOdr()} />
      <div>
        <h1 className="font-serif text-4xl tracking-tight">Arbitrators and mediators</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
          A short list for the firm. The name, qualification, and enrolment number are copied onto each case.
        </p>
      </div>
      <ul className="flex flex-col gap-2 text-sm">
        {neutrals.map((neutral) => (
          <li key={neutral.id} className="rounded-lg border border-border px-3 py-2">
            <span className="font-medium">{neutral.name}</span>
            {neutral.qualification ? ` · ${neutral.qualification}` : ""}
            {neutral.enrolmentNo ? ` · ${neutral.enrolmentNo}` : ""}
            {neutral.active ? "" : " · Inactive"}
          </li>
        ))}
        {neutrals.length === 0 ? <li>No names yet.</li> : null}
      </ul>
      <OdrNeutralForm />
    </DeskShell>
  );
}
