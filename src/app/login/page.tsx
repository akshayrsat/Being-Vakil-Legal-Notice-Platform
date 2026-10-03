// Staff sign-in. The public site does not open this page until the entry code has been accepted.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { LoginFeaturePanel } from "@/components/login-feature-panel";
import { LoginForm } from "@/components/login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/brand";
import { isOtpEnabled } from "@/lib/msg91";
import { staffGateIsOpen } from "@/lib/staff-gate-session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  if (!(await staffGateIsOpen())) redirect("/?staff=1");

  return (
    <div className="grid min-h-full lg:grid-cols-[minmax(0,1.05fr)_minmax(20rem,0.95fr)]">
      <main className="flex flex-col justify-center px-4 py-10 sm:px-8 lg:px-12">
        <BrandLogo size="mark" priority />
        <p className="mt-6 text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
          Law firm workspace
        </p>
        <h1 className="mt-2 font-serif text-4xl tracking-tight text-primary">{PRODUCT_NAME}</h1>
        <p className="mt-2 max-w-lg text-base leading-7 text-muted-foreground">{PRODUCT_TAGLINE}</p>

        <Card className="mt-8 max-w-lg">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>
              {isOtpEnabled()
                ? "Admin accounts also need a one-time code by text after the password. A Bank Viewer does not."
                : "Use a practice login below, or type an email and password yourself. A one-time code is not used on this computer."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </main>
      <LoginFeaturePanel />
    </div>
  );
}
