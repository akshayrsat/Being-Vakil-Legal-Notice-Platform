"use client";

import { useActionState, useState } from "react";
import { saveOdrPaper, uploadSignedPaper, type PaperFormState } from "@/app/actions/odr-paper";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  fieldsFor,
  flagsFor,
  paperGroups,
  type PaperField,
  type PaperKind,
  type PaperRow,
} from "@/lib/odr-paper";

const inputClass = "h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal";

function RowEditor({
  title,
  name,
  columns,
  rows,
  onChange,
}: {
  title: string;
  name: string;
  columns: Array<{ key: string; label: string }>;
  rows: PaperRow[];
  onChange: (rows: PaperRow[]) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="font-serif text-xl">{title}</legend>
      <input type="hidden" name={name} value={JSON.stringify(rows)} />
      {rows.map((row, index) => (
        <div key={`${name}-${index}`} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-2">
          {columns.map((column) => (
            <label key={column.key} className="flex flex-col gap-1 text-sm font-medium">
              {column.label}
              <input
                value={row[column.key] ?? ""}
                onChange={(event) => {
                  const next = rows.slice();
                  next[index] = { ...row, [column.key]: event.target.value };
                  onChange(next);
                }}
                className={inputClass}
              />
            </label>
          ))}
          <div className="sm:col-span-2">
            <Button type="button" variant="outline" className="h-9 px-3" onClick={() => onChange(rows.filter((_, item) => item !== index))}>
              Remove
            </Button>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="h-11 w-fit px-4"
        onClick={() => onChange([...rows, Object.fromEntries(columns.map((column) => [column.key, ""]))])}
      >
        Add a row
      </Button>
    </fieldset>
  );
}

function FieldInput({ field, value }: { field: PaperField; value: string }) {
  if (field.input === "textarea") {
    return <textarea name={field.key} defaultValue={value} rows={4} className="rounded-lg border border-input bg-card px-3 py-2 text-sm font-normal" />;
  }
  return <input name={field.key} type={field.input === "date" ? "date" : "text"} defaultValue={value} className={inputClass} />;
}

export function OdrPaperForm({
  caseId,
  kind,
  values,
  coRespondents,
  obligors,
  instalments,
  deliveries,
  noticeLines,
  hearingLines,
}: {
  caseId: string;
  kind: PaperKind;
  values: Record<string, string>;
  coRespondents: PaperRow[];
  obligors: PaperRow[];
  instalments: PaperRow[];
  deliveries: PaperRow[];
  noticeLines: string[];
  hearingLines: string[];
}) {
  const [state, action, pending] = useActionState(saveOdrPaper, null as PaperFormState);
  const [coRows, setCoRows] = useState(coRespondents);
  const [obligorRows, setObligorRows] = useState(obligors);
  const [instalmentRows, setInstalmentRows] = useState(instalments.length ? instalments : [{ instalment_no: "Upfront", instalment_amount: "", instalment_due_date: "", instalment_mode_ref: "" }]);
  const [deliveryRows, setDeliveryRows] = useState(deliveries);
  const groups = paperGroups(kind);
  const fields = fieldsFor(kind);
  const flags = flagsFor(kind);

  return (
    <form action={action} className="flex flex-col gap-8">
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="kind" value={kind} />
      {state?.error ? <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p> : null}
      <section className="rounded-lg border border-border px-4 py-3 text-sm leading-6">
        <p className="font-medium">Rows taken from the case</p>
        <ul className="mt-2 list-disc pl-5 text-muted-foreground">
          {hearingLines.map((line) => <li key={line}>{line}</li>)}
          {noticeLines.map((line) => <li key={line}>{line}</li>)}
          {hearingLines.length + noticeLines.length === 0 ? <li>No hearings or messages are on the case yet.</li> : null}
        </ul>
      </section>
      {groups.map((group) => (
        <fieldset key={group} className="flex flex-col gap-3">
          <legend className="font-serif text-2xl">{group}</legend>
          {fields.filter((field) => field.group === group).map((field) => (
            <label key={field.key} className="flex flex-col gap-1 text-sm font-medium">
              {field.label}
              <FieldInput field={field} value={values[field.key] ?? ""} />
              {field.hint ? <span className="font-normal text-muted-foreground">{field.hint}</span> : null}
            </label>
          ))}
          {flags.filter((flag) => flag.group === group).map((flag) => (
            <label key={flag.key} className="flex items-start gap-2 text-sm">
              <input type="checkbox" name={flag.key} value="true" defaultChecked={values[flag.key] === "true"} className="mt-1 size-4 accent-primary" />
              <span>
                {flag.label}
                {flag.hint ? <span className="mt-1 block text-muted-foreground">{flag.hint}</span> : null}
              </span>
            </label>
          ))}
        </fieldset>
      ))}
      {kind === "award" ? (
        <>
          <RowEditor
            title="Co-borrowers and guarantors"
            name="coRespondents"
            rows={coRows}
            onChange={setCoRows}
            columns={[
              { key: "co_respondent_name", label: "Name" },
              { key: "co_respondent_capacity", label: "Co-borrower or guarantor" },
              { key: "co_respondent_address", label: "Address" },
              { key: "co_respondent_pan", label: "PAN" },
              { key: "co_respondent_mobile", label: "Mobile" },
              { key: "co_respondent_email", label: "Email" },
            ]}
          />
          <RowEditor
            title="How the signed award will be delivered"
            name="deliveries"
            rows={deliveryRows}
            onChange={setDeliveryRows}
            columns={[
              { key: "delivery_party", label: "Party" },
              { key: "delivery_mode", label: "Mode" },
              { key: "delivery_date", label: "Date" },
              { key: "delivery_proof_ref", label: "Proof" },
            ]}
          />
        </>
      ) : (
        <>
          <RowEditor
            title="Co-borrowers and guarantors"
            name="obligors"
            rows={obligorRows}
            onChange={setObligorRows}
            columns={[
              { key: "obligor_name", label: "Name" },
              { key: "obligor_capacity", label: "Co-borrower or guarantor" },
              { key: "obligor_age", label: "Age" },
              { key: "obligor_address", label: "Address" },
              { key: "obligor_pan", label: "PAN" },
              { key: "obligor_aadhaar_last4", label: "Aadhaar last 4" },
              { key: "obligor_mobile", label: "Mobile" },
              { key: "obligor_email", label: "Email" },
            ]}
          />
          <RowEditor
            title="Instalments"
            name="instalments"
            rows={instalmentRows}
            onChange={setInstalmentRows}
            columns={[
              { key: "instalment_no", label: "Upfront or number" },
              { key: "instalment_amount", label: "Amount" },
              { key: "instalment_due_date", label: "Due date" },
              { key: "instalment_mode_ref", label: "Mode or UTR" },
            ]}
          />
        </>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" name="intent" value="save" className={buttonVariants({ variant: "outline", className: "h-11 px-4" })} disabled={pending}>
          {pending ? "Saving…" : "Save answers"}
        </button>
        <button type="submit" name="intent" value="generate" className={buttonVariants({ className: "h-11 px-4" })} disabled={pending}>
          {pending ? "Preparing…" : "Generate Word draft"}
        </button>
      </div>
      <p className="text-sm text-muted-foreground">The draft is a Word file. It is not sent to the customer.</p>
    </form>
  );
}

export function OdrSignedUpload({ caseId, which }: { caseId: string; which: "award" | "settlement" }) {
  const [state, action, pending] = useActionState(uploadSignedPaper, null as PaperFormState);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="which" value={which} />
      <label className="flex flex-col gap-1 text-sm font-medium">
        Signed {which === "award" ? "award" : "settlement"} (PDF or Word)
        <input name="file" type="file" accept=".pdf,.docx,application/pdf" className="text-sm" />
      </label>
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" className="h-11 w-fit px-4" disabled={pending}>
        {pending ? "Uploading…" : "Upload signed final"}
      </Button>
      <p className="text-sm text-muted-foreground">
        Uploading the signed file sets the case to {which === "award" ? "Award passed" : "Settled"}. Nothing is sent.
      </p>
    </form>
  );
}
