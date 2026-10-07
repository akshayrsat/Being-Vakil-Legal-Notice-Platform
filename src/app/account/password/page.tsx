import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { AppHeader } from "@/components/app-header";
import { BrandLogo } from "@/components/brand-logo";
import { ChangePasswordForm } from "@/components/change-password-form";
import { SignOutButton } from "@/components/sign-out-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionContext } from "@/lib/auth";
import { PRODUCT_NAME } from "@/lib/brand";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Password",
};

export default async function PasswordPage() {
  const current = await getSessionContext({ allowStalePassword: true });
  if (!current) redirect("/login");
  const forced = current.user.mustChangePassword;

  return (
    <div className="flex min-h-full flex-col">
      {forced ? (
        <header className="border-b border-border bg-card">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <BrandLogo size="header" />
            <form action={signOut}>
              <SignOutButton />
            </form>
          </div>
        </header>
      ) : (
        <AppHeader user={current.user} />
      )}
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">{forced ? "Choose a new password" : "Password"}</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            {forced
              ? "This sign-in used a temporary password. Choose a new one before opening anything else."
              : `Change the password for your ${PRODUCT_NAME} login.`}
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>New password</CardTitle>
            <CardDescription>Enter the password you use now, then the new one twice.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm forced={forced} />
          </CardContent>
        </Card>
        {forced ? null : (
          <Link href="/dashboard" className="text-sm underline">
            Back to home
          </Link>
        )}
      </main>
    </div>
  );
}
