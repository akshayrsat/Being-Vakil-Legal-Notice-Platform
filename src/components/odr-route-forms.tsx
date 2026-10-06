"use client";

import { useActionState } from "react";
import {
  saveCaseLegalRoute,
  saveCaseSettlementTerms,
  saveCaseTimers,
  saveLokAdalatStatus,
  uploadNeutralFile,
} from "@/app/actions/odr";
import { recordConciliationReply } from "@/app/actions/odr-public";
import { Button } from "@/components/ui/button";
import { LEGAL_ROUTES, legalRouteLabel } from "@/lib/odr-route";

const field = "h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal";

function ErrorLine({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {error}
    </p>
  );
}

export function OdrLegalRouteForm({ caseId, legalRoute }: { caseId: string; legalRoute: string }) {
  const [state, action, pending] = useActionState(saveCaseLegalRoute, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="caseId" value={caseId} />
      <label className="flex flex-col gap-1 text-sm font-medium">
        Legal route
        <select name="legalRoute" defaultValue={legalRoute} className={field}>
          {LEGAL_ROUTES.map((route) => (
            <option key={route} value={route}>{legalRouteLabel(route)}</option>
          ))}
        </select>
      </label>
      <p className="text-sm leading-6 text-muted-foreground">
        The route sets the customer-page wording, the document that can be generated, and whether an ex parte order is possible. Ex parte is only for arbitration.
      </p>
      <ErrorLine error={state?.error} />
      <Button type="submit" variant="outline" className="h-11 w-fit px-4" disabled={pending}>
        {pending ? "Saving…" : "Save route"}
      </Button>
    </form>
  );
}

export function OdrTimersForm({
  caseId,
  limitationDate,
  pleadingsClosedOn,
  awardExtension,
  awardDeliveredOn,
  processDeadlineOn,
  showAward,
  showProcess,
}: {
  caseId: string;
  limitationDate: string;
  pleadingsClosedOn: string;
  awardExtension: boolean;
  awardDeliveredOn: string;
  processDeadlineOn: string;
  showAward: boolean;
  showProcess: boolean;
}) {
  const [state, action, pending] = useActionState(saveCaseTimers, null);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="caseId" value={caseId} />
      <label className="flex flex-col gap-1 text-sm font-medium">
        Limitation date
        <input name="limitationDate" type="date" defaultValue={limitationDate} className={field} />
      </label>
      {showAward ? (
        <label className="flex flex-col gap-1 text-sm font-medium">
          Pleadings completed
          <input name="pleadingsClosedOn" type="date" defaultValue={pleadingsClosedOn} className={field} />
        </label>
      ) : <input type="hidden" name="pleadingsClosedOn" value={pleadingsClosedOn} />}
      {showAward ? (
        <label className="flex flex-col gap-1 text-sm font-medium">
          Award delivered
          <input name="awardDeliveredOn" type="date" defaultValue={awardDeliveredOn} className={field} />
        </label>
      ) : <input type="hidden" name="awardDeliveredOn" value={awardDeliveredOn} />}
      {showProcess ? (
        <label className="flex flex-col gap-1 text-sm font-medium">
          Conciliation or mediation deadline
          <input name="processDeadlineOn" type="date" defaultValue={processDeadlineOn} className={field} />
        </label>
      ) : <input type="hidden" name="processDeadlineOn" value={processDeadlineOn} />}
      {showAward ? (
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="awardExtension" value="yes" defaultChecked={awardExtension} className="size-4 accent-primary" />
          Parties agreed a 6-month extension of the Section 29A period
        </label>
      ) : null}
      <div className="sm:col-span-2">
        <ErrorLine error={state?.error} />
        <Button type="submit" variant="outline" className="h-11 px-4" disabled={pending}>
          {pending ? "Saving…" : "Save dates"}
        </Button>
      </div>
    </form>
  );
}

export function OdrSettlementTermsForm({
  caseId,
  sanctionRef,
  instalmentMonths,
}: {
  caseId: string;
  sanctionRef: string;
  instalmentMonths: number;
}) {
  const [state, action, pending] = useActionState(saveCaseSettlementTerms, null);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="caseId" value={caseId} />
      <label className="flex flex-col gap-1 text-sm font-medium">
        Bank settlement sanction reference
        <input name="settlementSanctionRef" defaultValue={sanctionRef} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Instalment months
        <input name="settlementInstalmentMonths" type="number" min={0} max={120} defaultValue={instalmentMonths} className={field} />
      </label>
      <p className="text-sm leading-6 text-muted-foreground sm:col-span-2">
        A settlement or conciliation document is not generated until the sanction reference is entered. More than 3 months of instalments is a restructuring and needs the bank’s credit approval.
      </p>
      {instalmentMonths > 3 ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive sm:col-span-2" role="status">
          Instalments longer than 3 months count as restructuring. The bank’s credit approval is required.
        </p>
      ) : null}
      <div className="sm:col-span-2">
        <ErrorLine error={state?.error} />
        <Button type="submit" variant="outline" className="h-11 px-4" disabled={pending}>
          {pending ? "Saving…" : "Save settlement terms"}
        </Button>
      </div>
    </form>
  );
}

export function OdrLokAdalatForm({ caseId, status }: { caseId: string; status: string }) {
  const [state, action, pending] = useActionState(saveLokAdalatStatus, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="caseId" value={caseId} />
      <label className="flex flex-col gap-1 text-sm font-medium">
        Lok Adalat outcome
        <select name="lokAdalatStatus" defaultValue={status || "referred"} className={field}>
          <option value="referred">Referred</option>
          <option value="settled">Settled</option>
          <option value="not_settled">Not settled</option>
        </select>
      </label>
      <p className="text-sm leading-6 text-muted-foreground">
        Hearings are not scheduled here. Export the pack for the DLSA or DRT Lok Adalat, then record the outcome. Upload the award when the Lok Adalat makes one.
      </p>
      <div className="flex flex-wrap gap-2 text-sm">
        <a className="underline" href={`/odr/cases/${caseId}/lok-adalat?format=csv`}>Download CSV</a>
        <a className="underline" href={`/odr/cases/${caseId}/lok-adalat?format=xlsx`}>Download Excel</a>
        <a className="underline" href={`/odr/cases/${caseId}/lok-adalat?format=docx`}>Download summary</a>
      </div>
      <ErrorLine error={state?.error} />
      <Button type="submit" variant="outline" className="h-11 w-fit px-4" disabled={pending}>
        {pending ? "Saving…" : "Save outcome"}
      </Button>
    </form>
  );
}

export function OdrNeutralFileForm({ neutralId }: { neutralId: string }) {
  const [state, action, pending] = useActionState(uploadNeutralFile, null);
  return (
    <form action={action} className="mt-3 flex flex-col gap-2">
      <input type="hidden" name="neutralId" value={neutralId} />
      <label className="flex flex-col gap-1 text-sm font-medium">
        Certificate or declaration
        <select name="kind" className={field} defaultValue="MCPC_CERTIFICATE">
          <option value="MCPC_CERTIFICATE">MCPC 40-hour training certificate</option>
          <option value="INDEPENDENCE_DECLARATION">Annual independence declaration</option>
        </select>
      </label>
      <input name="file" type="file" accept="application/pdf,.pdf" required className="text-sm" />
      <ErrorLine error={state?.error} />
      <Button type="submit" variant="outline" className="h-9 w-fit px-3" disabled={pending}>
        {pending ? "Uploading…" : "Upload PDF"}
      </Button>
    </form>
  );
}

export function OdrConciliationReplyForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(recordConciliationReply, null);
  return (
    <form action={action} className="mt-4 flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Your reply to the invitation</legend>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="choice" value="ACCEPT" required className="mt-1 size-4 accent-primary" />
          Accept conciliation
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="choice" value="DECLINE" className="mt-1 size-4 accent-primary" />
          Decline
        </label>
      </fieldset>
      <ErrorLine error={state?.error} />
      <Button type="submit" className="h-11 w-fit px-4" disabled={pending}>
        {pending ? "Recording…" : "Record my reply"}
      </Button>
    </form>
  );
}
