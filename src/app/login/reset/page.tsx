import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reset password",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const query = await searchParams;
  const raw = query.token;
  const token = (Array.isArray(raw) ? raw[0] : raw ?? "").trim();

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center px-4 py-10">
      <BrandLogo size="mark" />
      <h1 className="mt-6 font-serif text-4xl tracking-tight">Reset password</h1>
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>New password</CardTitle>
          <CardDescription>This link works once and expires 30 minutes after it was sent.</CardDescription>
        </CardHeader>
        <CardContent>
          {/^[a-f0-9]{64}$/.test(token) ? (
            <ResetPasswordForm token={token} />
          ) : (
            <p className="text-sm text-muted-foreground">That reset link is not valid. Ask for a new one.</p>
          )}
        </CardContent>
      </Card>
      <Link href="/login" className="mt-6 text-sm underline">
        Back to sign in
      </Link>
    </main>
  );
}
