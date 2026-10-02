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
import type { SignedInUser } from "@/lib/auth";
import { noticePageHref } from "@/lib/notice-link";
import { workingBank } from "@/lib/bank-context";
import { bankStatusLabel } from "@/lib/banks";
import {
  ROLE_ADMIN,
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

export function DashboardHome({ user }: { user: SignedInUser }) {
  const accent = roleAccent(user.role);
  const title = roleTitle(user.role);
  const isAdmin = user.role === ROLE_ADMIN;
  const bank = workingBank(user);

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader user={user} />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
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
                ? "Spreadsheets and notice templates are filed under this bank."
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
              {isAdmin ? (
                <Link
                  href="/banks"
                  className={buttonVariants({ variant: "outline", className: "h-11 w-fit px-4" })}
                >
                  {bank ? "Change bank" : "Choose a bank"}
                </Link>
              ) : null}
              {isAdmin ? (
                <Link
                  href="/audit"
                  className={buttonVariants({ variant: "outline", className: "h-11 w-fit px-4" })}
                >
                  Security / Audit
                </Link>
              ) : null}
              {bank ? (
                <Link
                  href="/uploads"
                  className={buttonVariants({ variant: "outline", className: "h-11 w-fit px-4" })}
                >
                  {isAdmin ? "Upload a spreadsheet" : "View uploads"}
                </Link>
              ) : null}
              {bank ? (
                <Link
                  href="/templates"
                  className={buttonVariants({ variant: "outline", className: "h-11 w-fit px-4" })}
                >
                  {isAdmin ? "Notice templates" : "View templates"}
                </Link>
              ) : null}
              {bank ? (
                <Link
                  href="/campaigns"
                  className={buttonVariants({ variant: "outline", className: "h-11 w-fit px-4" })}
                >
                  {isAdmin ? "Prepare a send" : "View campaigns"}
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

        <Card>
          <CardHeader>
            <CardTitle>This version</CardTitle>
            <CardDescription>Sign-in, banks, uploads, templates, a dry-run send, public notice pages, status search, and an audit log are working.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="leading-7 text-foreground">
              Firm staff choose a bank, upload a spreadsheet, and write a notice template. They can
              review a send, confirm a dry run, then search or download a status report. The audit log
              records who did that. A bank viewer can look and download a report for their own bank.
              They cannot change a file, a template, or a send, and they cannot open the audit log. A
              dry run stays marked Dry run. MSG91 is not called unless the keys are set up on this
              computer.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
