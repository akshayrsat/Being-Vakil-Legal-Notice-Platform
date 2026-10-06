import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OdrBackLink } from "@/components/odr-back-link";
import { DeskShell } from "@/components/desk-shell";
import { OdrSendProgress } from "@/components/odr-send-progress";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { workingBank } from "@/lib/bank-context";
import { prisma } from "@/lib/db";
import { deliveryStatusLabel } from "@/lib/campaigns";
import { hideVendorWording, seesVendorDetail } from "@/lib/staff-language";
import { backToOdr } from "@/lib/odr-back";
import { canSendNotices } from "@/lib/roles";

export const metadata: Metadata = { title: "ODR send" };

export default async function OdrBatchPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canSendNotices(user.role)) redirect("/odr/cases");
  const bank = workingBank(user);
  if (!bank) redirect("/odr");
  const { id } = await params;
  const batch = await prisma.odrBatch.findFirst({
    where: { id, bankId: bank.id },
    include: {
      cases: {
        orderBy: { rowNumber: "asc" },
        include: { messages: true, hearings: true },
      },
    },
  });
  if (!batch) notFound();
  const technical = seesVendorDetail(user);
  const messages = batch.cases.flatMap((item) => item.messages);
  const pending = batch.cases.reduce(
    (sum, item) => sum + item.hearings.filter((hearing) => !hearing.meetLink && !hearing.meetError).length,
    0,
  ) + messages.filter((message) => message.status === "QUEUED" || message.status === "SENDING").length;
  const skipped = messages.filter((message) => message.status === "SKIPPED").length;
  const ready = messages.filter((message) => message.status === "SENT" || message.status === "DELIVERED").length;
  const failed = messages.filter((message) => message.status === "FAILED").length;

  return (
    <DeskShell user={user}>
      <OdrBackLink target={backToOdr()} />
      <div>
        <h1 className="font-serif text-4xl tracking-tight">{batch.fileName}</h1>
        <p className="mt-3 text-base text-muted-foreground">{batch.cases.length} cases for {bank.name}.</p>
      </div>
      <OdrSendProgress
        batchId={batch.id}
        initial={{ done: pending === 0, pending, ready, skipped, failed, note: pending === 0 ? "Finished." : "Starting." }}
      />
      <div className="overflow-x-auto rounded-lg ring-1 ring-foreground/10">
        <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
          <thead className="bg-muted/70">
            <tr>
              <th className="px-3 py-2 font-medium">Ref</th>
              <th className="px-3 py-2 font-medium">Customer</th>
              <th className="px-3 py-2 font-medium">SMS</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">WhatsApp</th>
            </tr>
          </thead>
          <tbody>
            {batch.cases.map((item) => (
              <tr key={item.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <Link href={`/odr/cases/${item.id}`} className="font-medium underline">
                    {item.refNo}
                  </Link>
                </td>
                <td className="px-3 py-2">{item.customerName}</td>
                {(["SMS", "EMAIL", "WHATSAPP"] as const).map((channel) => {
                  const message = item.messages.find((row) => row.channel === channel);
                  return (
                    <td key={channel} className="px-3 py-2">
                      {message ? deliveryStatusLabel(message.status, technical) : "—"}
                      <p className="text-muted-foreground">{hideVendorWording(message?.detail ?? "", technical)}</p>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Link href="/odr/cases" className={buttonVariants({ variant: "outline", className: "h-11 w-fit px-4" })}>
        Open the case list
      </Link>
    </DeskShell>
  );
}
