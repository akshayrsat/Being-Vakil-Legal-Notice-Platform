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

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canFlipLiveSend(user.role)) redirect("/dashboard");

  const query = await searchParams;
  const enabled = await liveSendIsOn();
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
      </main>
    </div>
  );
}
