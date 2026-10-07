// Firm staff only. The live-send switch is not shown to a bank viewer.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { LiveSendSwitchForm } from "@/components/live-send-switch-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { liveSendIsOn } from "@/lib/live-send-store";
import { canFlipLiveSend } from "@/lib/live-send-switch";
import { isOwnerAdmin } from "@/lib/owner-admin";
import { confirmWarning } from "@/lib/send-notice";
import { msg91AuthKey } from "@/lib/msg91";
import { OdrLiveForm, OdrTemplateForm } from "@/components/odr-settings-form";
import { odrKillSwitch, odrMessagesWarning } from "@/lib/odr-live";
import { readOdrRules } from "@/lib/odr-store";
import { ODR_TEMPLATES_HREF } from "@/lib/send-notice";
import { saveBankRetention, saveFirmPrivacy } from "@/app/actions/privacy";
import { workingBank } from "@/lib/bank-context";
import { DOWNLOADS_NOT_KEPT } from "@/lib/privacy-copy";
import { readBankRetention, readFirmPrivacy } from "@/lib/privacy-store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; privacy?: string; retention?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canFlipLiveSend(user.role)) redirect("/dashboard");

  const query = await searchParams;
  const enabled = await liveSendIsOn();
  const privacy = await readFirmPrivacy();
  const bank = workingBank(user);
  const retention = await readBankRetention(bank?.id ?? "");
  const field = "h-11 rounded-lg border border-border bg-background px-3 text-sm";
  const odrRules = await readOdrRules();
  const odrKilled = odrKillSwitch();
  const vendor = isOwnerAdmin(user);
  const warning = confirmWarning({
    switchOn: enabled,
    authKeySet: Boolean(msg91AuthKey()),
    technical: vendor,
  });
  const odrWarning = odrMessagesWarning({
    switchOn: odrRules.liveStored,
    killed: odrKilled,
    technical: vendor,
  });

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader user={user} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">Settings</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            Live send applies to the whole firm. Spreadsheets and people still stay on the bank you
            are working on.
          </p>
        </div>
        {query.saved === "1" ? (
          <p className="rounded-lg border border-border bg-card px-3 py-2 text-sm" role="status">
            Saved. {warning}
          </p>
        ) : null}
        {query.saved === "odr-send" ? (
          <p className="rounded-lg border border-border bg-card px-3 py-2 text-sm" role="status">
            Saved. {odrWarning}
          </p>
        ) : null}
        {query.saved === "odr" ? (
          <p className="rounded-lg border border-border bg-card px-3 py-2 text-sm" role="status">
            ODR settings saved. Notice sending was not changed.
          </p>
        ) : null}
        {query.saved === "privacy" ? (
          <p className="rounded-lg border border-border bg-card px-3 py-2 text-sm" role="status">
            Privacy contact saved.
          </p>
        ) : null}
        {query.saved === "retention" ? (
          <p className="rounded-lg border border-border bg-card px-3 py-2 text-sm" role="status">
            Retention schedule saved for this bank.
          </p>
        ) : null}
        {query.privacy === "invalid" || query.retention === "invalid" ? (
          <p className="rounded-lg border border-border bg-card px-3 py-2 text-sm" role="alert">
            Check the email, phone, and day counts. Days are 0 to 3650. Request replies are 1 to 365 days.
          </p>
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle>Live send is {enabled ? "on" : "off"}</CardTitle>
            <CardDescription>{warning}</CardDescription>
          </CardHeader>
          <CardContent>
            <LiveSendSwitchForm enabled={enabled} technical={vendor} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>ODR messages are {odrRules.liveStored ? "on" : "off"}</CardTitle>
            <CardDescription>{odrWarning} This does not change notice sending.</CardDescription>
          </CardHeader>
          <CardContent>
            <OdrLiveForm enabled={odrRules.liveStored} killed={odrKilled} technical={vendor} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>ODR templates and reminders</CardTitle>
            <CardDescription>A channel without an approved template is recorded and not sent. Send hours also hold a legal notice that is confirmed outside the window.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <OdrTemplateForm rules={odrRules} showIds={vendor} />
            <p className="text-sm leading-6">
              <Link href={ODR_TEMPLATES_HREF} className="underline">
                Approved wording is on ODR templates.
              </Link>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Privacy contact</CardTitle>
            <CardDescription>
              Shown on the privacy notice. A blank name is shown as Privacy officer, Being Vakil Associates.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={saveFirmPrivacy} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-sm font-medium">
                Officer name
                <input name="officerName" defaultValue={privacy.officerName} className={field} />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Email
                <input name="officerEmail" type="email" required defaultValue={privacy.officerEmail} className={field} />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Phone
                <input name="officerPhone" required defaultValue={privacy.officerPhone} className={field} />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Days to answer a privacy request
                <input name="requestDueDays" type="number" min={1} max={365} required defaultValue={privacy.requestDueDays} className={field} />
              </label>
              <button type="submit" className="h-11 w-fit rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
                Save privacy contact
              </button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Retention for {bank?.name ?? "the working bank"}</CardTitle>
            <CardDescription>
              Zero days leaves that category in place. A legal hold stops this schedule and blocks erasure. Access logs stay at least one year. {DOWNLOADS_NOT_KEPT}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {bank ? (
              <form action={saveBankRetention} className="flex flex-col gap-4">
                <RetentionField name="closedCaseDays" label="Closed cases (days)" value={retention.closedCaseDays} />
                <RetentionField name="messageDays" label="Messages (days)" value={retention.messageDays} />
                <RetentionField name="documentDays" label="PDFs and documents (days)" value={retention.documentDays} />
                <RetentionField name="publicNoticeDays" label="Public notices (days)" value={retention.publicNoticeDays} />
                <RetentionField name="campaignDays" label="Campaign rows (days)" value={retention.campaignDays} />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="legalHold" value="yes" defaultChecked={retention.legalHold} className="size-4 accent-primary" />
                  Legal hold for this bank
                </label>
                <button type="submit" className="h-11 w-fit rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
                  Save retention
                </button>
              </form>
            ) : (
              <p className="text-sm">Choose a bank on Banks before setting a schedule.</p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function RetentionField({ name, label, value }: { name: string; label: string; value: number }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <input name={name} type="number" min={0} max={3650} required defaultValue={value} className="h-11 w-40 rounded-lg border border-border bg-background px-3 text-sm" />
    </label>
  );
}
