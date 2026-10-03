// Review a send, then confirm it. After confirm, each person keeps a channel and a status.
// A dry run stores a result and does not call MSG91. It is never labelled delivered.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { BackLinks } from "@/components/back-link";
import { CampaignSpeedPost } from "@/components/campaign-speed-post";
import { ConfirmCampaign } from "@/components/confirm-campaign";
import { SendSteps } from "@/components/send-steps";
import { MessageOpened, NoticeLinkOpened } from "@/components/notice-link-opened";
import { NoticeOpenLink } from "@/components/notice-open-link";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { campaignWhere } from "@/lib/bank-data";
import { workingBank } from "@/lib/bank-context";
import { backToCampaigns, backToSearch, backToSpreadsheet } from "@/lib/desk-back";
import { isSendChannel, parseSendChannels, SEND_CHANNELS } from "@/lib/campaign-plan";
import {
  campaignStatusLabel,
  countByChannel,
  deliveryStatusChoices,
  deliveryStatusLabel,
  isDeliveryStatus,
  labelsForChannels,
  sendChannelLabel,
  statusesForFilter,
} from "@/lib/campaigns";
import { prisma } from "@/lib/db";
import { confirmSendsForReal } from "@/lib/live-send-switch";
import { liveSendIsOn } from "@/lib/live-send-store";
import { msg91AuthKey } from "@/lib/msg91";
import { confirmWarning } from "@/lib/send-notice";
import { personHistoryHref } from "@/lib/delivery-report";
import { loanSearchHref } from "@/lib/loan-timeline";
import { noticeLinkOpensByNumber } from "@/lib/public-notice";
import { scopedBankId, withBank } from "@/lib/report-bank";
import { isOwnerAdmin } from "@/lib/owner-admin";
import { canSendNotices, isBankUser } from "@/lib/roles";
import { hideVendorWording } from "@/lib/staff-language";

export const metadata: Metadata = {
  title: "Review send",
};

const SAMPLE_COUNT = 3;
const TABLE_LIMIT = 50;

export default async function CampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ done?: string; channel?: string; status?: string; bank?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const working = workingBank(user);
  const { id } = await params;
  const query = await searchParams;
  const isAdmin = canSendNotices(user.role);
  const technical = isOwnerAdmin(user);
  const bankUser = isBankUser(user.role);
  const scope = scopedBankId(user, query.bank);
  const channelFilter = isSendChannel((query.channel ?? "").toUpperCase())
    ? (query.channel ?? "").toUpperCase()
    : "";
  const statusFilter = isDeliveryStatus((query.status ?? "").toUpperCase())
    ? (query.status ?? "").toUpperCase()
    : "";

  const campaign = scope
    ? await prisma.campaign.findFirst({
        where: campaignWhere(scope, id),
        include: {
          bank: { select: { id: true, name: true, code: true, active: true, attachNoticePdf: true } },
          batch: { select: { fileName: true, rowCount: true } },
          followsCampaign: { select: { id: true, templateName: true, bankId: true } },
          followUps: {
            where: { bankId: scope, ...(bankUser ? { status: { not: "REVIEW" } } : {}) },
            select: { id: true, templateName: true, status: true, mode: true },
            orderBy: { createdAt: "desc" },
          },
          deliveries: {
            where: { bankId: scope },
            orderBy: [{ rowNumber: "asc" }, { channel: "asc" }],
          },
        },
      })
    : null;

  if (bankUser && campaign?.status === "REVIEW") redirect("/deliveries");

  if (!campaign) {
    return (
      <div className="flex min-h-full flex-col">
        <AppHeader user={user} />
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-8 sm:px-6">
          <BackLinks links={[backToCampaigns()]} />
          <h1 className="font-serif text-3xl">Send not found</h1>
          <p className="leading-7 text-muted-foreground">
            That send is not under a bank this login can see.
          </p>
        </main>
      </div>
    );
  }

  const channels = parseSendChannels(campaign.channels);
  const counts = countByChannel(campaign.deliveries);
  const people = new Set(campaign.deliveries.map((row) => row.recipientRowId)).size;
  const samples: typeof campaign.deliveries = [];
  const seen = new Set<string>();
  for (const row of campaign.deliveries) {
    if (!row.messageText || seen.has(row.recipientRowId)) continue;
    seen.add(row.recipientRowId);
    samples.push(row);
    if (samples.length === SAMPLE_COUNT) break;
  }
  const switchOn = await liveSendIsOn();
  const willSend = confirmSendsForReal({
    switchOn,
    preparedLive: campaign.mode === "LIVE",
    authKeySet: Boolean(msg91AuthKey()),
  });
  const dryRun = !willSend;
  const waiting = campaign.status === "REVIEW";
  const warning = confirmWarning({
    switchOn,
    authKeySet: Boolean(msg91AuthKey()),
    technical,
  });
  const canManage = isAdmin && working?.id === campaign.bankId && campaign.bank.active;
  const matching = campaign.deliveries.filter((row) => {
    if (channelFilter && row.channel !== channelFilter) return false;
    if (statusFilter && !statusesForFilter(statusFilter).includes(row.status)) return false;
    return true;
  });
  const shown = matching.slice(0, TABLE_LIMIT);
  const linkOpens = await noticeLinkOpensByNumber(
    shown.map((row) => row.noticeNumber),
    campaign.bankId,
  );
  const exportQuery = new URLSearchParams();
  exportQuery.set("bank", campaign.bankId);
  if (channelFilter) exportQuery.set("channel", channelFilter);
  if (statusFilter) exportQuery.set("status", statusFilter);
  const exportHref = `/campaigns/${campaign.id}/export?${exportQuery.toString()}`;
  const sameBank = (bankId: string) => bankId === campaign.bankId;

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader user={user} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <BackLinks
          links={
            bankUser
              ? [backToSearch(campaign.bankId)]
              : [backToCampaigns(), backToSpreadsheet(campaign.batchId)]
          }
        />
        {bankUser ? null : <SendSteps current={waiting ? 3 : 4} />}
        <div>
          <p className="text-sm text-muted-foreground">{campaign.bank.name}</p>
          <h1 className="mt-1 font-serif text-4xl tracking-tight">
            {waiting ? "Review who will get it" : "Who was included"}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {campaignStatusLabel(campaign.status, campaign.mode, technical)}
            <span className="mx-2">·</span>
            {labelsForChannels(channels) || "No channel"}
          </p>
        </div>

        {isAdmin && working?.id !== campaign.bankId ? (
          <p className="text-sm text-muted-foreground">
            You are working on {working?.name ?? "no bank"}. This send belongs to {campaign.bank.name}.
            Switch to that bank before confirming it or preparing a follow-up.
          </p>
        ) : null}

        {query.done === "1" ? (
          <p className="rounded-lg border border-border bg-card px-3 py-2 text-sm" role="status">
            {hideVendorWording(
              dryRun
                ? "Dry run finished. Nothing was sent."
                : "The send was handed to MSG91 for the people who were not skipped.",
              technical,
            )}
          </p>
        ) : null}

        {campaign.followsCampaign ? (
          <p className="text-sm">
            Follow-up to{" "}
            {sameBank(campaign.followsCampaign.bankId) ? (
              <Link href={withBank(`/campaigns/${campaign.followsCampaign.id}`, campaign.bankId)} className="underline">
                {campaign.followsCampaign.templateName}
              </Link>
            ) : (
              campaign.followsCampaign.templateName
            )}
            . The same loan number, customer id, or mobile ties these sends together.
          </p>
        ) : null}

        {campaign.followUps.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Follow-ups</CardTitle>
              <CardDescription>
                Later sends prepared for people who were skipped or failed on this one.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2 text-sm">
                {campaign.followUps.map((followUp) => (
                  <li key={followUp.id}>
                    <Link href={withBank(`/campaigns/${followUp.id}`, campaign.bankId)} className="font-medium underline">
                      {followUp.templateName}
                    </Link>
                    <span className="text-muted-foreground">
                      {" "}
                      · {campaignStatusLabel(followUp.status, followUp.mode, technical)}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>{campaign.templateName}</CardTitle>
            <CardDescription>
              {campaign.batch.fileName}. {people} {people === 1 ? "person" : "people"} in this send.
              {technical && campaign.dltTemplateId ? ` DLT id ${campaign.dltTemplateId}.` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm leading-6">
            <p>{hideVendorWording(dryRun ? campaign.dryRunNote || warning : warning, technical)}</p>
            <ul className="flex flex-col gap-1">
              {counts.map((count) => (
                <li key={count.channel}>
                  {sendChannelLabel(count.channel)}: {count.ready} ready, {count.skipped} skipped.
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground">
              {bankUser
                ? "Delivery status for this notice is listed below. Speed Post status is included when it was recorded for this send."
                : (
                  <>
                    Speed Post is tracked on its own card.{" "}
                    {hideVendorWording("A dry run still does not call MSG91.", technical)}
                    {campaign.bank.attachNoticePdf
                      ? " Live emails for this bank also attach a PDF. The notice link stays in the message."
                      : " Notice PDFs are off for this bank. Turn them on under Banks if a live email should carry the letter."}
                  </>
                )}
            </p>
            <div className="flex flex-wrap gap-2">
              {bankUser ? null : (
                <Link
                  href={withBank(`/campaigns/${campaign.id}/reminders`, campaign.bankId)}
                  className={buttonVariants({ variant: "outline", className: "h-11 px-4" })}
                >
                  Reminders
                </Link>
              )}
              <Link
                href={exportHref}
                className={buttonVariants({ variant: "outline", className: "h-11 px-4" })}
              >
                Download CSV
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sample messages</CardTitle>
            <CardDescription>
              The first {samples.length} {samples.length === 1 ? "person" : "people"} with a message.
              An SMS uses the notice number in the public link. Open notice shows that person’s page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {samples.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nobody on this file can be reached on the channels you ticked.
              </p>
            ) : (
              <ul className="flex flex-col gap-4">
                {samples.map((row) => (
                  <li key={row.recipientRowId} className="rounded-lg ring-1 ring-foreground/10">
                    <div className="border-b border-border px-3 py-2">
                      <p className="font-medium">{row.customerName}</p>
                      <p className="text-sm text-muted-foreground">
                        Row {row.rowNumber}
                        {row.loanNumber ? ` · ${row.loanNumber}` : ""}
                        {row.noticeNumber ? ` · ${row.noticeNumber}` : ""}
                      </p>
                      <NoticeOpenLink noticeNumber={row.noticeNumber} />
                    </div>
                    <p className="px-3 py-3 text-sm leading-6 whitespace-pre-wrap">
                      {hideVendorWording(row.messageText, technical)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <CampaignSpeedPost
          campaignId={campaign.id}
          bankId={campaign.bankId}
          canManage={canManage}
          viewOnly={bankUser}
          people={campaign.deliveries
            .filter((row, index, list) => list.findIndex((item) => item.recipientRowId === row.recipientRowId) === index)
            .map((row) => ({
              recipientRowId: row.recipientRowId,
              customerName: row.customerName,
              loanNumber: row.loanNumber,
              customerId: row.customerId,
              noticeNumber: row.noticeNumber,
            }))}
        />

        {waiting && canManage ? (
          <section className="flex flex-col gap-3" aria-labelledby="send-step">
            <h2 id="send-step" className="font-serif text-2xl">
              4. Send
            </h2>
            <ConfirmCampaign campaignId={campaign.id} dryRun={dryRun} technical={technical} />
          </section>
        ) : null}
        {waiting && isAdmin && !canManage ? (
          <p className="text-sm text-muted-foreground">
            This send is still waiting. Confirm it only while you are working on {campaign.bank.name}
            {campaign.bank.active ? "." : ", and only after that bank is marked active."}
          </p>
        ) : null}
        {waiting && !isAdmin ? (
          <p className="text-sm text-muted-foreground">This send has not been confirmed. You cannot confirm it.</p>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>People</CardTitle>
            <CardDescription>
              Showing {shown.length} of {matching.length} channel{" "}
              {matching.length === 1 ? "row" : "rows"}
              {matching.length !== campaign.deliveries.length
                ? ` (${campaign.deliveries.length} in this send).`
                : "."}{" "}
              {technical
                ? "A dry run stays Dry run. It is not called delivered."
                : "Not sent stays not sent. It is not called delivered."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <form action={`/campaigns/${campaign.id}`} method="get" className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="bank" value={campaign.bankId} />
              <label className="flex flex-col gap-1 text-sm font-medium">
                Channel
                <select
                  name="channel"
                  defaultValue={channelFilter}
                  className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal"
                >
                  <option value="">All channels</option>
                  {SEND_CHANNELS.map((channel) => (
                    <option key={channel} value={channel}>
                      {sendChannelLabel(channel)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Status
                <select
                  name="status"
                  defaultValue={statusFilter === "SENT" ? "DELIVERED" : statusFilter}
                  className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal"
                >
                  <option value="">All statuses</option>
                  {deliveryStatusChoices(technical).map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className={buttonVariants({ variant: "outline", className: "h-11 px-4" })}
                >
                  Filter
                </button>
              </div>
            </form>
            {shown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No rows match this filter.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-2 py-2 font-medium">Name</th>
                      <th className="px-2 py-2 font-medium">Loan</th>
                      <th className="px-2 py-2 font-medium">Channel</th>
                      <th className="px-2 py-2 font-medium">Status</th>
                      <th className="px-2 py-2 font-medium">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((row) => {
                      const history = personHistoryHref(row, campaign.bankId);
                      const loanHref = loanSearchHref(campaign.bankId, row.loanNumber, row.customerId);
                      return (
                        <tr key={row.id} className="border-b border-border">
                          <td className="px-2 py-2">
                            <p className="font-medium">{row.customerName}</p>
                            <p className="text-muted-foreground">{row.mobile || row.email || "—"}</p>
                            <NoticeOpenLink noticeNumber={row.noticeNumber} />
                          </td>
                          <td className="px-2 py-2">
                            <p>{row.loanNumber || "—"}</p>
                            <p className="text-muted-foreground">{row.customerId}</p>
                          </td>
                          <td className="px-2 py-2">{sendChannelLabel(row.channel)}</td>
                          <td className="px-2 py-2">
                            <p>{deliveryStatusLabel(row.status, technical)}</p>
                            <MessageOpened openedAt={row.openedAt} />
                            <NoticeLinkOpened open={linkOpens.get(row.noticeNumber)} />
                          </td>
                          <td className="px-2 py-2 text-muted-foreground">
                            <p>{hideVendorWording(row.detail, technical) || "—"}</p>
                            {!bankUser && loanHref ? (
                              <Link href={loanHref} className="underline">
                                Loan timeline
                              </Link>
                            ) : null}
                            {history ? (
                              <Link href={history} className="mt-1 block underline">
                                Channel history
                              </Link>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <BackLinks
          links={
            bankUser
              ? [backToSearch(campaign.bankId)]
              : [backToCampaigns(), backToSpreadsheet(campaign.batchId)]
          }
        />
      </main>
    </div>
  );
}
