"use client";

import { useActionState } from "react";
import {
  requestReschedule,
  saveCustomerAdvocate,
  submitSettlement,
  uploadCustomerDocument,
  recordArbitratorConsent,
  verifyOdrCase,
} from "@/app/actions/odr-public";
import { Button } from "@/components/ui/button";
import { CUSTOMER_DOCUMENT_KINDS } from "@/lib/odr-status";
import { odrCopy } from "@/lib/odr-copy";

const copy = odrCopy("en");
const field = "h-11 rounded-lg border border-input bg-card px-3 text-sm";

function ErrorLine({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {error}
    </p>
  );
}

export function OdrVerifyForm({ token, source = "account" }: { token: string; source?: "account" | "mobile" }) {
  const [state, action, pending] = useActionState(verifyOdrCase, null);
  return (
    <form action={action} className="mt-6 flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <label className="flex flex-col gap-1 text-sm font-medium">
        {source === "mobile" ? "Last 4 digits of your mobile number" : copy.verifyLabel}
        <input name="last4" inputMode="numeric" autoComplete="off" maxLength={4} pattern="[0-9]{4}" required className={field} />
      </label>
      <ErrorLine error={state?.error} />
      <Button type="submit" className="h-11 w-fit px-4" disabled={pending}>
        {pending ? "Checking…" : copy.verifyButton}
      </Button>
    </form>
  );
}

export function OdrConsentForm({
  token,
  shownText,
  panel,
}: {
  token: string;
  shownText: string;
  panel: Array<{ id: string; name: string; qualification: string; enrolment: string }>;
}) {
  const [state, action, pending] = useActionState(recordArbitratorConsent, null);
  return (
    <form action={action} className="mt-4 flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <pre className="whitespace-pre-wrap rounded-lg border border-border bg-muted/40 px-3 py-3 text-sm leading-6">{shownText}</pre>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Your choice</legend>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="choice" value="ACCEPT" required className="mt-1 size-4 accent-primary" />
          Accept the named arbitrator and waive Section 12(5) ineligibility in writing
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="choice" value="PANEL" className="mt-1 size-4 accent-primary" />
          Choose one arbitrator from the panel
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="choice" value="OBJECT" className="mt-1 size-4 accent-primary" />
          None of these / I object
        </label>
      </fieldset>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="waive" value="yes" className="mt-1 size-4 accent-primary" />
        I have read the explanation of Section 12(5). If I accept the named arbitrator, I waive that ineligibility in writing for this case.
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Type your full name
        <input name="typedName" autoComplete="name" className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Panel
        <select name="panelNeutralId" className={field} defaultValue="">
          <option value="">Choose a name</option>
          {panel.map((member) => (
            <option key={member.id} value={member.id}>
              {[member.name, member.qualification, member.enrolment].filter(Boolean).join(", ")}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Objection
        <textarea name="objection" rows={3} className="rounded-lg border border-input bg-card px-3 py-2 text-sm" />
      </label>
      <ErrorLine error={state?.error} />
      <Button type="submit" className="h-11 w-fit px-4" disabled={pending}>
        {pending ? "Recording…" : "Record my choice"}
      </Button>
    </form>
  );
}

export function OdrAdvocateForm({ token, name, barNo }: { token: string; name: string; barNo: string }) {
  const [state, action, pending] = useActionState(saveCustomerAdvocate, null);
  return (
    <form action={action} className="mt-4 grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="token" value={token} />
      <label className="flex flex-col gap-1 text-sm font-medium">
        {copy.advocateName}
        <input name="advocateName" defaultValue={name} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {copy.advocateBar}
        <input name="advocateBarNo" defaultValue={barNo} className={field} />
      </label>
      <div className="sm:col-span-2">
        <ErrorLine error={state?.error} />
        <Button type="submit" variant="outline" className="mt-2 h-11 px-4" disabled={pending}>
          {pending ? "Saving…" : copy.advocateButton}
        </Button>
      </div>
    </form>
  );
}

export function OdrRescheduleForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(requestReschedule, null);
  return (
    <form action={action} className="mt-4 flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <label className="flex flex-col gap-1 text-sm font-medium">
        {copy.rescheduleWhen}
        <input name="preferred" type="date" className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {copy.rescheduleNote}
        <textarea name="note" required rows={3} className="rounded-lg border border-input bg-card px-3 py-2 text-sm" />
      </label>
      <ErrorLine error={state?.error} />
      <Button type="submit" variant="outline" className="h-11 w-fit px-4" disabled={pending}>
        {pending ? "Sending…" : copy.rescheduleButton}
      </Button>
    </form>
  );
}

export function OdrSettleForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(submitSettlement, null);
  return (
    <form action={action} className="mt-4 flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <label className="flex flex-col gap-1 text-sm font-medium">
        {copy.settleAmount}
        <input name="amount" required className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {copy.settleNote}
        <textarea name="note" rows={3} className="rounded-lg border border-input bg-card px-3 py-2 text-sm" />
      </label>
      <ErrorLine error={state?.error} />
      <Button type="submit" className="h-11 w-fit px-4" disabled={pending}>
        {pending ? "Sending…" : copy.settleButton}
      </Button>
    </form>
  );
}

export function OdrCustomerUploadForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(uploadCustomerDocument, null);
  return (
    <form action={action} className="mt-4 flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <select name="kind" className={field} defaultValue="DEFENCE">
        {CUSTOMER_DOCUMENT_KINDS.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
      <input name="file" type="file" accept="application/pdf,.pdf" required className="text-sm" />
      <ErrorLine error={state?.error} />
      <Button type="submit" variant="outline" className="h-11 w-fit px-4" disabled={pending}>
        {pending ? "Uploading…" : copy.uploadButton}
      </Button>
    </form>
  );
}
