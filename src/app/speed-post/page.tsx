import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DeskShell } from "@/components/desk-shell";
import { EmptyState } from "@/components/empty-state";
import { ImportSpeedPostForm } from "@/components/speed-post-forms";
import { PostalStatus } from "@/components/postal-status";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { workingBank } from "@/lib/bank-context";
import { prisma } from "@/lib/db";
import { indiaPostConfigured, isPostalStatus, POSTAL_STATUS_OPTIONS } from "@/lib/postal";
import { resolveReportBank } from "@/lib/report-bank";
import { ROLE_ADMIN } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Speed Post",
};

export default async function SpeedPostPage({
  searchParams,
}: {
  searchParams: Promise<{ bank?: string; q?: string; status?: string; campaign?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const query = await searchParams;
  const bank = await resolveReportBank(user, query.bank ?? workingBank(user)?.id ?? "");
  const isAdmin = user.role === ROLE_ADMIN;
  const status = isPostalStatus((query.status ?? "").toUpperCase()) ? (query.status ?? "").toUpperCase() : "";
  const text = (query.q ?? "").trim().slice(0, 80);
  const campaignId = (query.campaign ?? "").trim();

  return (
    <DeskShell user={user}>
      <div>
        <h1 className="font-serif text-4xl tracking-tight">Speed Post</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
          {bank
            ? `Physical notices for ${bank.name}. Enter an article number, or import a CSV. Status stays on the consignment over time.`
            : "Choose a bank before looking at Speed Post."}
        </p>
      </div>

      {!bank ? (
        <EmptyState title="No bank selected">
          {isAdmin ? "Open Banks and press Use this bank." : "This login is not linked to a bank."}
        </EmptyState>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {indiaPostConfigured()
              ? "An India Post API is configured. Open a consignment to refresh it."
              : "No India Post API is configured. Update status by hand, or import a CSV. A later API can use the same consignments."}
          </p>
          <form action="/speed-post" method="get" className="grid gap-3 sm:grid-cols-3">
            <input type="hidden" name="bank" value={bank.id} />
            <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
              Article, loan, or name
              <input
                name="q"
                defaultValue={text}
                placeholder="EK123456789IN or LN10021"
                className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Status
              <select
                name="status"
                defaultValue={status}
                className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal"
              >
                <option value="">All statuses</option>
                {POSTAL_STATUS_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <button type="submit" className={buttonVariants({ variant: "outline", className: "h-11 px-4" })}>
                Filter
              </button>
            </div>
          </form>

          {isAdmin ? (
            <Card>
              <CardHeader>
                <CardTitle>Import a CSV</CardTitle>
                <CardDescription>
                  Columns: article_number, notice_number, loan_number, status, note, occurred_at. A sample file is samples/speed-post-import.csv.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ImportSpeedPostForm />
              </CardContent>
            </Card>
          ) : null}

          <ConsignmentList bankId={bank.id} text={text} status={status} campaignId={campaignId} />
        </>
      )}
    </DeskShell>
  );
}

async function ConsignmentList({
  bankId,
  text,
  status,
  campaignId,
}: {
  bankId: string;
  text: string;
  status: string;
  campaignId: string;
}) {
  const rows = await prisma.speedPostConsignment.findMany({
    where: {
      bankId,
      ...(status ? { status } : {}),
      ...(campaignId ? { campaignId } : {}),
      ...(text
        ? {
            OR: [
              { articleNumber: { contains: text.toUpperCase() } },
              { customerName: { contains: text } },
              { loanNumber: { contains: text } },
              { noticeNumber: { contains: text.toUpperCase() } },
              { customerId: { contains: text } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  if (rows.length === 0) {
    return (
      <EmptyState title="No Speed Post consignments">
        Open a campaign and mark people as Speed Post, or import article numbers from a CSV.
      </EmptyState>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg ring-1 ring-foreground/10">
      <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
        <thead className="bg-muted/70">
          <tr>
            <th className="px-3 py-2 font-medium">Person</th>
            <th className="px-3 py-2 font-medium">Article</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Updated</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-border">
              <td className="px-3 py-2">
                <Link href={`/speed-post/${row.id}`} className="font-medium underline">
                  {row.customerName || "Unnamed"}
                </Link>
                <p className="text-muted-foreground">{row.loanNumber || row.noticeNumber || "—"}</p>
              </td>
              <td className="px-3 py-2">{row.articleNumber || "Not entered"}</td>
              <td className="px-3 py-2">
                <PostalStatus status={row.status} />
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(row.updatedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
