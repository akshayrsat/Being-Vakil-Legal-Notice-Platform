// Starts a follow-up for people who were skipped or failed. It does not send anything.

"use client";

import { useActionState } from "react";
import { startFollowUp } from "@/app/actions/campaigns";
import { Button } from "@/components/ui/button";

export function FollowUpButton({ campaignId }: { campaignId: string }) {
  const [state, formAction, pending] = useActionState(startFollowUp, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="campaignId" value={campaignId} />
      {state?.error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </p>
      ) : null}
      <Button type="submit" className="h-11 w-full px-4 sm:w-fit" disabled={pending}>
        {pending ? "Preparing…" : "Prepare follow-up"}
      </Button>
    </form>
  );
}
