// The page a recipient opens from an SMS link. It shows one notice, or a not-found message.

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
    <main className="mx-auto flex min-h-full w-full max-w-xl flex-col gap-4 px-4 py-16">
      <p className="font-serif text-3xl text-[#1b3048]">Being Vakil</p>
      <h1 className="font-serif text-3xl tracking-tight">Notice not found</h1>
      <p className="text-base leading-7 text-muted-foreground">
        {kind === "empty"
          ? "Open the link from your message. It includes a notice number."
          : "This notice number is not on file. Check the link in your message, or contact the advocate who sent it."}
      </p>
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
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <article className="bg-card px-5 py-8 shadow-sm ring-1 ring-foreground/10 sm:px-10 sm:py-12">
        <header className="border-y-4 border-double border-[#1b3048] py-5 text-center">
          <p className="font-serif text-3xl tracking-wide text-[#1b3048]">Being Vakil</p>
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Advocates</p>
        </header>

        <div className="mt-8 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-serif text-2xl tracking-tight">Legal notice</h1>
          <p className="text-sm">No. {notice.noticeNumber}</p>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Dated {dated}</p>

        <section className="mt-8">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">To</p>
          <p className="mt-1 font-serif text-2xl">{notice.customerName}</p>
          {notice.address.trim() ? (
            <p className="mt-2 max-w-md whitespace-pre-wrap leading-6">{notice.address}</p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Address not on file</p>
          )}
        </section>

        <section className="mt-8">
          <h2 className="font-serif text-xl">Particulars</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            {particulars.map(([label, value]) => (
              <div key={label} className="border-b border-border pb-2">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
                <dd className="mt-1 text-sm">{value.trim() || "Not on file"}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-8 whitespace-pre-wrap text-base leading-7">{notice.body}</section>

        <footer className="mt-10 border-t border-border pt-6">
          <p className="font-medium">For Being Vakil</p>
          <p className="mt-1 text-sm text-muted-foreground">Advocates acting for {notice.bankName}</p>
        </footer>
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
