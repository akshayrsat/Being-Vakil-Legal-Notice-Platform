"use client";

import { useActionState, useState } from "react";
import {
  confirmOdrBatch,
  refreshAttendance,
  retryHearingMeet,
  removeRespondent,
  saveCasePartyInfo,
  saveRespondent,
  setPartyAttendance,
  saveBankPanel,
  saveNeutral,
  updateNeutral,
  scheduleBulkHearings,
  scheduleOneHearing,
  updateOdrStatus,
  uploadStaffDocument,
} from "@/app/actions/odr";
import { OdrSlotFields } from "@/components/odr-slot-fields";
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

export function OdrStatusForm({
  caseId,
  status,
  stage,
  exParte,
  matterType = "ARBITRATION",
  legalRoute = "",
}: {
  caseId: string;
  status: string;
  stage: string;
  exParte: boolean;
  matterType?: string;
  legalRoute?: string;
}) {
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
      {matterType === "MEDIATION" || legalRoute === "CONCILIATION" || legalRoute === "LOK_ADALAT" || legalRoute === "MEDIATION" ? (
        <p className="text-sm text-muted-foreground">
          {legalRoute === "LOK_ADALAT"
            ? "A Lok Adalat referral is not heard on this platform."
            : legalRoute === "CONCILIATION"
              ? "Conciliation is voluntary. A missed session is rescheduled or the matter is closed. It is not heard ex parte."
              : "Contractual mediation is voluntary. A missed session is rescheduled or the matter is closed. The session is not recorded."}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          {exParte
            ? "Ex parte is on because the arbitrator’s order is on the case."
            : "A no-show does not mark the case ex parte. Upload the arbitrator’s ex parte order when the arbitrator has made that order."}
        </p>
      )}
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
          This case has reached the no-show limit. Further automatic messages are stopped. Consider a final opportunity notice. Ex parte is not set until the arbitrator’s order is uploaded.
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
      <OdrSlotFields dateLabel="Next hearing date" />
      <p className="text-sm leading-6 text-muted-foreground">
        Each case keeps its arbitrator. Times step through the day, and a case at the no-show limit is recorded without a message.
      </p>
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
  claimReference = "",
  defenceDeadline = "",
  matterType = "ARBITRATION",
}: {
  caseId: string;
  bankCounsel: string;
  bankContact: string;
  paymentInfo: string;
  claimReference?: string;
  defenceDeadline?: string;
  matterType?: string;
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
      {matterType === "ARBITRATION" ? (
        <>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Statement of claim reference
            <input name="claimReference" defaultValue={claimReference} className={field} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Defence or reply by
            <input name="defenceDeadline" type="date" defaultValue={defenceDeadline} className={field} />
          </label>
        </>
      ) : null}
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

const partyField = "h-11 rounded-lg border border-input bg-card px-3 text-sm";

export function OdrRespondentEditor({
  caseId,
  party,
}: {
  caseId: string;
  party?: { id: string; name: string; role: string; mobile: string; email: string; address: string };
}) {
  const [state, action, pending] = useActionState(saveRespondent, null);
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-2">
      <input type="hidden" name="caseId" value={caseId} />
      {party ? <input type="hidden" name="respondentId" value={party.id} /> : null}
      <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
        Name
        <input name="name" required defaultValue={party?.name ?? ""} className={partyField} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Role
        <select name="role" defaultValue={party?.role === "Guarantor" ? "Guarantor" : "Co-borrower"} className={partyField}>
          <option>Co-borrower</option>
          <option>Guarantor</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Mobile
        <input name="mobile" defaultValue={party?.mobile ?? ""} className={partyField} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Email
        <input name="email" type="email" defaultValue={party?.email ?? ""} className={partyField} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
        Address
        <textarea name="address" defaultValue={party?.address ?? ""} rows={2} className="rounded-lg border border-input bg-card px-3 py-2 text-sm" />
      </label>
      <div className="sm:col-span-2">
        <ErrorLine error={state?.error} />
        <Button type="submit" variant="outline" className="h-11 w-fit px-4" disabled={pending}>
          {pending ? "Saving…" : party ? "Save co-party" : "Add co-party"}
        </Button>
      </div>
    </form>
  );
}

export function OdrRemoveRespondent({ caseId, respondentId }: { caseId: string; respondentId: string }) {
  const [state, action, pending] = useActionState(removeRespondent, null);
  return (
    <form action={action}>
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="respondentId" value={respondentId} />
      <ErrorLine error={state?.error} />
      <Button type="submit" variant="outline" className="h-9 px-3" disabled={pending}>
        {pending ? "Removing…" : "Remove"}
      </Button>
    </form>
  );
}

export function OdrPartyAttendanceButtons({
  caseId,
  hearingId,
  respondentId,
}: {
  caseId: string;
  hearingId: string;
  respondentId: string;
}) {
  const [state, action, pending] = useActionState(setPartyAttendance, null);
  return (
    <div className="flex flex-col gap-2">
      <ErrorLine error={state?.error} />
      <div className="flex flex-wrap gap-2">
        {(["JOINED", "NO_SHOW"] as const).map((attendance) => (
          <form key={attendance} action={action}>
            <input type="hidden" name="caseId" value={caseId} />
            <input type="hidden" name="hearingId" value={hearingId} />
            <input type="hidden" name="respondentId" value={respondentId} />
            <input type="hidden" name="attendance" value={attendance} />
            <Button type="submit" variant="outline" className="h-9 px-3" disabled={pending}>
              {attendance === "JOINED" ? "Joined" : "No-show"}
            </Button>
          </form>
        ))}
      </div>
    </div>
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
        Email
        <input name="email" type="email" required autoComplete="off" className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Mobile
        <input name="mobile" inputMode="numeric" required autoComplete="tel" className={field} />
      </label>
      <fieldset className="flex flex-col gap-1 text-sm font-medium">
        <legend>Roles</legend>
        <label className="flex items-center gap-2 font-normal"><input type="checkbox" name="role" value="ARBITRATOR" defaultChecked className="size-4 accent-primary" /> Arbitrator</label>
        <label className="flex items-center gap-2 font-normal"><input type="checkbox" name="role" value="MEDIATOR" className="size-4 accent-primary" /> Mediator</label>
        <label className="flex items-center gap-2 font-normal"><input type="checkbox" name="role" value="CONCILIATOR" className="size-4 accent-primary" /> Conciliator</label>
      </fieldset>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Court or LSA panel
        <input name="empanelment" className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Mediation Council registration number
        <input name="mciRegistration" className={field} />
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

export function OdrNeutralEditForm({
  neutral,
}: {
  neutral: {
    id: string;
    name: string;
    qualification: string;
    enrolmentNo: string;
    email: string;
    mobile: string;
    active: boolean;
    roles: string;
    empanelment: string;
    mciRegistration: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(updateNeutral, null);
  if (!open) {
    return (
      <Button type="button" variant="outline" className="mt-2 h-9 px-3" onClick={() => setOpen(true)}>
        Edit
      </Button>
    );
  }
  return (
    <form action={action} className="mt-3 grid max-w-xl gap-3">
      <input type="hidden" name="neutralId" value={neutral.id} />
      <label className="flex flex-col gap-1 text-sm font-medium">
        Name
        <input name="name" required defaultValue={neutral.name} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Qualification
        <input name="qualification" defaultValue={neutral.qualification} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Enrolment number
        <input name="enrolmentNo" defaultValue={neutral.enrolmentNo} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Email
        <input name="email" type="email" required defaultValue={neutral.email} autoComplete="off" className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Mobile
        <input name="mobile" inputMode="numeric" required defaultValue={neutral.mobile} autoComplete="tel" className={field} />
      </label>
      <fieldset className="flex flex-col gap-1 text-sm font-medium">
        <legend>Roles</legend>
        {(["ARBITRATOR", "MEDIATOR", "CONCILIATOR"] as const).map((role) => (
          <label key={role} className="flex items-center gap-2 font-normal">
            <input type="checkbox" name="role" value={role} defaultChecked={neutral.roles.split(",").includes(role)} className="size-4 accent-primary" />
            {role === "ARBITRATOR" ? "Arbitrator" : role === "MEDIATOR" ? "Mediator" : "Conciliator"}
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Court or LSA panel
        <input name="empanelment" defaultValue={neutral.empanelment} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Mediation Council registration number
        <input name="mciRegistration" defaultValue={neutral.mciRegistration} className={field} />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" value="yes" defaultChecked={neutral.active} className="size-4 accent-primary" />
        Active
      </label>
      <ErrorLine error={state?.error} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="h-11 px-4" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
        <Button type="button" variant="outline" className="h-11 px-4" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>
    </form>
  );
}

export function OdrBankPanelForm({
  bankName,
  neutrals,
  selectedIds,
}: {
  bankName: string;
  neutrals: Array<{ id: string; name: string; qualification: string; enrolmentNo: string; email: string; mobile: string; active: boolean }>;
  selectedIds: string[];
}) {
  const [state, action, pending] = useActionState(saveBankPanel, null);
  const selected = new Set(selectedIds);
  return (
    <form action={action} className="flex flex-col gap-3">
      <p className="text-sm leading-6 text-muted-foreground">
        Panel for {bankName}. Tick at least 3 names. Each needs a qualification, an enrolment number, an email, and a 10-digit mobile. Invites, the morning list, and hearing notices use those saved details. The customer can choose one of these names after the dispute.
      </p>
      <ul className="flex flex-col gap-2">
        {neutrals.filter((neutral) => neutral.active).map((neutral) => (
          <li key={neutral.id}>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="neutralId" value={neutral.id} defaultChecked={selected.has(neutral.id)} className="mt-1 size-4 accent-primary" />
              <span>
                {neutral.name}
                {neutral.qualification ? ` · ${neutral.qualification}` : ""}
                {neutral.enrolmentNo ? ` · ${neutral.enrolmentNo}` : ""}
                {neutral.email ? ` · ${neutral.email}` : ""}
                {neutral.mobile ? ` · ${neutral.mobile}` : ""}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <ErrorLine error={state?.error} />
      <Button type="submit" className="h-11 w-fit px-4" disabled={pending}>
        {pending ? "Saving…" : "Save this bank’s panel"}
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
