// The form an Admin uses to add a client bank.

"use client";

import { useActionState } from "react";
import { createBank } from "@/app/actions/banks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AddBankForm() {
  const [state, formAction, pending] = useActionState(createBank, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem] sm:items-end">
        <div className="flex flex-col gap-2">
          <Label htmlFor="bank-name">Bank name</Label>
          <Input
            id="bank-name"
            name="name"
            required
            maxLength={80}
            autoComplete="organization"
            placeholder="Example: Northwind Housing Finance"
            className="h-11 px-3 text-base md:text-base"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="bank-code">Short code</Label>
          <Input
            id="bank-code"
            name="code"
            required
            maxLength={8}
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="NWH"
            className="h-11 px-3 text-base uppercase md:text-base"
          />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        The short code is the bank’s id on this site. Use 2 to 8 letters or numbers.
        A new bank starts as active.
      </p>
      {state?.error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </p>
      ) : null}
      <Button type="submit" className="h-11 w-full sm:w-fit px-4" disabled={pending}>
        {pending ? "Adding…" : "Add bank"}
      </Button>
    </form>
  );
}
