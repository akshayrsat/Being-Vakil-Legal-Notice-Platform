import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DeskShell } from "@/components/desk-shell";
import { PostalStatus } from "@/components/postal-status";
import { ArticleForm, RefreshSpeedPostForm, StatusForm } from "@/components/speed-post-forms";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loanSearchHref } from "@/lib/loan-timeline";
import { indiaPostConfigured, postalStatusLabel } from "@/lib/postal";
import { canReadBank } from "@/lib/report-bank";
import { ROLE_ADMIN } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Consignment",
};

export default async function SpeedPostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const consignment = await prisma.speedPostConsignment.findUnique({
    where: { id },
    include: {
      bank: { select: { name: true } },
      events: { orderBy: { occurredAt: "asc" } },
    },
  });
  if (!consignment || !canReadBank(user, consignment.bankId)) {
    return (
      <DeskShell user={user}>
        <h1 className="font-serif text-3xl">Consignment not found</h1>
        <p className="text-muted-foreground">That Speed Post record is not under a bank this login can see.</p>
        <Link href="/speed-post" className={buttonVariants({ variant: "outline", className: "h-11 w-fit px-4" })}>
          Back to Speed Post
        </Link>
      </DeskShell>
    );
  }

  const isAdmin = user.role === ROLE_ADMIN;
  const loanHref = loanSearchHref(consignment.bankId, consignment.loanNumber, consignment.customerId);

  return (
    <DeskShell user={user}>
      <div>
        <p className="text-sm text-muted-foreground">{consignment.bank.name}</p>
        <h1 className="mt-1 font-serif text-4xl tracking-tight">{consignment.customerName || "Speed Post"}</h1>
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <PostalStatus status={consignment.status} />
          <span>{consignment.articleNumber || "No article number yet"}</span>
          {consignment.loanNumber ? <span>· Loan {consignment.loanNumber}</span> : null}
          {consignment.noticeNumber ? <span>· Notice {consignment.noticeNumber}</span> : null}
        </p>
      </div>

      {consignment.note ? <p className="text-sm leading-6">{consignment.note}</p> : null}

      <div className="flex flex-wrap gap-2">
        {loanHref ? (
          <Link href={loanHref} className={buttonVariants({ variant: "outline", className: "h-11 px-4" })}>
            Loan timeline
          </Link>
        ) : null}
        {consignment.campaignId ? (
          <Link
            href={`/campaigns/${consignment.campaignId}`}
            className={buttonVariants({ variant: "outline", className: "h-11 px-4" })}
          >
            Open send
          </Link>
        ) : null}
      </div>

      {isAdmin ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Article number</CardTitle>
              <CardDescription>India Post Speed Post numbers look like EK123456789IN.</CardDescription>
            </CardHeader>
            <CardContent>
              <ArticleForm consignmentId={consignment.id} articleNumber={consignment.articleNumber} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Add a status</CardTitle>
              <CardDescription>Booked, in transit, out for delivery, delivered, or returned.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <StatusForm consignmentId={consignment.id} />
              <RefreshSpeedPostForm consignmentId={consignment.id} />
              <p className="text-sm text-muted-foreground">
                {indiaPostConfigured()
                  ? "Refresh asks the configured India Post endpoint and appends the events it returns."
                  : "Refresh stays off until INDIA_POST_API_BASE_URL and INDIA_POST_API_KEY are both set. Nothing is invented in their place."}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">You can read this consignment. Firm staff update the status.</p>
      )}

      <section>
        <h2 className="font-serif text-2xl">Status history</h2>
        {consignment.events.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No status events yet.</p>
        ) : (
          <ol className="mt-4 flex flex-col gap-3">
            {consignment.events.map((event) => (
              <li key={event.id} className="rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{postalStatusLabel(event.status)}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(event.occurredAt)}
                  </p>
                </div>
                {event.note ? <p className="mt-1 text-sm leading-6">{event.note}</p> : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  {event.source === "csv" ? "CSV import" : event.source === "india-post" ? "India Post API" : "Entered by staff"}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <Link
        href={`/speed-post?bank=${consignment.bankId}`}
        className={buttonVariants({ variant: "outline", className: "h-11 w-fit px-4" })}
      >
        Back to Speed Post
      </Link>
    </DeskShell>
  );
}
