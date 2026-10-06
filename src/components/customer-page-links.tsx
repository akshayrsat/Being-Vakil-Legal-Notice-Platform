"use client";

import { useState } from "react";

export function CustomerPageLinks({ href }: { href: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
      >
        Open customer page
      </a>
      <button
        type="button"
        className="inline-flex h-11 items-center rounded-lg border border-border bg-card px-4 text-sm"
        onClick={() => {
          void navigator.clipboard.writeText(href).then(() => {
            setCopied(true);
          });
        }}
      >
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
