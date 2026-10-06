"use client";

import { backLinkClass } from "@/components/back-link";

export function HistoryBack({ children, fallbackHref }: { children: React.ReactNode; fallbackHref: string }) {
  return (
    <button
      type="button"
      className={`${backLinkClass} cursor-pointer border-0 bg-transparent p-0`}
      onClick={() => {
        if (window.history.length > 1) {
          window.history.back();
          return;
        }
        window.location.assign(fallbackHref);
      }}
    >
      <span aria-hidden="true">←</span>
      {children}
    </button>
  );
}
