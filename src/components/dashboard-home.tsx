// The page you see after sign-in. It shows your name, your role, and the current bank.

import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DEMO_NOTICES } from "@/lib/demo-notices";
import { describeRuntimeGates } from "@/lib/env";
import { msg91AuthKey } from "@/lib/msg91";
import { confirmWarning } from "@/lib/send-notice";
import { isWebhookConfigured } from "@/lib/msg91-webhook";
import type { SignedInUser } from "@/lib/auth";
import { noticePageHref } from "@/lib/notice-link";
import { workingBank } from "@/lib/bank-context";
import { isOwnerAdmin } from "@/lib/owner-admin";
import { bankStatusLabel } from "@/lib/banks";
import {
  canChooseBank,
  canCreateLogins,
  canSendNotices,
  isBankUser,
  isOwner,
  roleAccent,
  roleAudience,
  roleHeadline,
  roleSummary,
  roleTitle,
} from "@/lib/roles";

const accentClass = {
  admin: "border-primary bg-primary text-primary-foreground",
  viewer: "border-[#1a4a42] bg-[#1a4a42] text-[#f3f7f4]",
  unknown: "border-[#8a6232] bg-[#8a6232] text-[#fbf6ee]",
} as const;

export function DashboardHome({ user, liveSendOn }: { user: SignedInUser; liveSendOn: boolean }) {
  const accent = roleAccent(user.role);
  const title = roleTitle(user.role);
  const isAdmin = canSendNotices(user.role);
  const owner = isOwner(user.role);
  const vendor = isOwnerAdmin(user);
  const bankUser = isBankUser(user.role);
  const choosesBank = canChooseBank(user.role);
  const bank = workingBank(user);
  const gates = vendor
    ? describeRuntimeGates({
        authKeySet: Boolean(msg91AuthKey()),
        webhookConfigured: isWebhookConfigured(),
      })
    : null;

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader user={user} />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <div>
          <p className="text-sm text-muted-foreground">Signed in as</p>
          <h1 className="mt-1 font-serif text-4xl tracking-tight text-foreground">
            {user.name}
          </h1>
          <p className="mt-3 text-lg">{roleHeadline(user.role)}</p>
        </div>

        <Card
          className={`border-l-4 ${accent === "admin" ? "border-l-primary" : accent === "viewer" ? "border-l-[#1a4a42]" : "border-l-[#8a6232]"}`}
        >
          <CardHeader>
            <CardTitle>{isAdmin ? "Bank you are working on" : "Your bank"}</CardTitle>
            <CardDescription>
              {isAdmin
                ? "Spreadsheets and the people in them stay on this bank. Approved notice wording can be selected for any bank."
                : "This login can see only this bank."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {bank ? (
              <>
                <div>
                  <p className="font-serif text-3xl tracking-tight text-foreground">
                    {bank.name}
                  </p>
                  <p className="mt-2 text-base">
                    Short code <span className="font-medium">{bank.code}</span>
                    <span className="mx-2 text-muted-foreground">·</span>
                    {bankStatusLabel(bank.active)}
                  </p>
                </div>
                {!bank.active ? (
                  <p className="text-sm leading-6 text-muted-foreground">
                    {isAdmin
                      ? "This bank is inactive. You can still see it. Press Change bank, then Mark active, before filing new work under it."
                      : "This bank is marked inactive. You can still see it. Ask the firm if that is unexpected."}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-base leading-7">
                {isAdmin
                  ? "No bank is selected yet. Open Banks, then press Use this bank."
                  : "This login is not linked to a bank. Ask the firm administrator."}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {choosesBank ? (
                <Link
                  href="/banks"
                  className={buttonVariants({ variant: "outline", className: "h-11 w-fit px-4" })}
                >
                  {bank ? "Change bank" : "Choose a bank"}
                </Link>
              ) : null}
              {owner ? (
                <Link
                  href="/audit"
                  className={buttonVariants({ variant: "outline", className: "h-11 w-fit px-4" })}
                >
                  Security / Audit
                </Link>
              ) : null}
              {canCreateLogins(user.role) ? (
                <Link
                  href="/people"
                  className={buttonVariants({ variant: "outline", className: "h-11 w-fit px-4" })}
                >
                  Add a login
                </Link>
              ) : null}
              {bank && isAdmin ? (
                <Link
                  href="/send"
                  className={buttonVariants({ variant: "outline", className: "h-11 w-fit px-4" })}
                >
                  Send notice
                </Link>
              ) : null}
              {bank && isAdmin ? (
                <Link
                  href="/odr"
                  className={buttonVariants({ variant: "outline", className: "h-11 w-fit px-4" })}
                >
                  ODR
                </Link>
              ) : null}
              {bank && isAdmin ? (
                <Link
                  href="/templates"
                  className={buttonVariants({ variant: "outline", className: "h-11 w-fit px-4" })}
                >
                  Notice templates
                </Link>
              ) : null}
              {bank && isAdmin ? (
                <Link
                  href="/odr/templates"
                  className={buttonVariants({ variant: "outline", className: "h-11 w-fit px-4" })}
                >
                  ODR templates
                </Link>
              ) : null}
              {isAdmin ? (
                <Link
                  href="/legal-notices"
                  className={buttonVariants({ variant: "outline", className: "h-11 w-fit px-4" })}
                >
                  Legal notice templates
                </Link>
              ) : null}
              {owner ? (
                <Link
                  href="/settings"
                  className={buttonVariants({ variant: "outline", className: "h-11 w-fit px-4" })}
                >
                  Settings
                </Link>
              ) : null}
              {bank ? (
                <Link
                  href={`/deliveries?bank=${bank.id}`}
                  className={buttonVariants({ variant: "outline", className: "h-11 w-fit px-4" })}
                >
                  Find a person
                </Link>
              ) : null}
              {bank && isAdmin ? (
                <Link
                  href={`/speed-post?bank=${bank.id}`}
                  className={buttonVariants({ variant: "outline", className: "h-11 w-fit px-4" })}
                >
                  Speed Post
                </Link>
              ) : null}
              {bank ? (
                <Link
                  href={`/reports?bank=${bank.id}`}
                  className={buttonVariants({ variant: "outline", className: "h-11 w-fit px-4" })}
                >
                  Reports
                </Link>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${accent === "admin" ? "border-l-primary" : accent === "viewer" ? "border-l-[#1a4a42]" : "border-l-[#8a6232]"}`}>
          <CardHeader>
            <CardTitle>Your role</CardTitle>
            <CardDescription>
              This label is how the site will decide what you are allowed to do.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p
              className={`inline-flex w-fit items-center rounded-md px-3 py-2 text-base font-semibold ${accentClass[accent]}`}
            >
              {title}
              <span className="mx-2 font-normal opacity-70">·</span>
              <span className="font-medium">{roleAudience(user.role)}</span>
            </p>
            <p className="text-base leading-7 text-foreground">{roleSummary(user.role)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>This account</CardTitle>
            <CardDescription>Details stored for the person who just signed in.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-muted-foreground">Name</dt>
                <dd className="mt-1 font-medium">{user.name}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Email</dt>
                <dd className="mt-1 font-medium break-all">{user.email}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Role</dt>
                <dd className="mt-1 font-medium">
                  {title}
                  <span className="mt-0.5 block text-sm font-normal text-muted-foreground">
                    {roleAudience(user.role)}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Bank</dt>
                <dd className="mt-1 font-medium">
                  {bank ? (
                    <>
                      {bank.name}
                      <span className="mt-0.5 block text-sm font-normal text-muted-foreground">
                        {bank.code} · {bankStatusLabel(bank.active)}
                      </span>
                    </>
                  ) : isAdmin ? (
                    "None selected"
                  ) : (
                    "None linked"
                  )}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {bankUser ? null : (
        <Card>
          <CardHeader>
            <CardTitle>Practice notice pages</CardTitle>
            <CardDescription>
              These three pages are public. An SMS link uses the same notice number after a question mark.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm">
              {DEMO_NOTICES.map((notice) => (
                <li key={notice.noticeNumber}>
                  <Link href={noticePageHref(notice.noticeNumber)} prefetch={false} className="font-medium underline">
                    {notice.customerName}
                  </Link>
                  <span className="text-muted-foreground"> · {notice.noticeNumber}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        )}

        {gates ? (
          <Card>
            <CardHeader>
              <CardTitle>Send gates</CardTitle>
              <CardDescription>
                Live send is the switch in Settings. The other lines are server setup, and their
                secret values are not shown here.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm leading-6">
              <p>
                {confirmWarning({
                  switchOn: liveSendOn,
                  authKeySet: Boolean(msg91AuthKey()),
                })}
              </p>
              <p>
                {gates.webhookConfigured
                  ? "Delivery webhooks are accepted when the secret matches."
                  : "Delivery webhooks are refused until MSG91_WEBHOOK_SECRET is set to at least 8 characters."}
              </p>
              <p>
                {gates.indiaPostConfigured
                  ? "India Post tracking API is configured."
                  : "India Post tracking API is not configured. Speed Post uses manual status and CSV import."}
              </p>
              <p>
                {gates.entryGate
                  ? "Staff sign-in asks for the office entry code on the public page."
                  : "The office entry code is not active, so the staff door stays locked."}
              </p>
              {gates.entryCodeShort ? (
                <p>The entry code is shorter than 8 characters. Use a longer one before relying on it.</p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>This version</CardTitle>
            <CardDescription>Sign-in, banks, send notice, templates, public notice pages, Speed Post, loan history, reports, and an audit log are working.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="leading-7 text-foreground">
              {bankUser
                ? "You can look at notices already sent for your bank, see whether each one was delivered, and download that bank’s report. You cannot upload a spreadsheet or send a notice."
                : vendor
                  ? "The owner and a legal coordinator choose a bank and send a notice from that bank’s spreadsheet and the approved wording. They do not write templates here. They review who will get it, then confirm. Only the owner turns live send on or off in Settings. When it is off, confirming records a dry run and nothing is sent. When it is on, confirming sends through MSG91. The audit log names the person and their role."
                  : owner
                    ? "You can send a notice for the bank you are working on, and you can turn sending on or off in Settings. Staff do not write templates here. When sending is off, confirming records the notice and nothing goes out. When sending is on, confirming sends by SMS, email, or WhatsApp."
                    : "You can send a notice for the bank you are working on. Choose the spreadsheet, the approved wording, review who will get it, then send. Staff do not write templates here. When sending is off, confirming records the notice and nothing goes out. When sending is on, confirming sends by SMS, email, or WhatsApp."}
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
