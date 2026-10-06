import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { OdrBulkScheduleForm } from "@/components/odr-case-forms";
import { OdrBackLink } from "@/components/odr-back-link";
import { DeskShell } from "@/components/desk-shell";
import { EmptyState } from "@/components/empty-state";
import { getCurrentUser } from "@/lib/auth";
import { workingBank } from "@/lib/bank-context";
import { prisma } from "@/lib/db";
import { formatHearingDate } from "@/lib/odr-ref";
import { needsNextHearing, nowMs } from "@/lib/odr-schedule";
import { backToOdr } from "@/lib/odr-back";
import { canSendNotices } from "@/lib/roles";

export const metadata: Metadata = { title: "Next hearing needed" };

export default async function OdrQueuePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canSendNotices(user.role)) redirect("/odr/cases");
  const bank = workingBank(user);
  if (!bank) redirect("/odr");
  const cases = await prisma.odrCase.findMany({
    where: { bankId: bank.id, status: { in: ["NO_SHOW"] } },
    include: { hearings: true, alerts: { where: { readAt: null } } },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  const now = nowMs();
  const queue = cases.filter((item) =>
    needsNextHearing({
      status: item.status,
      flaggedExParte: false,
      hasFutureHearing: item.hearings.some((hearing) => hearing.scheduledAt.getTime() > now),
    }),
  );
  const flagged = cases.filter((item) => item.flaggedExParte);

  return (
    <DeskShell user={user}>
      <OdrBackLink target={backToOdr()} />
      <div>
        <h1 className="font-serif text-4xl tracking-tight">Next hearing needed</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
          No-show cases for {bank.name} that do not yet have another date. A case at the no-show limit stays here for the arbitrator to proceed ex parte or close. It is not sent another message automatically.
        </p>
      </div>
      {queue.length === 0 ? (
        <EmptyState title="No cases are waiting">When a hearing is marked No-show, it appears here.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {queue.map((item) => {
            const last = [...item.hearings].sort((a, b) => a.number - b.number).at(-1);
            return (
              <li key={item.id}>
                <Link href={`/odr/cases/${item.id}`} className="font-medium underline">
                  {item.refNo}
                </Link>{" "}
                · {item.customerName} · {item.noShowCount} no-show{item.noShowCount === 1 ? "" : "s"}
                {last ? ` · last hearing ${formatHearingDate(last.scheduledAt)}` : ""}
                {item.flaggedExParte ? " · Ex parte review" : ""}
              </li>
            );
          })}
        </ul>
      )}
      {flagged.length > 0 ? (
        <p className="text-sm text-muted-foreground">{flagged.length} of these have reached the no-show limit.</p>
      ) : null}
      <section>
        <h2 className="font-serif text-2xl">Schedule every no-show from one date</h2>
        <div className="mt-3 max-w-xl">
          <OdrBulkScheduleForm />
        </div>
      </section>
    </DeskShell>
  );
}
