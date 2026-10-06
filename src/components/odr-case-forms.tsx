"use client";

import { useActionState } from "react";
import {
  confirmOdrBatch,
  refreshAttendance,
  retryHearingMeet,
  saveCasePartyInfo,
  saveNeutral,
  scheduleBulkHearings,
  scheduleOneHearing,
  updateOdrStatus,
  uploadStaffDocument,
} from "@/app/actions/odr";
import { Button } from "@/components/ui/button";
import { ODR_STAGES, ODR_STATUSES, STAFF_DOCUMENT_KINDS } from "@/lib/odr-status";

const field = "h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal";

function ErrorLine({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {error}
    </p>
  );
}

export function OdrStatusForm({ caseId, status, stage, exParte }: { caseId: string; status: string; stage: string; exParte: boolean }) {
  const [state, action, pending] = useActionState(updateOdrStatus, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="caseId" value={caseId} />
      <label className="flex flex-col gap-1 text-sm font-medium">
        Status
        <select name="status" defaultValue={status} className={field}>
          {ODR_STATUSES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Stage on the customer page
        <select name="stage" defaultValue={stage} className={field}>
          {ODR_STAGES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="exParte" value="on" defaultChecked={exParte} className="size-4 accent-primary" />
        Ex parte
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Note
        <textarea name="note" rows={3} className="rounded-lg border border-input bg-card px-3 py-2 text-sm font-normal" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Order or award PDF (optional)
        <input name="file" type="file" accept="application/pdf,.pdf" className="text-sm" />
      </label>
      <input type="hidden" name="docKind" value="ORDER" />
      <ErrorLine error={state?.error} />
      <Button type="submit" className="h-11 w-fit px-4" disabled={pending}>
        {pending ? "Saving…" : "Update status"}
      </Button>
    </form>
  );
}

export function OdrDocumentForm({ caseId }: { caseId: string }) {
  const [state, action, pending] = useActionState(uploadStaffDocument, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="caseId" value={caseId} />
      <label className="flex flex-col gap-1 text-sm font-medium">
        Document
        <select name="kind" className={field} defaultValue="LOAN_AGREEMENT">
          {STAFF_DOCUMENT_KINDS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <input name="file" type="file" accept="application/pdf,.pdf" required className="text-sm" />
      <ErrorLine error={state?.error} />
      <Button type="submit" variant="outline" className="h-11 w-fit px-4" disabled={pending}>
        {pending ? "Uploading…" : "Upload PDF"}
      </Button>
    </form>
  );
}

export function OdrScheduleForm({
  caseId,
  flagged,
  duration,
}: {
  caseId: string;
  flagged: boolean;
  duration: number;
}) {
  const [state, action, pending] = useActionState(scheduleOneHearing, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="caseId" value={caseId} />
      <div className="grid gap-3 sm:grid-cols-3">
        <input name="hearingDate" type="date" required className={field} />
        <input name="hearingTime" type="time" required className={field} />
        <input name="duration" type="number" min={15} max={240} defaultValue={duration} required className={field} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="send" value="on" defaultChecked={!flagged} disabled={flagged} className="size-4 accent-primary" />
        Send the next-hearing message
      </label>
      {flagged ? (
        <p className="text-sm text-muted-foreground">
          This case has reached the no-show limit. Further automatic messages are stopped. The arbitrator may proceed ex parte or close the case.
        </p>
      ) : null}
      <ErrorLine error={state?.error} />
      <Button type="submit" className="h-11 w-fit px-4" disabled={pending}>
        {pending ? "Scheduling…" : "Schedule next hearing"}
      </Button>
    </form>
  );
}

export function OdrBulkScheduleForm() {
  const [state, action, pending] = useActionState(scheduleBulkHearings, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium">
        No-shows from this date
        <input name="fromDate" type="date" required className={field} />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <input name="hearingDate" type="date" required className={field} aria-label="Next hearing date" />
        <input name="hearingTime" type="time" required className={field} aria-label="Next hearing time" />
        <input name="duration" type="number" min={15} max={240} defaultValue={60} required className={field} aria-label="Session length" />
      </div>
      <ErrorLine error={state?.error} />
      <Button type="submit" className="h-11 w-fit px-4" disabled={pending}>
        {pending ? "Scheduling…" : "Schedule these hearings"}
      </Button>
    </form>
  );
}

export function OdrPartyForm({
  caseId,
  bankCounsel,
  bankContact,
  paymentInfo,
}: {
  caseId: string;
  bankCounsel: string;
  bankContact: string;
  paymentInfo: string;
}) {
  const [state, action, pending] = useActionState(saveCasePartyInfo, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="caseId" value={caseId} />
      <label className="flex flex-col gap-1 text-sm font-medium">
        Bank counsel or officer
        <input name="bankCounsel" defaultValue={bankCounsel} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Contact shown to the customer
        <textarea name="bankContact" defaultValue={bankContact} rows={2} className="rounded-lg border border-input bg-card px-3 py-2 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Payment details shown to the customer
        <textarea name="paymentInfo" defaultValue={paymentInfo} rows={2} className="rounded-lg border border-input bg-card px-3 py-2 text-sm" />
      </label>
      <ErrorLine error={state?.error} />
      <Button type="submit" variant="outline" className="h-11 w-fit px-4" disabled={pending}>
        {pending ? "Saving…" : "Save contact details"}
      </Button>
    </form>
  );
}

export function OdrAttendanceButton({ caseId }: { caseId: string }) {
  const [state, action, pending] = useActionState(refreshAttendance, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="caseId" value={caseId} />
      <ErrorLine error={state?.error} />
      <Button type="submit" variant="outline" className="h-11 w-fit px-4" disabled={pending}>
        {pending ? "Checking…" : "Refresh attendance"}
      </Button>
    </form>
  );
}

export function OdrConfirmForm({ batchId, live }: { batchId: string; live: boolean }) {
  const [state, action, pending] = useActionState(confirmOdrBatch, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="batchId" value={batchId} />
      <ErrorLine error={state?.error} />
      <Button type="submit" className="h-11 w-fit px-4" disabled={pending}>
        {pending ? "Working…" : live ? "Send hearing messages" : "Record hearings, do not send"}
      </Button>
    </form>
  );
}

export function OdrNeutralForm() {
  const [state, action, pending] = useActionState(saveNeutral, null);
  return (
    <form action={action} className="grid max-w-xl gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Name
        <input name="name" required className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Qualification
        <input name="qualification" className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Enrolment number
        <input name="enrolmentNo" className={field} />
      </label>
      <ErrorLine error={state?.error} />
      <Button type="submit" className="h-11 w-fit px-4" disabled={pending}>
        {pending ? "Saving…" : "Add to the list"}
      </Button>
    </form>
  );
}

export function OdrRetryMeetButton({ caseId, hearingId }: { caseId: string; hearingId: string }) {
  const [state, action, pending] = useActionState(retryHearingMeet, null);
  return (
    <form action={action}>
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="hearingId" value={hearingId} />
      <ErrorLine error={state?.error} />
      <Button type="submit" variant="outline" className="h-9 px-3" disabled={pending}>
        {pending ? "Trying…" : "Try Meet again"}
      </Button>
    </form>
  );
}
