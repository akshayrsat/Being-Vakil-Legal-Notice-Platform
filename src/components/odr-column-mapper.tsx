"use client";

import { useActionState } from "react";
import { saveOdrMapping } from "@/app/actions/odr";
import { Button } from "@/components/ui/button";
import { ODR_FIELD_GROUPS, ODR_SHEET_FIELDS, type OdrFieldMapping } from "@/lib/odr-fields";

export function OdrColumnMapper({
  batchId,
  headers,
  initial,
}: {
  batchId: string;
  headers: string[];
  initial: OdrFieldMapping;
}) {
  const [state, formAction, pending] = useActionState(saveOdrMapping, null);
  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="batchId" value={batchId} />
      <p className="text-sm leading-6 text-muted-foreground">
        Choose which column fills each box. Customer name and the loan or card account number are required. A blank
        reference number is filled in when you send.
      </p>
      {ODR_FIELD_GROUPS.map((group) => (
        <fieldset key={group} className="flex flex-col gap-3">
          <legend className="font-serif text-xl">{group}</legend>
          {ODR_SHEET_FIELDS.filter((field) => field.group === group).map((field) => (
            <label key={field.key} className="grid gap-1 sm:grid-cols-[16rem_minmax(0,1fr)] sm:items-center">
              <span className="text-sm font-medium">
                {field.label}
                {field.required ? <span className="ml-2 text-xs font-normal text-muted-foreground">Required</span> : null}
              </span>
              <select name={field.key} defaultValue={initial[field.key] ?? ""} className="h-11 rounded-lg border border-input bg-card px-3 text-sm">
                <option value="">Not in this file</option>
                {headers.map((header) => (
                  <option key={header} value={header}>
                    {header}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </fieldset>
      ))}
      {state?.error ? (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" className="h-11 w-fit px-4" disabled={pending}>
        {pending ? "Saving…" : "Review the people"}
      </Button>
    </form>
  );
}
