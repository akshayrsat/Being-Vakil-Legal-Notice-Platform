import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PASSWORD_HREF } from "@/lib/account-paths";
import { getCurrentUser } from "@/lib/auth";
import { staffGateIsOpen } from "@/lib/staff-gate-session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Forgot password",
};

export default async function ForgotPasswordPage() {
  const user = await getCurrentUser();
  if (user) redirect(PASSWORD_HREF);
  if (!(await staffGateIsOpen())) redirect("/?staff=1");

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center px-4 py-10">
      <BrandLogo size="mark" />
      <h1 className="mt-6 font-serif text-4xl tracking-tight">Forgot password</h1>
      <p className="mt-3 text-base leading-7 text-muted-foreground">
        Enter the email on the login. If it matches an account, a one-time link is emailed. The link expires in 30
        minutes.
      </p>
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Reset link</CardTitle>
          <CardDescription>The same message is shown whether or not that email is a login.</CardDescription>
        </CardHeader>
        <CardContent>
          <ForgotPasswordForm />
        </CardContent>
      </Card>
      <Link href="/login" className="mt-6 text-sm underline">
        Back to sign in
      </Link>
    </main>
  );
}
