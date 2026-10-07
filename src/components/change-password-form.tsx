"use client";

import Link from "next/link";
import { useActionState } from "react";
import { changePassword } from "@/app/actions/password";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const [state, formAction, pending] = useActionState(changePassword, null);
  const done = state !== null && "done" in state && state.done;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="current-password">Current password</Label>
        <Input
          id="current-password"
          name="current"
          type="password"
          autoComplete="current-password"
          required
          className="h-11 px-3 text-base md:text-base"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="h-11 px-3 text-base md:text-base"
        />
        <p className="text-sm text-muted-foreground">At least 8 characters.</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <Input
          id="confirm-password"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="h-11 px-3 text-base md:text-base"
        />
      </div>
      {state && "error" in state ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </p>
      ) : null}
      {done ? (
        <div className="flex flex-col gap-2">
          <p role="status" className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
            {forced
              ? "Password saved. You can use the rest of the site."
              : "Password saved. Other signed-in sessions were signed out."}
          </p>
          <Link href="/dashboard" className="text-sm underline">
            Continue
          </Link>
        </div>
      ) : null}
      <Button type="submit" size="lg" className="h-11 w-fit text-base" disabled={pending}>
        {pending ? "Saving…" : "Save password"}
      </Button>
    </form>
  );
}
