import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { updatePrivacyRequestStatus } from "@/app/actions/privacy";
import { AppHeader } from "@/components/app-header";
import { getCurrentUser } from "@/lib/auth";
import { workingBank } from "@/lib/bank-context";
import { maskContact } from "@/lib/mask";
import { canEditPrivacyRequests, canReadPrivacyRequests, privacyRequestKindLabel, privacyRequestStatusLabel } from "@/lib/privacy-access";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Privacy requests" };

function when(date: Date): string {
  return date.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
}

export default async function PrivacyRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; open?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canReadPrivacyRequests(user.role)) redirect("/dashboard");
  const query = await searchParams;
  const bank = workingBank(user);
  const scoped = !canEditPrivacyRequests(user.role);
  const rows = await prisma.privacyRequest.findMany({
    where: scoped && bank ? { bankId: bank.id } : {},
    orderBy: { dueAt: "asc" },
    take: 200,
  });
  const open = rows.find((row) => row.id === query.open) ?? null;
  const editor = canEditPrivacyRequests(user.role);

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader user={user} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">Privacy requests</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            {scoped
              ? "Requests for your bank. You can read them. Status is changed by the firm."
              : "Requests from people. The due date starts from the firm setting, which defaults to 30 days."}
          </p>
        </div>
        {query.saved === "1" ? <p className="rounded-lg border border-border bg-card px-3 py-2 text-sm">Status saved.</p> : null}
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">No requests yet.</p> : null}
        <div className="overflow-x-auto rounded-lg ring-1 ring-foreground/10">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead className="bg-muted/70">
              <tr>
                <th className="px-3 py-2 font-medium">Person</th>
                <th className="px-3 py-2 font-medium">Request</th>
                <th className="px-3 py-2 font-medium">Bank</th>
                <th className="px-3 py-2 font-medium">Due</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <p className="font-medium">{row.requesterName}</p>
                    <p className="text-muted-foreground">{maskContact(row.mobile, row.email)}</p>
                    <Link href={`/privacy/requests?open=${row.id}`} className="underline">
                      Open
                    </Link>
                  </td>
                  <td className="px-3 py-2">{privacyRequestKindLabel(row.kind)}</td>
                  <td className="px-3 py-2">{row.bankName || "—"}</td>
                  <td className="px-3 py-2">{when(row.dueAt)}</td>
                  <td className="px-3 py-2">
                    {editor ? (
                      <form action={updatePrivacyRequestStatus} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="id" value={row.id} />
                        <select name="status" defaultValue={row.status} className="h-9 rounded-lg border border-border bg-background px-2 text-sm">
                          <option value="OPEN">Open</option>
                          <option value="IN_PROGRESS">In progress</option>
                          <option value="DONE">Done</option>
                        </select>
                        <button type="submit" className="h-9 rounded-lg border border-border px-3 text-sm">
                          Save
                        </button>
                      </form>
                    ) : (
                      privacyRequestStatusLabel(row.status)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {open ? (
          <section className="rounded-xl border border-border bg-card px-5 py-5">
            <h2 className="font-serif text-2xl">{open.requesterName}</h2>
            <p className="mt-2 text-sm leading-6">
              {privacyRequestKindLabel(open.kind)} · due {when(open.dueAt)} · {privacyRequestStatusLabel(open.status)}
            </p>
            <p className="mt-2 text-sm leading-6">
              {open.email || "No email"} · {open.mobile || "No mobile"}
              {open.accountHint ? ` · Account hint ${open.accountHint}` : ""}
            </p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{open.detail}</p>
          </section>
        ) : null}
      </main>
    </div>
  );
}
