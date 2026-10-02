// The file picker. Firm staff use it to bring in an Excel file for the current bank.

"use client";

import { useActionState } from "react";
import { uploadExcel } from "@/app/actions/uploads";
import { Button } from "@/components/ui/button";

export function UploadForm() {
  const [state, formAction, pending] = useActionState(uploadExcel, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-sm font-medium" htmlFor="workbook">
        Excel file
        <input
          id="workbook"
          name="file"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          required
          className="block w-full text-sm font-normal file:mr-3 file:h-11 file:rounded-lg file:border-0 file:bg-secondary file:px-4 file:text-sm file:font-medium file:text-foreground"
        />
      </label>
      <p className="text-sm text-muted-foreground">
        Use an .xlsx file, with the column names in the first row. The file must be under 5 MB.
        A practice file is available:{" "}
        <a className="font-medium text-foreground underline" href="/sample-workbook">
          download notice-recipients.xlsx
        </a>
        .
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
        {pending ? "Reading the file…" : "Upload Excel"}
      </Button>
    </form>
  );
}
