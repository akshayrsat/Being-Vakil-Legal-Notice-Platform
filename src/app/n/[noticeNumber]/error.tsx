"use client";

export default function NoticeError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="notice-screen">
      <div className="notice-stage">
        <article className="notice-sheet notice-letter bg-card px-8 py-10 shadow-sm ring-1 ring-foreground/10">
          <h1 className="font-serif text-3xl">This notice could not be opened</h1>
          <p className="mt-3 leading-7">Wait a moment, then open the link from your message again.</p>
          <button type="button" className="mt-6 underline" onClick={() => reset()}>
            Try again
          </button>
        </article>
      </div>
    </main>
  );
}
