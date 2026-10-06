import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  OdrAttendanceButton,
  OdrDocumentForm,
  OdrPartyAttendanceButtons,
  OdrPartyForm,
  OdrRemoveRespondent,
  OdrRespondentEditor,
  OdrRetryMeetButton,
  OdrScheduleForm,
  OdrStatusForm,
} from "@/components/odr-case-forms";
import { OdrSignedUpload } from "@/components/odr-paper-form";
import { CustomerPageLinks } from "@/components/customer-page-links";
import { OdrBackLink } from "@/components/odr-back-link";
import { DeskShell } from "@/components/desk-shell";
import { getCurrentUser } from "@/lib/auth";
import { workingBank } from "@/lib/bank-context";
import { deliveryStatusLabel } from "@/lib/campaigns";
import { prisma } from "@/lib/db";
import { formatIndiaDateTime } from "@/lib/india-day";
import { parsePanel } from "@/lib/odr-panel";
import { casePageUrl } from "@/lib/odr-runner";
import { formatHearingDate, formatHearingTime, hearingOrdinal } from "@/lib/odr-ref";
import { nowMs } from "@/lib/odr-schedule";
import { bankUserCanSeeDocument } from "@/lib/odr-paper";
import { odrDocumentLabel, odrMatterLabel, odrNeutralRole, odrStatusLabel } from "@/lib/odr-status";
import { odrCaseBack } from "@/lib/odr-back";
import { arbitrationNoticeError, arbitrationNoticeGaps } from "@/lib/odr-notice-gate";
import { loadAppointmentConsent } from "@/lib/odr-consent-store";
import { redactCell } from "@/lib/data-min";
import { partyAttendanceLabel, partyAttendanceMap } from "@/lib/odr-parties";
import { readOdrRules } from "@/lib/odr-store";
import { canSendNotices, isBankUser } from "@/lib/roles";
import { hideVendorWording, seesVendorDetail } from "@/lib/staff-language";

export const metadata: Metadata = { title: "ODR case" };

export default async function OdrCasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ attendance?: string; from?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const bank = workingBank(user);
  if (!bank) redirect("/odr/cases");
  const { id } = await params;
  const query = await searchParams;
  const item = await prisma.odrCase.findFirst({
    where: { id, bankId: bank.id },
    include: {
      hearings: { orderBy: { number: "asc" } },
      respondents: { orderBy: { sortOrder: "asc" } },
      messages: { orderBy: { createdAt: "asc" } },
      documents: { orderBy: { createdAt: "desc" }, select: { id: true, kind: true, fileName: true, uploaderName: true, createdAt: true, note: true } },
      statusEvents: { orderBy: { createdAt: "desc" } },
      accessLogs: { orderBy: { createdAt: "desc" }, take: 30 },
      alerts: { where: { readAt: null }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!item) notFound();
  const canSend = canSendNotices(user.role);
  const rules = await readOdrRules();
  const noticeGaps = arbitrationNoticeGaps(item.matterType, item.documents.map((doc) => doc.kind));
  const appointment = await loadAppointmentConsent(item);
  const technical = seesVendorDetail(user);
  const now = nowMs();
  const nextHearing = [...item.hearings].reverse().find((hearing) => hearing.scheduledAt.getTime() > now) ?? item.hearings.at(-1);
  const panel = parsePanel(item.panelJson);

  return (
    <DeskShell user={user}>
      <OdrBackLink target={odrCaseBack({ bankUser: isBankUser(user.role), from: query.from })} />
      <div>
        <h1 className="font-serif text-4xl tracking-tight">{item.refNo}</h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          {bank.name} vs {item.customerName}
          {item.coParties ? ` and ${item.coParties}` : ""}. {odrMatterLabel(item.matterType)}. {odrStatusLabel(item.status)}
          {item.matterType !== "MEDIATION" && item.exParte ? ". Ex parte, on the arbitrator’s order." : "."}
        </p>
        {canSend ? (
          <div className="mt-4">
            <CustomerPageLinks href={casePageUrl(item.publicToken)} />
          </div>
        ) : null}
      </div>

      {item.settlementAmount ? (
        <p className="rounded-lg border border-primary/30 bg-card px-3 py-2 text-sm">
          Settlement offer: {item.settlementAmount}
          {item.settlementNote ? ` — ${item.settlementNote}` : ""}
        </p>
      ) : null}
      {canSend ? (
        <section className="rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10">
          <h2 className="font-serif text-2xl">Award and settlement</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Prepare a Word draft from the case. Nothing is sent to the customer. After you sign it offline, upload the signed file.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {item.matterType === "ARBITRATION" ? (
              <Link href={`/odr/cases/${item.id}/paper?kind=award`} className="inline-flex h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
                Generate award
              </Link>
            ) : null}
            {item.matterType === "MEDIATION" ? (
              <Link href={`/odr/cases/${item.id}/paper?kind=settlement`} className="inline-flex h-11 items-center rounded-lg border border-border px-4 text-sm">
                Generate settlement agreement
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      {item.alerts.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {item.alerts.map((alert) => (
            <li key={alert.id} className="rounded-lg border border-border bg-card px-3 py-2 text-sm">{alert.summary}</li>
          ))}
        </ul>
      ) : null}
      {item.matterType === "ARBITRATION" ? (
        <section className="rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10">
          <h2 className="font-serif text-2xl">Appointment</h2>
          <p className="mt-2 text-sm leading-6">{item.appointmentMode || "No appointment mode recorded."}</p>
          <p className="mt-1 text-sm">Nominated by the bank: {item.nominatedNeutralName || item.neutralName || "—"}</p>
          <p className="mt-1 text-sm">
            Consent: {appointment.consent
              ? `${appointment.consent.choice === "ACCEPT" ? "Accepted" : appointment.consent.choice === "PANEL" ? `Chose ${appointment.consent.chosenNeutralName}` : "Objected"} · ${appointment.consent.recordedAtIst} · ${appointment.consent.typedName}`
              : appointment.phase === "override"
                ? "A Section 11 order or a signed consent is on the case."
                : appointment.phase === "expired"
                  ? "No choice within the allowed days."
                  : "Waiting for the customer."}
          </p>
          {appointment.warning ? (
            <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="status">
              {appointment.warning}
            </p>
          ) : null}
          {isBankUser(user.role) ? (
            <p className="mt-3 text-sm text-muted-foreground">You can read this status. You cannot change it.</p>
          ) : null}
        </section>
      ) : null}

      {item.rescheduleAt ? (
        <p className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
          Reschedule request: {item.reschedulePreferred || "No date given"}. {item.rescheduleNote}
        </p>
      ) : null}
      {query.attendance === "1" ? <p className="text-sm">Attendance check finished. A practice Meet link is marked by hand.</p> : null}

      <section className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10">
          <h2 className="font-serif text-2xl">Parties</h2>
          <dl className="mt-3 grid gap-2 text-sm">
            <div><dt className="text-muted-foreground">Customer</dt><dd>{item.customerName}</dd></div>
            <div><dt className="text-muted-foreground">Sheet note</dt><dd>{item.coParties || "—"}</dd></div>
            <div><dt className="text-muted-foreground">Account</dt><dd>{redactCell(item.accountNumber) || "—"}</dd></div>
            <div><dt className="text-muted-foreground">Branch</dt><dd>{item.branch || "—"}</dd></div>
            <div><dt className="text-muted-foreground">Mobile</dt><dd>{item.mobile || "—"}</dd></div>
            <div><dt className="text-muted-foreground">Email</dt><dd>{item.email || "—"}</dd></div>
            <div><dt className="text-muted-foreground">Address</dt><dd className="whitespace-pre-wrap">{item.address || "—"}</dd></div>
            <div><dt className="text-muted-foreground">Loan amount</dt><dd>{item.loanAmount || "—"}</dd></div>
            <div><dt className="text-muted-foreground">Claim</dt><dd>{item.claimAmount || "—"} {item.asOnDate ? `as on ${item.asOnDate}` : ""}</dd></div>
            <div><dt className="text-muted-foreground">Customer’s advocate</dt><dd>{item.advocateName || "—"} {item.advocateBarNo}</dd></div>
          </dl>
          {item.respondents.length > 0 ? (
            <ul className="mt-4 flex flex-col gap-4 border-t border-border pt-4 text-sm">
              {item.respondents.map((party) => (
                <li key={party.id} className="flex flex-col gap-2">
                  <p className="font-medium">{party.name} · {party.role}</p>
                  <p className="text-muted-foreground">{[party.mobile, party.email, party.address].filter(Boolean).join(" · ") || "No contact on file"}</p>
                  {canSend ? (
                    <>
                      <CustomerPageLinks href={casePageUrl(party.publicToken)} />
                      <OdrRespondentEditor caseId={item.id} party={party} />
                      <OdrRemoveRespondent caseId={item.id} respondentId={party.id} />
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {canSend ? (
            <div className="mt-4 border-t border-border pt-4">
              <h3 className="font-medium">Add a co-borrower or guarantor</h3>
              <div className="mt-3">
                <OdrRespondentEditor caseId={item.id} />
              </div>
            </div>
          ) : null}
        </article>
        <article className="rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10">
          <h2 className="font-serif text-2xl">{odrNeutralRole(item.matterType)}</h2>
          {panel.length > 1 ? (
            <ul className="mt-3 flex flex-col gap-2 text-sm leading-6">
              {panel.map((member) => (
                <li key={member.id || member.name}>
                  {member.name}
                  {member.qualification ? `, ${member.qualification}` : ""}
                  {member.enrolment ? `. Enrolment ${member.enrolment}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm leading-6">
              {item.neutralName || "Not named"}
              {item.neutralQualification ? `, ${item.neutralQualification}` : ""}
              {item.neutralEnrolment ? `. Enrolment ${item.neutralEnrolment}` : ""}
            </p>
          )}
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.disputeSummary || "No dispute summary."}</p>
          {nextHearing ? (
            <p className="mt-2 text-sm">
              Hearing {nextHearing.number} ({hearingOrdinal(nextHearing.number)}) on {formatHearingDate(nextHearing.scheduledAt)} at {formatHearingTime(nextHearing.scheduledAt)}.
            </p>
          ) : null}
        </article>
      </section>

      <section>
        <h2 className="font-serif text-2xl">Hearings</h2>
        <ul className="mt-3 flex flex-col gap-3">
          {item.hearings.map((hearing) => (
            <li key={hearing.id} className="rounded-xl bg-card px-4 py-4 text-sm ring-1 ring-foreground/10">
              <p className="font-medium">
                Hearing {hearing.number} · {formatIndiaDateTime(hearing.scheduledAt)} · {hearing.attendance}
                {hearing.attendanceSource === "staff" ? " (staff)" : hearing.attendanceSource === "auto" ? " (Meet)" : ""}
              </p>
              <p className="mt-1 break-all text-muted-foreground">
                {hearing.meetLink || "Meet link not ready"}
                {hearing.meetFake ? " · Practice link, not a real Google Meet" : ""}
                {hearing.meetError && hearing.meetError !== "CREATING" ? ` · ${hearing.meetError}` : ""}
              </p>
              {item.respondents.length > 0 ? (
                <ul className="mt-3 flex flex-col gap-2">
                  {item.respondents.map((party) => {
                    const mark = partyAttendanceMap(hearing.partyAttendance)[party.id] ?? "";
                    return (
                      <li key={party.id} className="flex flex-col gap-2">
                        <p>{party.name} · {party.role} · {partyAttendanceLabel(mark)}</p>
                        {canSend ? (
                          <OdrPartyAttendanceButtons caseId={item.id} hearingId={hearing.id} respondentId={party.id} />
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              {canSend && !hearing.meetLink ? <OdrRetryMeetButton caseId={item.id} hearingId={hearing.id} /> : null}
            </li>
          ))}
        </ul>
        {canSend ? (
          <div className="mt-4">
            <OdrAttendanceButton caseId={item.id} />
          </div>
        ) : null}
      </section>

      <section>
        <h2 className="font-serif text-2xl">Messages</h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {item.messages.map((message) => (
            <li key={message.id} className="rounded-lg border border-border px-3 py-2">
              <p>
                {message.kind} · {message.channel} · {message.toAddress || "—"} · {deliveryStatusLabel(message.status, technical)}
              </p>
              <p className="text-muted-foreground">{hideVendorWording(message.detail, technical) || "—"}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-serif text-2xl">Documents</h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {item.documents.filter((doc) => canSend || bankUserCanSeeDocument(doc.kind)).map((doc) => (
            <li key={doc.id}>
              <a href={`/odr/cases/${item.id}/documents/${doc.id}`} className="underline">
                {odrDocumentLabel(doc.kind)} · {doc.fileName}
              </a>
              <span className="text-muted-foreground"> · {doc.note ? `${doc.note} · ` : ""}{doc.uploaderName || "Staff"} · {formatIndiaDateTime(doc.createdAt)}</span>
            </li>
          ))}
        </ul>
        {canSend ? (
          <div className="mt-4 flex flex-col gap-6">
            <OdrDocumentForm caseId={item.id} />
            {item.matterType === "ARBITRATION" ? <OdrSignedUpload caseId={item.id} which="award" /> : null}
            {item.matterType === "MEDIATION" ? <OdrSignedUpload caseId={item.id} which="settlement" /> : null}
          </div>
        ) : null}
      </section>

      <section>
        <h2 className="font-serif text-2xl">Status history</h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {item.statusEvents.map((event) => (
            <li key={event.id}>
              {formatIndiaDateTime(event.createdAt)} · {odrStatusLabel(event.status)}
              {event.exParte ? " · Ex parte" : ""} · {event.actorName || "System"}
              {event.note ? ` · ${event.note}` : ""}
            </li>
          ))}
        </ul>
        {canSend ? (
          <div className="mt-4 max-w-xl">
            <OdrStatusForm caseId={item.id} status={item.status} stage={item.stage} exParte={item.exParte} matterType={item.matterType} />
          </div>
        ) : null}
      </section>

      {canSend ? (
        <section className="grid gap-6 lg:grid-cols-2">
          <div>
            <h2 className="font-serif text-2xl">Next hearing</h2>
            {noticeGaps.length > 0 ? (
              <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="status">
                {arbitrationNoticeError(noticeGaps)}
              </p>
            ) : null}
            <div className="mt-3">
              <OdrScheduleForm caseId={item.id} flagged={item.flaggedExParte || item.noShowCount >= rules.maxNoShow} duration={item.hearings.at(-1)?.durationMinutes ?? 60} />
            </div>
          </div>
          <div>
            <h2 className="font-serif text-2xl">Shown to the customer</h2>
            <div className="mt-3">
              <OdrPartyForm
                caseId={item.id}
                bankCounsel={item.bankCounsel}
                bankContact={item.bankContact}
                paymentInfo={item.paymentInfo}
                claimReference={item.claimReference}
                defenceDeadline={item.defenceDeadline}
                matterType={item.matterType}
              />
            </div>
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="font-serif text-2xl">Customer page log</h2>
        <ul className="mt-3 flex flex-col gap-1 text-sm text-muted-foreground">
          {item.accessLogs.map((log) => (
            <li key={log.id}>
              {formatIndiaDateTime(log.createdAt)} · {log.kind} · {log.ip || "—"}
            </li>
          ))}
          {item.accessLogs.length === 0 ? <li>No opens yet.</li> : null}
        </ul>
      </section>
    </DeskShell>
  );
}
