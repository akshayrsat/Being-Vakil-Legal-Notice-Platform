"use client";

import { useActionState } from "react";
import { submitEntryCode } from "@/app/actions/entry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function EntryForm({ nextPath }: { nextPath: string }) {
  const [state, action, pending] = useActionState(submitEntryCode, null);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={nextPath} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="entry-code">Entry code</Label>
        <Input
          id="entry-code"
          name="code"
          type="password"
          autoComplete="off"
          required
          className="h-11 px-3"
        />
      </div>
      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" className="h-11 w-fit px-4" disabled={pending}>
        {pending ? "Checking…" : "Continue"}
      </Button>
    </form>
  );
}
