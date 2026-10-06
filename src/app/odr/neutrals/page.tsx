import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OdrBankPanelForm, OdrNeutralEditForm, OdrNeutralForm } from "@/components/odr-case-forms";
import { OdrBackLink } from "@/components/odr-back-link";
import { DeskShell } from "@/components/desk-shell";
import { getCurrentUser } from "@/lib/auth";
import { workingBank } from "@/lib/bank-context";
import { prisma } from "@/lib/db";
import { formatIndiaDateTime } from "@/lib/india-day";
import { backToOdr } from "@/lib/odr-back";
import { canSendNotices } from "@/lib/roles";

export const metadata: Metadata = { title: "Arbitrators" };

export default async function NeutralsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canSendNotices(user.role)) redirect("/odr/cases");
  const bank = workingBank(user);
  const neutrals = await prisma.odrNeutral.findMany({
    orderBy: { name: "asc" },
    include: { edits: { orderBy: { createdAt: "desc" }, take: 8 } },
  });
  const panel = bank
    ? await prisma.odrBankPanel.findMany({ where: { bankId: bank.id }, orderBy: { sortOrder: "asc" }, select: { neutralId: true } })
    : [];
  return (
    <DeskShell user={user}>
      <OdrBackLink target={backToOdr()} />
      <div>
        <h1 className="font-serif text-4xl tracking-tight">Arbitrators and mediators</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
          A short list for the firm. A new name needs an email and a 10-digit mobile. Edit keeps the qualification, enrolment, email, mobile, and whether the name is active. Invites, the morning list, and hearing notices use the email and mobile saved here. The customer is not invited to the calendar.
        </p>
      </div>
      <ul className="flex flex-col gap-3 text-sm">
        {neutrals.map((neutral) => (
          <li key={neutral.id} className="rounded-lg border border-border px-3 py-3">
            <p>
              <span className="font-medium">{neutral.name}</span>
              {neutral.email ? ` · ${neutral.email}` : " · No email yet"}
              {neutral.mobile ? ` · ${neutral.mobile}` : " · No mobile yet"}
              {neutral.qualification ? ` · ${neutral.qualification}` : ""}
              {neutral.enrolmentNo ? ` · ${neutral.enrolmentNo}` : ""}
              {neutral.active ? "" : " · Inactive"}
            </p>
            <OdrNeutralEditForm neutral={neutral} />
            <div className="mt-3">
              <p className="font-medium">Edit history</p>
              {neutral.edits.length === 0 ? (
                <p className="mt-1 text-muted-foreground">No edits yet.</p>
              ) : (
                <ul className="mt-1 flex flex-col gap-1 text-muted-foreground">
                  {neutral.edits.map((edit) => (
                    <li key={edit.id}>
                      {formatIndiaDateTime(edit.createdAt)} · {edit.actorName} · {edit.summary}
                    </li>
                  ))}
                </ul>
              )}
            </div>
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
