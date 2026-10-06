"use client";

import { useActionState } from "react";
import { uploadOdrExcel } from "@/app/actions/odr";
import { Button } from "@/components/ui/button";

const fieldClass = "h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal";

export function OdrUploadForm({
  neutrals,
}: {
  neutrals: Array<{ id: string; name: string; qualification: string }>;
}) {
  const [state, formAction, pending] = useActionState(uploadOdrExcel, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">
          Arbitration or mediation <span className="font-normal text-muted-foreground">Required</span>
        </legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="matterType" value="ARBITRATION" className="size-4 accent-primary" required />
          Arbitration
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="matterType" value="MEDIATION" className="size-4 accent-primary" required />
          Mediation
        </label>
      </fieldset>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Arbitrator or mediator
        <select name="neutralId" required className={fieldClass} defaultValue="">
          <option value="" disabled>
            Choose a name
          </option>
          {neutrals.map((neutral) => (
            <option key={neutral.id} value={neutral.id}>
              {neutral.name}
              {neutral.qualification ? ` · ${neutral.qualification}` : ""}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          First hearing date
          <input name="hearingDate" type="date" required className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Time
          <input name="hearingTime" type="time" required className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Session length (minutes)
          <input name="duration" type="number" min={15} max={240} defaultValue={60} required className={fieldClass} />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Bank Excel file
        <input name="file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required className="text-sm" />
      </label>
      {state?.error ? (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" className="h-11 w-fit px-4" disabled={pending || neutrals.length === 0}>
        {pending ? "Uploading…" : "Upload and match columns"}
      </Button>
    </form>
  );
}
