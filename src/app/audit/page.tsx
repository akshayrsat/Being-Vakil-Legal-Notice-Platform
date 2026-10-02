// Firm staff only. A Bank Viewer who opens this address sees no events.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { buttonVariants } from "@/components/ui/button";
import { AUDIT_ACTIONS, auditActionLabel, auditWhere, isAuditAction } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isWebhookConfigured } from "@/lib/msg91-webhook";
import { ROLE_ADMIN, roleTitle } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Security",
};

const PAGE_LIMIT = 100;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.role !== ROLE_ADMIN) {
    return (
      <div className="flex min-h-full flex-col">
        <AppHeader user={user} />
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-8 sm:px-6">
          <h1 className="font-serif text-4xl tracking-tight">Security / Audit</h1>
          <p className="text-base leading-7 text-muted-foreground">
            This page is for firm staff only. A bank login cannot read the audit log.
          </p>
          <Link
            href="/dashboard"
            className={buttonVariants({ variant: "outline", className: "h-11 w-fit px-4" })}
          >
            Back home
          </Link>
        </main>
      </div>
    );
  }

  const raw = await searchParams;
  const filters = {
    action: one(raw.action).toLowerCase(),
    bankId: one(raw.bank),
    text: one(raw.q).slice(0, 80),
    from: dateOnly(one(raw.from)),
    to: dateOnly(one(raw.to)),
  };
  const banks = await prisma.bank.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  const events = await prisma.auditEvent.findMany({
    where: auditWhere(filters),
    orderBy: { createdAt: "desc" },
    take: PAGE_LIMIT,
  });
  const webhookOn = isWebhookConfigured();

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader user={user} />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">Security / Audit</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            This list is only for firm staff. It records who signed in, changed a bank, uploaded a
            file, saved a template, confirmed a send, prepared a follow-up, or downloaded a CSV. It
            does not store passwords or the MSG91 key.
          </p>
        </div>

        <p className="rounded-lg border border-border bg-card px-3 py-2 text-sm leading-6">
          {webhookOn
            ? "MSG91 can report delivered, read, or failed for a live send. A dry run is never changed by that report."
            : "MSG91 delivery updates are turned off. Set MSG91_WEBHOOK_SECRET in the .env file (at least 8 characters) before this computer will accept them. Until then the update address refuses the call and changes nothing."}
        </p>

        <form action="/audit" method="get" className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
            Who or what
            <input
              name="q"
              defaultValue={filters.text}
              placeholder="Example: Meera or dry run"
              className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Action
            <select
              name="action"
              defaultValue={isAuditAction(filters.action) ? filters.action : ""}
              className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal"
            >
              <option value="">All actions</option>
              {AUDIT_ACTIONS.map((action) => (
                <option key={action.id} value={action.id}>
                  {action.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Bank
            <select
              name="bank"
              defaultValue={filters.bankId}
              className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal"
            >
              <option value="">All banks</option>
              {banks.map((bank) => (
                <option key={bank.id} value={bank.id}>
                  {bank.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            From
            <input
              type="date"
              name="from"
              defaultValue={filters.from}
              className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            To
            <input
              type="date"
              name="to"
              defaultValue={filters.to}
              className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal"
            />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className={buttonVariants({ className: "h-11 px-4" })}>
              Filter
            </button>
          </div>
        </form>

        <section className="flex flex-col gap-3">
          <h2 className="font-serif text-2xl">
            {events.length === PAGE_LIMIT ? `Latest ${PAGE_LIMIT} events` : `${events.length} ${events.length === 1 ? "event" : "events"}`}
          </h2>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing matched. Sign in, or confirm a dry run, and the event will appear here.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg ring-1 ring-foreground/10">
              <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
                <thead className="bg-muted/70">
                  <tr>
                    <th className="px-3 py-2 font-medium">When</th>
                    <th className="px-3 py-2 font-medium">Who</th>
                    <th className="px-3 py-2 font-medium">What</th>
                    <th className="px-3 py-2 font-medium">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={event.id} className="border-t border-border">
                      <td className="px-3 py-2 whitespace-nowrap">{formatWhen(event.createdAt)}</td>
                      <td className="px-3 py-2">
                        <p className="font-medium">{event.actorName}</p>
                        <p className="text-muted-foreground">
                          {event.actorRole === "webhook" ? "Status update" : roleTitle(event.actorRole)}
                        </p>
                      </td>
                      <td className="px-3 py-2">{auditActionLabel(event.action)}</td>
                      <td className="px-3 py-2">
                        <p>{event.summary}</p>
                        {event.bankName ? <p className="text-muted-foreground">{event.bankName}</p> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value ?? "").trim();
}

function dateOnly(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function formatWhen(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
