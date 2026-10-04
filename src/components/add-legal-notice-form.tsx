// Name and wording for one printed legal notice.

"use client";

import { useActionState } from "react";
import { createLegalNoticeTemplate } from "@/app/actions/legal-notices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const FILL_INS = [
  ["Customer name", "{{customer_name}}"],
  ["Address", "{{address}}"],
  ["Loan number", "{{loan_number}}"],
  ["Outstanding amount", "{{outstanding_amount}}"],
  ["Loan type", "{{loan_type}}"],
  ["Bank name", "{{bank_name}}"],
  ["Notice number", "{{notice_number}}"],
  ["Date", "{{notice_date}}"],
] as const;

export function AddLegalNoticeForm() {
  const [state, formAction, pending] = useActionState(createLegalNoticeTemplate, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="legal-notice-name">Name</Label>
        <Input
          id="legal-notice-name"
          name="name"
          required
          maxLength={80}
          placeholder="A short name for this notice"
          className="h-11 px-3 text-base md:text-base"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="legal-notice-body">Notice wording</Label>
        <Textarea
          id="legal-notice-body"
          name="body"
          required
          rows={14}
          maxLength={12000}
          placeholder="Write the notice. The letterhead and the advocate stamp are added for you."
          className="min-h-64 font-serif text-base leading-7"
        />
      </div>
      <p className="text-sm leading-6 text-muted-foreground">
        This notice is for every bank. Write {"{{bank_name}}"} where the bank should appear. The
        letterhead and the advocate stamp stay on the page. Keep it short enough for one A4 page.
      </p>
      <ul className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
        {FILL_INS.map(([label, token]) => (
          <li key={token}>
            {label} <span className="font-medium text-foreground">{token}</span>
          </li>
        ))}
      </ul>
      {state?.error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </p>
      ) : null}
      <Button type="submit" className="h-11 w-full px-4 sm:w-fit" disabled={pending}>
        {pending ? "Adding…" : "Add legal notice"}
      </Button>
    </form>
  );
}
