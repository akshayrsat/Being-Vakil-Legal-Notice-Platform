// Admin one-time code. Bank viewers never land here. Without MSG91, sign-in skips this page.

import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { OtpForm } from "@/components/otp-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OTP_COOKIE, getCurrentUser } from "@/lib/auth";
import { staffGateIsOpen } from "@/lib/staff-gate-session";

export const metadata: Metadata = {
  title: "One-time code",
};

export default async function OtpPage({
  searchParams,
}: {
  searchParams: Promise<{ resent?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  if (!(await staffGateIsOpen())) redirect("/?staff=1");

  const cookieStore = await cookies();
  const query = await searchParams;
  const hasChallenge = Boolean(cookieStore.get(OTP_COOKIE)?.value);

  return (
    <div className="flex min-h-full flex-col">
      <div className="h-2 bg-primary" />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-10 sm:px-6">
        <BrandLogo size="mark" priority />
        <h1 className="mt-6 font-serif text-4xl tracking-tight text-primary">One-time code</h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          Enter the code MSG91 sent to the firm mobile saved on this computer. A Bank Viewer does
          not use this step.
        </p>
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Check the text message</CardTitle>
            <CardDescription>The code expires in about 10 minutes.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {query.resent === "1" ? (
              <p className="text-sm" role="status">
                A new code was requested.
              </p>
            ) : null}
            {query.resent === "0" ? (
              <p className="text-sm text-destructive" role="alert">
                The code could not be sent again.
              </p>
            ) : null}
            {hasChallenge ? (
              <OtpForm />
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">
                Sign in with your email and password first.
              </p>
            )}
            <Link href="/login" className="text-sm font-medium text-primary underline">
              Back to sign in
            </Link>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
