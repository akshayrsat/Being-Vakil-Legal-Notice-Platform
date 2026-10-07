// The page a recipient opens from an SMS link. It shows one notice, or a not-found message.

import { headers } from "next/headers";
import { noticeGrantMatches } from "@/app/actions/notice-public";
import { NoticeLetterfoot, NoticeLetterhead, NoticeSignature } from "@/components/notice-letter";
import { NoticeVerifyForm } from "@/components/notice-verify-form";
import { PrintLetterButton } from "@/components/print-letter-button";
import { getCurrentUser } from "@/lib/auth";
import { last4Challenge, MOBILE_LAST4_PROMPT } from "@/lib/odr-ref";
import { noticeCustomerMobile } from "@/lib/public-notice";
import { buildDemandNotice } from "@/lib/demand-notice";
import { PrivacyPublicExtras } from "@/components/privacy-public";
import { grievanceFooter } from "@/lib/grievance";
import { legalNoticeParagraphs, usesStructuredDemand } from "@/lib/legal-notice-templates";
import {
  findPublicNotice,
  normalizeNoticeNumber,
  recordPublicNoticeOpen,
  shouldRecordNoticeView,
  type PublicNoticeView,
} from "@/lib/public-notice";

export async function PublicNoticeScreen({ noticeNumber }: { noticeNumber: string }) {
  const loaded = await loadNotice(noticeNumber);
  if (loaded.kind === "locked") return <NoticeLocked noticeNumber={loaded.noticeNumber} source={loaded.source} />;
  if (loaded.kind !== "ready") return <NoticeMissing kind={loaded.kind} />;
  return <PublicNoticeDocument notice={loaded.notice} />;
}

async function loadNotice(noticeNumber: string): Promise<
  | { kind: "empty" | "missing" | "error" }
  | { kind: "locked"; noticeNumber: string; source: "account" | "mobile" | "none" }
  | { kind: "ready"; notice: PublicNoticeView }
> {
  try {
    const normalized = normalizeNoticeNumber(noticeNumber);
    if (!normalized) return { kind: "empty" };
    const notice = await findPublicNotice(normalized);
    if (!notice) return { kind: "missing" };
    const staff = await getCurrentUser();
    const granted = staff ? true : await noticeGrantMatches(normalized);
    if (!granted) {
      const mobile = await noticeCustomerMobile(normalized);
      const challenge = last4Challenge(notice.loanNumber, mobile);
      return { kind: "locked", noticeNumber: normalized, source: challenge?.source ?? "none" };
    }
    if (!staff && shouldRecordNoticeView(await headers())) {
      await recordPublicNoticeOpen(normalized);
    }
    return { kind: "ready", notice };
  } catch (error) {
    console.error(error instanceof Error ? error.message : "notice page failed");
    return { kind: "error" };
  }
}

function NoticeLocked({ noticeNumber, source }: { noticeNumber: string; source: "account" | "mobile" | "none" }) {
  return (
    <main className="notice-screen">
      <div className="notice-stage">
        <article className="notice-sheet notice-letter bg-card shadow-sm ring-1 ring-foreground/10">
          <NoticeLetterhead />
          <h1 className="mt-8 font-serif text-3xl tracking-tight">Open your legal notice</h1>
          <p className="mt-3 text-base leading-7">
            {source === "mobile"
              ? MOBILE_LAST4_PROMPT
              : "Enter the last 4 digits of the loan or card account number in the message you received. The name, address, and loan details stay hidden until that matches."}
          </p>
          {source === "none" ? (
            <p className="mt-4 text-sm">This notice cannot be opened online. Please call Being Vakil Associates.</p>
          ) : (
            <NoticeVerifyForm noticeNumber={noticeNumber} source={source} />
          )}
          <NoticeLetterfoot />
        </article>
      </div>
      <PrivacyPublicExtras purpose="notice" />
    </main>
  );
}

function NoticeMissing({ kind }: { kind: "empty" | "missing" | "error" }) {
  return (
    <main className="notice-screen">
      <div className="notice-stage">
      <article className="notice-sheet notice-letter bg-card shadow-sm ring-1 ring-foreground/10">
        <NoticeLetterhead />
        <h1 className="mt-8 font-serif text-3xl tracking-tight">Notice not found</h1>
        <p className="mt-3 text-base leading-7">
          {kind === "empty"
            ? "Open the link from your message. It includes a notice number."
            : kind === "error"
              ? "This page could not be opened just now. Wait a moment and open the link again."
              : "This notice number is not on file. Check the link in your message, or contact the advocate who sent it."}
        </p>
        <NoticeLetterfoot />
      </article>
      </div>
      <PrivacyPublicExtras purpose="notice" />
    </main>
  );
}

function PublicNoticeDocument({ notice }: { notice: PublicNoticeView }) {
  if (!usesStructuredDemand(notice.documentFormat)) {
    return <FilledLegalNotice notice={notice} />;
  }
  const letter = buildDemandNotice({
    customerName: notice.customerName,
    address: notice.address,
    outstandingAmount: notice.outstandingAmount,
    loanNumber: notice.loanNumber,
    bankName: notice.bankName,
    loanType: notice.loanType,
    referenceNumber: notice.referenceNumber,
    collectionManager: notice.collectionManager,
    collectionManagerMobile: notice.collectionManagerMobile,
    bankWebsite: notice.bankWebsite,
    noticeNumber: notice.noticeNumber,
    dated: notice.createdAt,
  });

  return (
    <main className="notice-screen">
      <div className="no-print mb-3 flex w-full max-w-[210mm] justify-end">
        <PrintLetterButton />
      </div>
      <div className="notice-stage">
        <article className="notice-sheet notice-letter bg-card shadow-sm ring-1 ring-foreground/10">
          <NoticeLetterhead />
          <div className="notice-copy">
            <p className="notice-kicker">{letter.kicker}</p>
            <h1>{letter.title}</h1>
            <p>{letter.dateLine}</p>
            <p>{letter.referenceLine}</p>
            <p>To,</p>
            <p className="font-bold">{letter.addresseeName}</p>
            <p className="whitespace-pre-wrap">{letter.addresseeAddress}</p>
            <p>{letter.salutation}</p>
            <p className="font-bold">{letter.subject}</p>
            {letter.opening.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            <div className="notice-status">
              {letter.status.map((row) => (
                <p key={row.label}>
                  <span className="font-bold">{row.label} : </span>
                  {row.value}
                </p>
              ))}
            </div>
            {letter.closing.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          <NoticeClosing notice={notice} />
        </article>
      </div>
      <PrivacyPublicExtras purpose="notice" />
    </main>
  );
}

function FilledLegalNotice({ notice }: { notice: PublicNoticeView }) {
  const paragraphs = legalNoticeParagraphs(notice.body);
  const lines = paragraphs.length > 0 ? paragraphs : ["This notice has no wording."];
  return (
    <main className="notice-screen">
      <div className="no-print mb-3 flex w-full max-w-[210mm] justify-end">
        <PrintLetterButton />
      </div>
      <div className="notice-stage">
        <article className="notice-sheet notice-letter bg-card shadow-sm ring-1 ring-foreground/10">
          <NoticeLetterhead />
          <div className="notice-copy">
            {lines.map((paragraph, index) => (
              <p key={`${index}-${paragraph.slice(0, 24)}`} className="whitespace-pre-wrap">
                {paragraph}
              </p>
            ))}
          </div>
          <NoticeClosing notice={notice} />
        </article>
      </div>
      <PrivacyPublicExtras purpose="notice" />
    </main>
  );
}

function NoticeClosing({ notice }: { notice: PublicNoticeView }) {
  return (
    <div className="notice-closing">
      <NoticeSignature bankName={notice.bankName} />
      <GrievanceNote notice={notice} />
      <NoticeLetterfoot />
    </div>
  );
}

function GrievanceNote({ notice }: { notice: PublicNoticeView }) {
  return (
    <p className="notice-grievance whitespace-pre-wrap">
      {grievanceFooter({
        officerName: notice.grievanceOfficerName,
        officerPhone: notice.grievanceOfficerPhone,
        officerEmail: notice.grievanceOfficerEmail,
        ombudsman: notice.grievanceOmbudsman,
        wordingApprovedOn: notice.wordingApprovedOn,
      })}
    </p>
  );
}
