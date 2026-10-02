// Dropdowns that say which spreadsheet column fills each notice field.

"use client";

import { useActionState } from "react";
import { saveMapping } from "@/app/actions/uploads";
import { Button } from "@/components/ui/button";
import { FIELD_GROUPS, SHEET_FIELDS, type FieldMapping } from "@/lib/sheet-fields";

export function ColumnMapper({
  batchId,
  headers,
  initial,
  bankName,
  hasSavedMatch,
}: {
  batchId: string;
  headers: string[];
  initial: FieldMapping;
  bankName: string;
  hasSavedMatch: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveMapping, null);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="batchId" value={batchId} />
      <p className="text-sm leading-6 text-muted-foreground">
        {hasSavedMatch
          ? `These choices start from the match saved for ${bankName}. Change any that are wrong, then save.`
          : "Choose which spreadsheet column fills each box. Customer name is required. Leave the others as “Not in this file” if the sheet does not have them."}
      </p>
      {FIELD_GROUPS.map((group) => (
        <fieldset key={group} className="flex flex-col gap-3">
          <legend className="font-serif text-xl">{group}</legend>
          <div className="grid gap-3">
            {SHEET_FIELDS.filter((field) => field.group === group).map((field) => (
              <label key={field.key} className="grid gap-1 sm:grid-cols-[14rem_minmax(0,1fr)] sm:items-center">
                <span className="text-sm font-medium">
                  {field.label}
                  {field.required ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">Required</span>
                  ) : null}
                </span>
                <select
                  name={field.key}
                  defaultValue={initial[field.key] ?? ""}
                  className="h-11 rounded-lg border border-input bg-card px-3 text-sm"
                >
                  <option value="">Not in this file</option>
                  {headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <p className="text-sm text-muted-foreground">
        You can match up to three mobile columns. If one cell lists several numbers, separated by
        a comma or a slash, each number is kept.
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
        {pending ? "Saving…" : "Save column match"}
      </Button>
    </form>
  );
}
