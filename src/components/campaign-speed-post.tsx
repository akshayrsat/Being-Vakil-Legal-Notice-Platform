import Link from "next/link";
import { MarkSpeedPostForm } from "@/components/speed-post-forms";
import { PostalStatus } from "@/components/postal-status";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { loanSearchHref } from "@/lib/loan-timeline";

export async function CampaignSpeedPost({
  campaignId,
  bankId,
  canManage,
  viewOnly = false,
  people,
}: {
  campaignId: string;
  bankId: string;
  canManage: boolean;
  viewOnly?: boolean;
  people: Array<{
    recipientRowId: string;
    customerName: string;
    loanNumber: string;
    customerId: string;
    noticeNumber: string;
  }>;
}) {
  const consignments = await prisma.speedPostConsignment.findMany({
    where: { campaignId, bankId },
    orderBy: { customerName: "asc" },
  });
  const byRecipient = new Map(consignments.map((row) => [row.recipientRowId, row]));
  const shown = people.slice(0, 40);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Speed Post</CardTitle>
        <CardDescription>
          {viewOnly
            ? "Postal status recorded for this notice."
            : "Physical dispatch sits beside SMS, email, and WhatsApp. Mark a person, then enter the article number on the consignment."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          {consignments.length === 0
            ? "Nobody on this send is marked as Speed Post yet."
            : `${consignments.length} ${consignments.length === 1 ? "consignment" : "consignments"} on this send.`}
        </p>
        {canManage ? <MarkSpeedPostForm campaignId={campaignId} label="Mark everyone on this send" /> : null}
        {shown.length === 0 ? null : (
          <ul className="flex flex-col gap-3">
            {shown.map((person) => {
              const consignment = byRecipient.get(person.recipientRowId);
              const loanHref = loanSearchHref(bankId, person.loanNumber, person.customerId);
              return (
                <li key={person.recipientRowId} className="rounded-lg px-3 py-3 ring-1 ring-foreground/10">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{person.customerName}</p>
                      <p className="text-sm text-muted-foreground">
                        {person.loanNumber || "No loan number"}
                        {person.noticeNumber ? ` · ${person.noticeNumber}` : ""}
                      </p>
                    </div>
                    {consignment ? <PostalStatus status={consignment.status} /> : null}
                  </div>
                  {consignment ? (
                    <p className="mt-2 text-sm">
                      {consignment.articleNumber || "Article number not entered"}
                      {viewOnly ? null : (
                        <>
                          <span className="mx-2 text-muted-foreground">·</span>
                          <Link href={`/speed-post/${consignment.id}?bank=${encodeURIComponent(bankId)}`} className="underline">
                            Open consignment
                          </Link>
                        </>
                      )}
                    </p>
                  ) : canManage ? (
                    <div className="mt-2">
                      <MarkSpeedPostForm
                        campaignId={campaignId}
                        recipientRowId={person.recipientRowId}
                        label="Mark as Speed Post"
                      />
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">Not marked as Speed Post.</p>
                  )}
                  {!viewOnly && loanHref ? (
                    <p className="mt-2 text-sm">
                      <Link href={loanHref} className="underline">
                        Loan timeline
                      </Link>
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {people.length > shown.length ? (
          <p className="text-sm text-muted-foreground">
            {viewOnly
              ? `Showing the first ${shown.length} people.`
              : `Showing the first ${shown.length} people. The full list is on Speed Post.`}
          </p>
        ) : null}
        {viewOnly ? null : (
          <Link href={`/speed-post?bank=${bankId}&campaign=${campaignId}`} className="text-sm underline">
            All Speed Post for this send
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
