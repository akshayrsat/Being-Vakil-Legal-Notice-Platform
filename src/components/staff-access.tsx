// A small control at the bottom of the public page. It is not the customer call to action.

"use client";

import { useActionState, useState } from "react";
import { unlockStaffAccess } from "@/app/actions/staff-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function StaffAccess({ initiallyOpen = false }: { initiallyOpen?: boolean }) {
  const [state, formAction, pending] = useActionState(unlockStaffAccess, null);
  const [open, setOpen] = useState(initiallyOpen);

  return (
    <details
      className="group"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer list-none text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline [&::-webkit-details-marker]:hidden">
        Staff access
      </summary>
      <form action={formAction} className="mt-4 flex max-w-sm flex-col gap-3">
        <p className="text-sm leading-6 text-muted-foreground">
          Enter the staff entry code to open sign-in. This page is for customers who received a
          notice.
        </p>
        <div className="flex flex-col gap-2">
          <Label htmlFor="staff-entry-code">Entry code</Label>
          <Input
            id="staff-entry-code"
            name="code"
            type="password"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={200}
            required
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
        <Button type="submit" className="h-11 w-fit px-5 text-base" disabled={pending}>
          {pending ? "Checking…" : "Continue"}
        </Button>
      </form>
    </details>
  );
}
