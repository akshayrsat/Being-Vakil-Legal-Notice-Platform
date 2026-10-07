import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { correctPerson, erasePerson, placePersonHold, releasePersonHold } from "@/app/actions/privacy";
import { AppHeader } from "@/components/app-header";
import { getCurrentUser } from "@/lib/auth";
import { workingBank } from "@/lib/bank-context";
import { prisma } from "@/lib/db";
import { canCorrectOrErase, canFindPerson } from "@/lib/privacy-access";
import { DOWNLOADS_NOT_KEPT } from "@/lib/privacy-copy";
import { correctFieldAllowed, searchPeople, PERSON_KINDS } from "@/lib/privacy-person";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Find a person" };

const FIELDS: Record<string, string[]> = {
  notice: ["customerName", "address", "loanNumber", "customerId"],
  case: ["customerName", "mobile", "email", "accountNumber", "address"],
  message: ["toAddress"],
  document: ["note"],
  respondent: ["name", "mobile", "email", "address"],
  recipient: ["customerName", "mobile1", "email", "address", "loanNumber"],
  delivery: ["customerName", "mobile", "email", "loanNumber"],
};

export default async function FindPersonPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; saved?: string; error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canFindPerson(user.role)) redirect("/dashboard");
  const query = await searchParams;
  const bank = workingBank(user);
  const q = (query.q ?? "").trim();
  const editor = canCorrectOrErase(user.role);
  const hits = bank && q ? await searchPeople(prisma, bank.id, q) : [];
  const holds = bank
    ? await prisma.personLegalHold.findMany({ where: { bankId: bank.id, active: true }, orderBy: { createdAt: "desc" }, take: 20 })
    : [];

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader user={user} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">Find a person</h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
            Search this bank by mobile, email, or account across notices, ODR cases, messages, uploads, documents, and campaign rows.
            {" "}{DOWNLOADS_NOT_KEPT}
          </p>
        </div>
        {!bank ? <p className="text-sm">Choose a bank before searching.</p> : null}
        {query.saved === "erase" ? <p className="rounded-lg border border-border bg-card px-3 py-2 text-sm">Personal data was erased. The audit log does not keep the erased values.</p> : null}
        {query.saved === "correct" ? <p className="rounded-lg border border-border bg-card px-3 py-2 text-sm">The field was corrected. The audit log does not keep the old or new value.</p> : null}
        {query.saved === "hold" ? <p className="rounded-lg border border-border bg-card px-3 py-2 text-sm">Legal hold saved. Erasure is blocked for that person.</p> : null}
        {query.saved === "release" ? <p className="rounded-lg border border-border bg-card px-3 py-2 text-sm">Legal hold released.</p> : null}
        {query.error === "confirm" ? <p className="rounded-lg border border-border bg-card px-3 py-2 text-sm" role="alert">Type the confirmation word exactly.</p> : null}
        {query.error === "hold" ? <p className="rounded-lg border border-border bg-card px-3 py-2 text-sm" role="alert">Erasure is blocked by a legal hold, or that row is not on this bank.</p> : null}
        {query.error === "correct" ? <p className="rounded-lg border border-border bg-card px-3 py-2 text-sm" role="alert">That correction was not saved.</p> : null}
        {bank ? (
          <form className="flex flex-wrap items-end gap-3" action="/privacy/find">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Mobile, email, or account
              <input name="q" defaultValue={q} className="h-11 w-72 rounded-lg border border-border bg-background px-3 text-sm" />
            </label>
            <button type="submit" className="h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
              Search
            </button>
          </form>
        ) : null}
        {q && hits.length === 0 ? <p className="text-sm text-muted-foreground">No rows matched. Use at least 4 characters for an account.</p> : null}
        <ul className="flex flex-col gap-4">
          {hits.map((hit) => (
            <li key={`${hit.kind}-${hit.id}`} className="rounded-xl border border-border bg-card px-4 py-4">
              <p className="font-medium">{hit.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{hit.detail}{hit.held ? " · Legal hold" : ""}</p>
              {hit.kind === "case" ? (
                <p className="mt-1 text-sm">
                  <Link className="underline" href={`/odr/cases/${hit.id}`}>Open the case</Link>
                </p>
              ) : null}
              {editor ? (
                <div className="mt-3 flex flex-col gap-3">
                  {correctFieldAllowed(hit.kind, FIELDS[hit.kind]?.[0] ?? "") ? (
                    <form action={correctPerson} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="q" value={q} />
                      <input type="hidden" name="kind" value={hit.kind} />
                      <input type="hidden" name="id" value={hit.id} />
                      <label className="flex flex-col gap-1 text-xs font-medium">
                        Field
                        <select name="field" className="h-9 rounded-lg border border-border bg-background px-2 text-sm">
                          {(FIELDS[hit.kind] ?? []).map((field) => (
                            <option key={field} value={field}>{field}</option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1 text-xs font-medium">
                        New value
                        <input name="value" className="h-9 rounded-lg border border-border bg-background px-2 text-sm" />
                      </label>
                      <label className="flex flex-col gap-1 text-xs font-medium">
                        Type CORRECT
                        <input name="confirm" className="h-9 w-28 rounded-lg border border-border bg-background px-2 text-sm" />
                      </label>
                      <button type="submit" className="h-9 rounded-lg border border-border px-3 text-sm">Correct</button>
                    </form>
                  ) : null}
                  <form action={erasePerson} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="q" value={q} />
                    <input type="hidden" name="kind" value={hit.kind} />
                    <input type="hidden" name="id" value={hit.id} />
                    <label className="flex flex-col gap-1 text-xs font-medium">
                      Type ERASE
                      <input name="confirm" className="h-9 w-28 rounded-lg border border-border bg-background px-2 text-sm" />
                    </label>
                    <button type="submit" className="h-9 rounded-lg border border-border px-3 text-sm">Erase</button>
                  </form>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Correction and erasure are for the owner and the legal coordinator.</p>
              )}
            </li>
          ))}
        </ul>
        {editor && bank && q ? (
          <form action={placePersonHold} className="flex flex-wrap items-end gap-2 rounded-xl border border-border px-4 py-4">
            <input type="hidden" name="q" value={q} />
            <label className="flex flex-col gap-1 text-sm font-medium">
              Reason for a legal hold
              <input name="reason" className="h-11 w-72 rounded-lg border border-border bg-background px-3 text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Type HOLD
              <input name="confirm" className="h-11 w-28 rounded-lg border border-border bg-background px-3 text-sm" />
            </label>
            <button type="submit" className="h-11 rounded-lg border border-border px-4 text-sm">Place legal hold</button>
          </form>
        ) : null}
        {holds.length > 0 ? (
          <section>
            <h2 className="font-serif text-2xl">Active legal holds</h2>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {holds.map((hold) => (
                <li key={hold.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                  <span>{hold.reason || "Legal hold"} · {hold.createdAt.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</span>
                  {editor ? (
                    <form action={releasePersonHold}>
                      <input type="hidden" name="id" value={hold.id} />
                      <button type="submit" className="underline">Release</button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <p className="text-xs text-muted-foreground">Kinds covered: {PERSON_KINDS.join(", ")}.</p>
      </main>
    </div>
  );
}
