// The sign-in page. People who are already signed in are sent to the dashboard.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
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

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="flex min-h-full flex-col">
      <div className="h-2 bg-[#1b3048]" />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-10 sm:px-6">
        <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
          Law firm workspace
        </p>
        <h1 className="mt-2 font-serif text-4xl tracking-tight text-primary">
          {PRODUCT_NAME}
        </h1>
        <p className="mt-2 text-base leading-7 text-muted-foreground">{PRODUCT_TAGLINE}</p>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>
              {isOtpEnabled()
                ? "Admin accounts also need a one-time code by text after the password. A Bank Viewer does not."
                : "Use a practice login below, or type an email and password yourself. A one-time code is not used, because MSG91 is not set up on this computer."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
