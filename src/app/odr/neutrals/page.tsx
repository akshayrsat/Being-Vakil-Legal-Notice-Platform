import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OdrBankPanelForm, OdrNeutralEmailForm, OdrNeutralForm } from "@/components/odr-case-forms";
import { OdrBackLink } from "@/components/odr-back-link";
import { DeskShell } from "@/components/desk-shell";
import { getCurrentUser } from "@/lib/auth";
import { workingBank } from "@/lib/bank-context";
import { prisma } from "@/lib/db";
import { backToOdr } from "@/lib/odr-back";
import { canSendNotices } from "@/lib/roles";

export const metadata: Metadata = { title: "Arbitrators" };

export default async function NeutralsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canSendNotices(user.role)) redirect("/odr/cases");
  const bank = workingBank(user);
  const neutrals = await prisma.odrNeutral.findMany({ orderBy: { name: "asc" } });
  const panel = bank
    ? await prisma.odrBankPanel.findMany({ where: { bankId: bank.id }, orderBy: { sortOrder: "asc" }, select: { neutralId: true } })
    : [];
  return (
    <DeskShell user={user}>
      <OdrBackLink target={backToOdr()} />
      <div>
        <h1 className="font-serif text-4xl tracking-tight">Arbitrators and mediators</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
          A short list for the firm. The name, email, qualification, and enrolment number are copied onto each case. The email is used for the hearing calendar. The customer is not invited.
        </p>
      </div>
      <ul className="flex flex-col gap-2 text-sm">
        {neutrals.map((neutral) => (
          <li key={neutral.id} className="rounded-lg border border-border px-3 py-2">
            <span className="font-medium">{neutral.name}</span>
            {neutral.email ? ` · ${neutral.email}` : " · No email yet"}
            {neutral.qualification ? ` · ${neutral.qualification}` : ""}
            {neutral.enrolmentNo ? ` · ${neutral.enrolmentNo}` : ""}
            {neutral.active ? "" : " · Inactive"}
            <OdrNeutralEmailForm neutralId={neutral.id} email={neutral.email} />
          </li>
        ))}
        {neutrals.length === 0 ? <li>No names yet.</li> : null}
      </ul>
      <OdrNeutralForm />
      {bank ? (
        <section className="rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10">
          <h2 className="font-serif text-2xl">Arbitrator panel</h2>
          <div className="mt-3">
            <OdrBankPanelForm
              bankName={bank.name}
              neutrals={neutrals}
              selectedIds={panel.map((seat) => seat.neutralId)}
            />
          </div>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">Choose a bank before saving its arbitrator panel.</p>
      )}
    </DeskShell>
  );
}
