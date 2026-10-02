// The page a recipient opens from an SMS link. It shows one notice, or a not-found message.

import { NoticeLetterfoot, NoticeLetterhead, NoticeSignature } from "@/components/notice-letter";
import { PrintLetterButton } from "@/components/print-letter-button";
import { buildDemandNotice } from "@/lib/demand-notice";
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
    <main className="notice-screen mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <div className="no-print mb-4 flex justify-end">
        <PrintLetterButton />
      </div>
      <article className="notice-letter bg-card px-5 py-8 shadow-sm ring-1 ring-foreground/10 sm:px-10 sm:py-12">
        <NoticeLetterhead />

        <p className="mt-8 text-center text-sm font-bold tracking-wide">{letter.kicker}</p>
        <h1 className="mt-2 text-center text-2xl font-bold tracking-wide">{letter.title}</h1>
        <p className="mt-4 text-sm">{letter.dateLine}</p>
        <p className="text-sm">{letter.referenceLine}</p>

        <section className="mt-6">
          <p>To,</p>
          <p className="mt-2 font-bold">{letter.addresseeName}</p>
          <p className="mt-1 max-w-md whitespace-pre-wrap leading-6">{letter.addresseeAddress}</p>
        </section>

        <p className="mt-6">{letter.salutation}</p>
        <p className="mt-4 font-bold leading-7">{letter.subject}</p>
        {letter.opening.map((paragraph) => (
          <p key={paragraph} className="mt-4 leading-7">
            {paragraph}
          </p>
        ))}
        <dl className="mt-4">
          {letter.status.map((row) => (
            <div key={row.label} className="mt-1">
              <dt className="inline font-bold">{row.label} : </dt>
              <dd className="inline">{row.value}</dd>
            </div>
          ))}
        </dl>
        {letter.closing.map((paragraph) => (
          <p key={paragraph} className="mt-4 leading-7">
            {paragraph}
          </p>
        ))}

        <NoticeSignature bankName={notice.bankName} />
        <NoticeLetterfoot />
      </article>
    </main>
  );
}
