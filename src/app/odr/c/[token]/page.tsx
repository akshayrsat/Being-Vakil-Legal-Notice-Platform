import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { BrandLogo } from "@/components/brand-logo";
import {
  OdrAdvocateForm,
  OdrCustomerUploadForm,
  OdrRescheduleForm,
  OdrSettleForm,
  OdrVerifyForm,
} from "@/components/odr-customer-forms";
import { joinOdrHearing } from "@/app/actions/odr-public";
import { customerGrantMatches } from "@/app/actions/odr-public";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parsePanel } from "@/lib/odr-panel";
import { odrCopyFor } from "@/lib/odr-copy";
import { clientIp, clipAgent } from "@/lib/odr-access";
import { accountLast4, formatHearingDate, formatHearingTime, googleCalendarUrl, hearingTitle } from "@/lib/odr-ref";
import { nowMs } from "@/lib/odr-schedule";
import { customerCanSeeDocument } from "@/lib/odr-paper";
import { showSection12Line } from "@/lib/odr-notice-gate";
import { odrDocumentLabel, odrMatterLabel, odrNeutralRole, stageTracker } from "@/lib/odr-status";

export const metadata: Metadata = { title: "Your hearing" };

export default async function CustomerCasePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const item = /^[A-Za-z0-9_-]{20,}$/.test(token)
    ? await prisma.odrCase.findFirst({
        where: { publicToken: token },
        include: {
          bank: true,
          hearings: { orderBy: { number: "asc" } },
          documents: {
            orderBy: { createdAt: "desc" },
            select: { id: true, kind: true, fileName: true, uploadedBy: true },
          },
        },
      })
    : null;
  if (!item) return <Frame><Missing /></Frame>;
  const copy = odrCopyFor(item.matterType);
  const staff = await getCurrentUser();
  if (!staff && !(await customerGrantMatches(item.id))) {
    return (
      <Frame>
        <p className="text-xs font-medium tracking-[0.16em] text-primary uppercase">{copy.firmLine}</p>
        <h1 className="mt-3 font-serif text-4xl tracking-tight">{copy.verifyTitle}</h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">{copy.verifyBody}</p>
        {accountLast4(item.accountNumber) ? <OdrVerifyForm token={token} /> : <p className="mt-4 text-sm">{copy.verifyUnavailable}</p>}
      </Frame>
    );
  }

  if (!staff) {
    const headerList = await headers();
    await prisma.odrAccessLog.create({
      data: {
        caseId: item.id,
        bankId: item.bankId,
        kind: "OPEN",
        ip: clientIp(headerList.get("x-forwarded-for")),
        userAgent: clipAgent(headerList.get("user-agent")),
      },
    });
  }
  const panel = parsePanel(item.panelJson);
  const panelLabel = panel.length > 0 ? panel.map((member) => member.name).join(", ") : item.neutralName;

  const now = nowMs();
  const upcoming = [...item.hearings].reverse().find((hearing) => hearing.scheduledAt.getTime() > now - hearing.durationMinutes * 60 * 1000);
  const hearing = upcoming ?? item.hearings.at(-1);
  const end = hearing ? new Date(hearing.scheduledAt.getTime() + hearing.durationMinutes * 60 * 1000) : null;
  const calendar = hearing && end
    ? googleCalendarUrl({
        title: hearingTitle({ bank: item.bank.name, customer: item.customerName, refNo: item.refNo, number: hearing.number }),
        start: hearing.scheduledAt,
        end,
        details: `${item.bank.name} vs ${item.customerName}. Ref ${item.refNo}.`,
        location: hearing.meetLink,
      })
    : "";
  const stages = stageTracker(item.stage, item.matterType);
  const role = odrNeutralRole(item.matterType);

  return (
    <Frame>
      <p className="text-xs font-medium tracking-[0.16em] text-primary uppercase">{copy.firmLine}</p>
      <h1 className="mt-3 font-serif text-4xl tracking-tight">{copy.pageTitle}</h1>
      <p className="mt-3 text-sm text-muted-foreground">{copy.confidential}</p>

      <Section title={copy.caseHeading}>
        <p className="font-medium">{item.refNo}</p>
        <p className="mt-2">{odrMatterLabel(item.matterType)} · {item.bank.name} vs {item.customerName}{item.coParties ? " and ors" : ""}</p>
        <dl className="mt-4 grid gap-2 text-sm">
          <Row label="Customer" value={item.customerName} />
          <Row label="Co-borrowers / guarantors" value={item.coParties || "—"} />
          <Row label="Account" value={maskedAccount(item.accountNumber)} />
          <Row label="Branch" value={item.branch || "—"} />
          <Row label="Address" value={item.address || "—"} />
          <Row label="Claim" value={[item.claimAmount, item.asOnDate ? `as on ${item.asOnDate}` : ""].filter(Boolean).join(" ") || "—"} />
        </dl>
      </Section>

      <Section title={copy.disputeHeading}>
        <p className="whitespace-pre-wrap text-sm leading-6">{item.disputeSummary || "The firm will place a short summary here."}</p>
        <h3 className="mt-4 font-medium">{copy.documentsHeading}</h3>
        {item.documents.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{copy.noDocuments}</p> : (
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {item.documents.filter((doc) => customerCanSeeDocument(doc.kind)).map((doc) => (
              <li key={doc.id}>
                <a className="underline" href={`/odr/c/${token}/documents/${doc.id}`}>{odrDocumentLabel(doc.kind)} · {doc.fileName}</a>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-sm text-muted-foreground">{copy.uploadBody}</p>
        <OdrCustomerUploadForm token={token} />
      </Section>

      <Section title={copy.whoHeading}>
        <ul className="flex flex-col gap-2 text-sm leading-6">
          <li>{role}: {panelLabel || "To be confirmed"}</li>
          <li>Bank counsel / officer: {item.bankCounsel || `A representative of ${item.bank.name}`}</li>
          <li>Customer: {item.customerName}</li>
          {item.coParties ? <li>Co-borrowers / guarantors: {item.coParties}</li> : null}
          <li>Your advocate: {item.advocateName ? `${item.advocateName}${item.advocateBarNo ? `, ${item.advocateBarNo}` : ""}` : "You may add one below."}</li>
        </ul>
        <h3 className="mt-4 font-medium">{copy.advocateHeading}</h3>
        <OdrAdvocateForm token={token} name={item.advocateName} barNo={item.advocateBarNo} />
      </Section>

      <Section title={copy.rulesHeading}>
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-6">
          {copy.rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ol>
      </Section>

      <Section title={copy.neutralHeading}>
        {panel.length > 1 ? (
          <ul className="flex flex-col gap-2 text-sm">
            {panel.map((member) => (
              <li key={member.id || member.name}>
                <span className="font-medium">{member.name}</span>
                <span className="mt-1 block">{[member.qualification, member.enrolment].filter(Boolean).join(" · ")}</span>
              </li>
            ))}
          </ul>
        ) : (
          <>
            <p className="font-medium">{item.neutralName || "To be confirmed"}</p>
            <p className="mt-1 text-sm">{[item.neutralQualification, item.neutralEnrolment].filter(Boolean).join(" · ")}</p>
          </>
        )}
        {item.matterType === "MEDIATION" ? (
          <p className="mt-3 text-sm leading-6">{copy.independenceMediation}</p>
        ) : showSection12Line(item.matterType, item.documents.map((doc) => doc.kind)) ? (
          <p className="mt-3 text-sm leading-6">{copy.independenceArbitration}</p>
        ) : null}
      </Section>

      <Section title={copy.timelineHeading}>
        <ol className="flex flex-col gap-2">
          {stages.map((stage) => (
            <li key={stage.id} className="flex items-center gap-3 text-sm">
              <span className={`inline-flex size-6 items-center justify-center rounded-full text-xs ${stage.mark === "upcoming" ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"}`}>
                {stage.mark === "done" ? "✓" : stage.mark === "current" ? "•" : ""}
              </span>
              <span className={stage.mark === "current" ? "font-medium" : ""}>{stage.label}</span>
            </li>
          ))}
        </ol>
        {hearing ? (
          <div className="mt-5 rounded-lg border border-primary/30 px-4 py-4">
            <p className="text-sm text-muted-foreground">{copy.nextHearing}</p>
            <p className="mt-1 font-serif text-2xl">{formatHearingDate(hearing.scheduledAt)}</p>
            <p className="text-sm">{formatHearingTime(hearing.scheduledAt)} · {hearing.durationMinutes} minutes · Hearing {hearing.number}</p>
            {hearing.meetFake ? <p className="mt-2 text-sm text-muted-foreground">{copy.practiceMeet}</p> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <form action={joinOdrHearing}>
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="hearingId" value={hearing.id} />
                <button type="submit" className="inline-flex h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
                  {copy.join}
                </button>
              </form>
              {calendar ? (
                <a href={calendar} className="inline-flex h-11 items-center rounded-lg border border-border px-4 text-sm">
                  {copy.addToCalendar}
                </a>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm">{copy.noHearing}</p>
        )}
        <h3 className="mt-6 font-medium">{copy.rescheduleHeading}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{copy.rescheduleBody}</p>
        {item.rescheduleAt ? <p className="mt-3 text-sm">{copy.rescheduleReceived}</p> : <OdrRescheduleForm token={token} />}
      </Section>

      <Section title={copy.settleHeading}>
        <p className="text-sm leading-6 text-muted-foreground">{copy.settleBody}</p>
        {item.settlementAt ? (
          <p className="mt-3 text-sm">{copy.settleReceived} {item.settlementAmount}{item.settlementNote ? ` — ${item.settlementNote}` : ""}</p>
        ) : (
          <OdrSettleForm token={token} />
        )}
      </Section>

      {item.bankContact || item.paymentInfo ? (
        <Section title={copy.contactHeading}>
          {item.bankContact ? <p className="whitespace-pre-wrap text-sm leading-6">{item.bankContact}</p> : null}
          {item.paymentInfo ? (
            <>
              <h3 className="mt-4 font-medium">{copy.paymentHeading}</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{item.paymentInfo}</p>
            </>
          ) : null}
        </Section>
      ) : null}
    </Frame>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <div className="h-2 bg-primary" />
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-3xl items-center px-4 py-4 sm:px-6">
          <BrandLogo size="header" />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card px-5 py-5">
      <h2 className="font-serif text-2xl tracking-tight">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-wrap">{value}</dd>
    </div>
  );
}

function Missing() {
  return (
    <>
      <h1 className="font-serif text-4xl tracking-tight">Case not found</h1>
      <p className="mt-3 text-base leading-7 text-muted-foreground">Open the link from your message. If it still fails, call Being Vakil Associates.</p>
    </>
  );
}

function maskedAccount(account: string): string {
  const digits = account.replace(/\D/g, "");
  if (digits.length < 4) return "On file";
  return `Ending ${digits.slice(-4)}`;
}
