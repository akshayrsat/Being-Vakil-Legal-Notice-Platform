"use client";

import { useActionState } from "react";
import { saveOdrSettings, setOdrLiveSwitch } from "@/app/actions/odr";
import { Button } from "@/components/ui/button";
import type { OdrRules } from "@/lib/odr-store";
import { odrTemplateSlots, slotLabel } from "@/lib/odr-templates";

const field = "h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal";

export function OdrLiveForm({
  enabled,
  serverDisabled,
  technical = false,
}: {
  enabled: boolean;
  serverDisabled: boolean;
  technical?: boolean;
}) {
  const [state, action, pending] = useActionState(setOdrLiveSwitch, null);

  return (
    <form action={action} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium">ODR messages</legend>
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
              : "Off. Confirming records the message. Nothing is sent."}
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
              ? "On. Confirming sends the ODR message through MSG91."
              : "On. Confirming sends the ODR message by SMS, email, or WhatsApp."}
          </span>
        </label>
      </fieldset>
      {serverDisabled ? <p className="text-sm leading-6 text-muted-foreground">ODR sending is disabled on the server</p> : null}
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

export function OdrTemplateForm({ rules, showIds }: { rules: OdrRules; showIds: boolean }) {
  const [state, action, pending] = useActionState(saveOdrSettings, null);
  return (
    <form action={action} className="flex flex-col gap-6">
      {showIds
        ? odrTemplateSlots().map((slot) => (
            <fieldset key={slot} className="grid gap-3">
              <legend className="font-medium">{slotLabel(slot)}</legend>
              <label className="flex flex-col gap-1 text-sm">
                SMS flow id
                <input name={`${slot}.sms`} defaultValue={rules.templates[slot]?.smsFlowId ?? ""} className={field} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Email template id
                <input name={`${slot}.email`} defaultValue={rules.templates[slot]?.emailTemplateId ?? ""} className={field} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                WhatsApp template name
                <input name={`${slot}.whatsapp`} defaultValue={rules.templates[slot]?.whatsappTemplate ?? ""} className={field} />
              </label>
            </fieldset>
          ))
        : (
          <p className="text-sm leading-6 text-muted-foreground">
            Template reference ids stay with the owner admin. Empty slots are not sent.
          </p>
        )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Reminder, days before
          <input name="reminderDaysBefore" type="number" min={1} max={14} defaultValue={rules.reminderDaysBefore} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Reminder, hours before
          <input name="reminderHoursBefore" type="number" min={1} max={48} defaultValue={rules.reminderHoursBefore} className={field} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="reminderDayOn" value="on" defaultChecked={rules.reminderDayOn} className="size-4 accent-primary" />
          Send the day-before reminder
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="reminderHourOn" value="on" defaultChecked={rules.reminderHourOn} className="size-4 accent-primary" />
          Send the hour-before reminder
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Maximum no-shows before ex parte review
          <input name="maxNoShow" type="number" min={1} max={10} defaultValue={rules.maxNoShow} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Auto-reschedule after no-show (days, 0 is off)
          <input name="autoRescheduleDays" type="number" min={0} max={60} defaultValue={rules.autoRescheduleDays} className={field} />
        </label>
      </div>
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" className="h-11 w-fit px-4" disabled={pending}>
        {pending ? "Saving…" : "Save ODR settings"}
      </Button>
    </form>
  );
}
