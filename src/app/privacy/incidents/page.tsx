import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { savePrivacyIncident } from "@/app/actions/privacy";
import { AppHeader } from "@/components/app-header";
import { getCurrentUser } from "@/lib/auth";
import { canReadIncidents } from "@/lib/privacy-access";
import { INCIDENT_CHECKS } from "@/lib/privacy-copy";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Incidents" };

function stamp(date: Date | null): string {
  if (!date) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function show(date: Date | null): string {
  if (!date) return "Not recorded";
  return date.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; id?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canReadIncidents(user.role)) redirect("/dashboard");
  const query = await searchParams;
  const rows = await prisma.privacyIncident.findMany({ orderBy: { detectedAt: "desc" }, take: 50 });
  const editing = rows.find((row) => row.id === query.id) ?? null;
  const checks = editing ? parseChecks(editing.checklistJson) : {};

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader user={user} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">Incidents</h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
            A note for the owner. Saving it does not email the bank, the Board, or any person. Record those calls yourself and put the time here.
          </p>
        </div>
        {query.saved === "1" ? <p className="rounded-lg border border-border bg-card px-3 py-2 text-sm">Incident note saved. Nothing was sent.</p> : null}
        {query.error === "1" ? <p className="rounded-lg border border-border bg-card px-3 py-2 text-sm" role="alert">Enter a title, what happened, and when it was detected.</p> : null}
        <form action={savePrivacyIncident} className="flex flex-col gap-4 rounded-xl border border-border bg-card px-5 py-5">
          {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
          <label className="flex flex-col gap-1 text-sm font-medium">
            Title
            <input name="title" required defaultValue={editing?.title ?? ""} className="h-11 rounded-lg border border-border bg-background px-3 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            What happened
            <textarea name="whatHappened" required rows={4} defaultValue={editing?.whatHappened ?? ""} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            When it was detected
            <input name="detectedAt" type="datetime-local" required defaultValue={editing ? stamp(editing.detectedAt) : ""} className="h-11 rounded-lg border border-border bg-background px-3 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Banks affected
            <input name="banksAffected" defaultValue={editing?.banksAffected ?? ""} className="h-11 rounded-lg border border-border bg-background px-3 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            People affected (count)
            <input name="peopleAffectedCount" type="number" min={0} defaultValue={editing?.peopleAffectedCount ?? 0} className="h-11 w-32 rounded-lg border border-border bg-background px-3 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Bank notified
            <input name="notifiedBankAt" type="datetime-local" defaultValue={editing ? stamp(editing.notifiedBankAt) : ""} className="h-11 rounded-lg border border-border bg-background px-3 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Board notified
            <input name="notifiedBoardAt" type="datetime-local" defaultValue={editing ? stamp(editing.notifiedBoardAt) : ""} className="h-11 rounded-lg border border-border bg-background px-3 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            People notified
            <input name="notifiedPeopleAt" type="datetime-local" defaultValue={editing ? stamp(editing.notifiedPeopleAt) : ""} className="h-11 rounded-lg border border-border bg-background px-3 text-sm" />
          </label>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Checklist</legend>
            {INCIDENT_CHECKS.map((item) => (
              <label key={item.id} className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="check" value={item.id} defaultChecked={checks[item.id] === true} className="mt-1 size-4 accent-primary" />
                {item.label}
              </label>
            ))}
          </fieldset>
          <button type="submit" className="h-11 w-fit rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
            {editing ? "Update note" : "Save note"}
          </button>
        </form>
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.id} className="rounded-xl border border-border px-4 py-4 text-sm leading-6">
              <p className="font-medium">{row.title}</p>
              <p className="mt-1 whitespace-pre-wrap">{row.whatHappened}</p>
              <p className="mt-2 text-muted-foreground">
                Detected {show(row.detectedAt)}. Banks: {row.banksAffected || "—"}. People: {row.peopleAffectedCount}.
              </p>
              <p className="text-muted-foreground">
                Bank told: {show(row.notifiedBankAt)}. Board told: {show(row.notifiedBoardAt)}. People told: {show(row.notifiedPeopleAt)}.
              </p>
              <p className="mt-2">
                <a className="underline" href={`/privacy/incidents?id=${row.id}`}>Edit</a>
              </p>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}

function parseChecks(json: string): Record<string, boolean> {
  try {
    const value = JSON.parse(json) as Record<string, unknown>;
    const checks: Record<string, boolean> = {};
    for (const [key, item] of Object.entries(value)) checks[key] = item === true;
    return checks;
  } catch {
    return {};
  }
}
