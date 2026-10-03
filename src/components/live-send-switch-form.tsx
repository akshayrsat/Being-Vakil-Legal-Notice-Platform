"use client";

import { useActionState } from "react";
import { setLiveSendSwitch } from "@/app/actions/live-send";
import { Button } from "@/components/ui/button";

export function LiveSendSwitchForm({
  enabled,
  technical = false,
}: {
  enabled: boolean;
  technical?: boolean;
}) {
  const [state, formAction, pending] = useActionState(setLiveSendSwitch, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium">Live send</legend>
        <label className="flex items-start gap-2 text-sm leading-6">
          <input
            type="radio"
            name="enabled"
            value="off"
            defaultChecked={!enabled}
            className="mt-1 size-4 accent-primary"
          />
          <span>
            {technical
              ? "Off. Confirming records a dry run. Nothing is sent."
              : "Off. Confirming records the notice. Nothing is sent."}
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm leading-6">
          <input
            type="radio"
            name="enabled"
            value="on"
            defaultChecked={enabled}
            className="mt-1 size-4 accent-primary"
          />
          <span>
            {technical
              ? "On. Confirming sends the notice through MSG91."
              : "On. Confirming sends the notice by SMS, email, or WhatsApp."}
          </span>
        </label>
      </fieldset>
      {state?.error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </p>
      ) : null}
      <Button type="submit" className="h-11 w-full px-4 sm:w-fit" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
