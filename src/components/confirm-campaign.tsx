// The last step before a dry run is recorded. It does not appear for a bank viewer.

"use client";

import { useActionState } from "react";
import { confirmCampaign } from "@/app/actions/campaigns";
import { Button } from "@/components/ui/button";

export function ConfirmCampaign({
  campaignId,
  dryRun,
}: {
  campaignId: string;
  dryRun: boolean;
}) {
  const [state, formAction, pending] = useActionState(confirmCampaign, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="campaignId" value={campaignId} />
      <p className="text-sm leading-6 text-muted-foreground">
        {dryRun
          ? "Confirming records a dry run on this computer. MSG91 is not called."
          : "Confirming asks MSG91 to deliver the notices that are not skipped. Each row is claimed once, so a second confirm does not send it again."}
      </p>
      {state?.error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </p>
      ) : null}
      <Button type="submit" className="h-11 w-full px-4 sm:w-fit" disabled={pending}>
        {pending ? "Finishing…" : dryRun ? "Confirm dry run" : "Confirm send"}
      </Button>
    </form>
  );
}
