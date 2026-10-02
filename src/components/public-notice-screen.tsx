// The page a recipient opens from an SMS link. It shows one notice, or a not-found message.

import { NoticeLetterfoot, NoticeLetterhead, NoticeSignature } from "@/components/notice-letter";
import { PrintLetterButton } from "@/components/print-letter-button";
import { findPublicNotice, normalizeNoticeNumber, type PublicNoticeView } from "@/lib/public-notice";

export async function PublicNoticeScreen({ noticeNumber }: { noticeNumber: string }) {
  const normalized = normalizeNoticeNumber(noticeNumber);
  if (!normalized) return <NoticeMissing kind="empty" />;
  const notice = await findPublicNotice(normalized);
  if (!notice) return <NoticeMissing kind="missing" />;
  return <PublicNoticeDocument notice={notice} />;
}

function NoticeMissing({ kind }: { kind: "empty" | "missing" }) {
  return (
    <main className="notice-screen mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 py-8 sm:py-12">
      <article className="notice-letter bg-card px-5 py-8 shadow-sm ring-1 ring-foreground/10 sm:px-10 sm:py-12">
        <NoticeLetterhead />
        <h1 className="mt-8 font-serif text-3xl tracking-tight">Notice not found</h1>
        <p className="mt-3 text-base leading-7">
          {kind === "empty"
            ? "Open the link from your message. It includes a notice number."
            : "This notice number is not on file. Check the link in your message, or contact the advocate who sent it."}
        </p>
        <NoticeLetterfoot />
      </article>
    </main>
  );
}

function PublicNoticeDocument({ notice }: { notice: PublicNoticeView }) {
  const dated = new Intl.DateTimeFormat("en-IN", { dateStyle: "long" }).format(notice.createdAt);
  const particulars = [
    ["Bank", notice.bankName],
    ["Notice number", notice.noticeNumber],
    ["Loan number", notice.loanNumber],
    ["Customer id", notice.customerId],
    ["Loan amount", formatAmount(notice.loanAmount)],
    ["Outstanding", formatAmount(notice.outstandingAmount)],
  ];

  return (
    <main className="notice-screen mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <div className="no-print mb-4 flex justify-end">
        <PrintLetterButton />
      </div>
      <article className="notice-letter bg-card px-5 py-8 shadow-sm ring-1 ring-foreground/10 sm:px-10 sm:py-12">
        <NoticeLetterhead />

        <div className="mt-8 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-bold tracking-wide">LEGAL NOTICE</h1>
          <p className="text-sm">No. {notice.noticeNumber}</p>
        </div>
        <p className="mt-1 text-sm">Dated {dated}</p>

        <section className="mt-8">
          <p className="text-sm">To,</p>
          <p className="mt-2 text-xl font-bold">{notice.customerName}</p>
          {notice.address.trim() ? (
            <p className="mt-1 max-w-md whitespace-pre-wrap leading-6">{notice.address}</p>
          ) : (
            <p className="mt-1 text-sm">Address not on file</p>
          )}
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-bold">Particulars</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            {particulars.map(([label, value]) => (
              <div key={label} className="border-b border-black/15 pb-2">
                <dt className="text-xs uppercase tracking-wide">{label}</dt>
                <dd className="mt-1 text-sm">{value.trim() || "Not on file"}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-8 whitespace-pre-wrap text-base leading-7">{notice.body}</section>

        <NoticeSignature bankName={notice.bankName} />
        <NoticeLetterfoot />
      </article>
    </main>
  );
}

function formatAmount(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const numeric = Number(trimmed.replace(/,/g, ""));
  if (!Number.isFinite(numeric)) return trimmed;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(numeric);
}
