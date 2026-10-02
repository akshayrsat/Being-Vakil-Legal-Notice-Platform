// The one-time code step. Shown only after an Admin password when MSG91 is configured.

"use client";

import { useActionState } from "react";
import { resendOtp, verifyOtp } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function OtpForm() {
  const [state, formAction, pending] = useActionState(verifyOtp, null);

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="otp">One-time code</Label>
          <Input
            id="otp"
            name="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            maxLength={8}
            className="h-11 px-3 text-base md:text-base"
          />
        </div>
        {state?.error ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {state.error}
          </p>
        ) : null}
        <Button type="submit" className="h-11 w-full text-base" disabled={pending}>
          {pending ? "Checking…" : "Continue"}
        </Button>
      </form>
      <form action={resendOtp}>
        <Button type="submit" variant="outline" className="h-11 w-full">
          Send the code again
        </Button>
      </form>
    </div>
  );
}
