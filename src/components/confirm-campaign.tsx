// The last step before a dry run is recorded. It does not appear for a bank viewer.

"use client";

import { useActionState } from "react";
import { confirmCampaign } from "@/app/actions/campaigns";
import { Button } from "@/components/ui/button";
import { confirmButtonLabel, confirmHelp } from "@/lib/staff-language";

export function ConfirmCampaign({
  campaignId,
  dryRun,
  technical = false,
}: {
  campaignId: string;
  dryRun: boolean;
  technical?: boolean;
}) {
  const [state, formAction, pending] = useActionState(confirmCampaign, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="campaignId" value={campaignId} />
      <p className="text-sm leading-6 text-muted-foreground">
        {confirmHelp(dryRun, technical)}
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
        {confirmButtonLabel(dryRun, technical, pending)}
      </Button>
    </form>
  );
}
