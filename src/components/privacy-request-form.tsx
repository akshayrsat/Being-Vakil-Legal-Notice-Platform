"use client";

import { useActionState } from "react";
import { submitPrivacyRequest } from "@/app/actions/privacy";
import { PRIVACY_REQUEST_KINDS, privacyRequestKindLabel } from "@/lib/privacy-access";

const field = "h-11 rounded-lg border border-border bg-background px-3 text-sm";

export function PrivacyRequestForm() {
  const [state, action, pending] = useActionState(submitPrivacyRequest, null);
  if (state?.done) {
    return (
      <p className="rounded-lg border border-border bg-card px-3 py-3 text-sm leading-6" role="status">
        Your request is recorded. The firm will reply using the email or mobile you entered.
      </p>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-4">
      {state?.error ? (
        <p className="rounded-lg border border-border bg-card px-3 py-2 text-sm" role="alert">
          {state.error}
        </p>
      ) : null}
      <label className="flex flex-col gap-1 text-sm font-medium">
        What you are asking for
        <select name="kind" required className={field} defaultValue="">
          <option value="" disabled>
            Choose one
          </option>
          {PRIVACY_REQUEST_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {privacyRequestKindLabel(kind)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Your name
        <input name="requesterName" required autoComplete="name" className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Bank name
        <input name="bankName" className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Account or loan number, if you have it
        <input name="accountHint" className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Email
        <input name="email" type="email" autoComplete="email" className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Mobile
        <input name="mobile" inputMode="tel" autoComplete="tel" className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        What should be done
        <textarea name="detail" required rows={4} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
      </label>
      <button type="submit" disabled={pending} className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
        {pending ? "Sending…" : "Submit request"}
      </button>
    </form>
  );
}
