"use client";

import { useActionState } from "react";
import { saveBankGrievance } from "@/app/actions/banks";
import { Button } from "@/components/ui/button";
import { DEFAULT_OMBUDSMAN_MENTION } from "@/lib/grievance";

const field = "h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal";

export function BankGrievanceForm({
  bankId,
  officerName,
  officerPhone,
  officerEmail,
  ombudsman,
  wordingApprovedOn,
}: {
  bankId: string;
  officerName: string;
  officerPhone: string;
  officerEmail: string;
  ombudsman: string;
  wordingApprovedOn: string;
}) {
  const [state, action, pending] = useActionState(saveBankGrievance, null);
  return (
    <form action={action} className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
      <input type="hidden" name="bankId" value={bankId} />
      <p className="text-sm font-medium sm:col-span-2">Grievance redressal officer</p>
      <label className="flex flex-col gap-1 text-sm">
        Name
        <input name="grievanceOfficerName" defaultValue={officerName} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Phone
        <input name="grievanceOfficerPhone" defaultValue={officerPhone} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        Email
        <input name="grievanceOfficerEmail" type="email" defaultValue={officerEmail} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        RBI Integrated Ombudsman mention
        <textarea
          name="grievanceOmbudsman"
          defaultValue={ombudsman}
          placeholder={DEFAULT_OMBUDSMAN_MENTION}
          rows={3}
          className="rounded-lg border border-input bg-card px-3 py-2 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Wording approved by the bank on
        <input name="wordingApprovedOn" type="date" defaultValue={wordingApprovedOn} className={field} />
      </label>
      <div className="flex items-end">
        <Button type="submit" variant="outline" className="h-11 px-4" disabled={pending}>
          {pending ? "Saving…" : "Save grievance details"}
        </Button>
      </div>
      {state?.error ? <p className="text-sm text-destructive sm:col-span-2">{state.error}</p> : null}
      <p className="text-sm text-muted-foreground sm:col-span-2">
        These lines are shown on the customer page, on each ODR message, and on the legal notice page. Leave the Ombudsman box blank to use the standard mention. Sending stays off until you turn it on.
      </p>
    </form>
  );
}
