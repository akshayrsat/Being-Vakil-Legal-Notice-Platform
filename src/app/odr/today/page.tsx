import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { OdrBackLink } from "@/components/odr-back-link";
import { DeskShell } from "@/components/desk-shell";
import { EmptyState } from "@/components/empty-state";
import { getCurrentUser } from "@/lib/auth";
import { workingBank } from "@/lib/bank-context";
import { prisma } from "@/lib/db";
import { MEET_WORKSPACE_NOTE } from "@/lib/odr-guests";
import { odrListBack } from "@/lib/odr-back";
import { formatHearingTime } from "@/lib/odr-ref";
import { parsePanel } from "@/lib/odr-panel";
import { istDayBounds, istDayKey } from "@/lib/send-window";
import { isBankUser } from "@/lib/roles";

export const metadata: Metadata = { title: "Today’s hearings" };

export default async function TodaysHearingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const bank = workingBank(user);
  if (!bank) redirect("/odr/cases");
  const now = new Date();
  const { start, end } = istDayBounds(now);
  const hearings = await prisma.odrHearing.findMany({
    where: { bankId: bank.id, scheduledAt: { gte: start, lt: end } },
    include: { case: true },
    orderBy: { scheduledAt: "asc" },
  });

  return (
    <DeskShell user={user}>
      <OdrBackLink target={odrListBack(isBankUser(user.role))} />
      <div>
        <h1 className="font-serif text-4xl tracking-tight">Today’s hearings</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
          {bank.name} · {istDayKey(now)}. Join opens the Meet link. The customer is not a calendar guest.
        </p>
      </div>
      <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{MEET_WORKSPACE_NOTE}</p>
      {hearings.length === 0 ? (
        <EmptyState title="No hearings today">Hearings for this bank on other days stay on the case.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {hearings.map((hearing) => {
            const panel = parsePanel(hearing.case.panelJson);
            const names = panel.length > 1 ? panel.map((member) => member.name).join(", ") : hearing.case.neutralName;
            return (
              <li key={hearing.id} className="rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10">
                <p className="font-medium">
                  {formatHearingTime(hearing.scheduledAt)} · {hearing.case.customerName}
                </p>
                <p className="mt-1 text-sm">
                  <Link href={`/odr/cases/${hearing.caseId}`} className="underline">{hearing.case.refNo}</Link>
                  {names ? ` · ${names}` : ""}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{hearing.guestInviteNote || "Meet link follows the hearing."}</p>
                {hearing.meetLink ? (
                  <a href={hearing.meetLink} className="mt-3 inline-flex h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
                    Join
                  </a>
                ) : (
                  <p className="mt-3 text-sm">Meet link not ready</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </DeskShell>
  );
}
