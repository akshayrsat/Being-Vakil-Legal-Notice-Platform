// Shown when a page cannot open.

"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { DEVELOPMENT_PAGE_ERROR, PRODUCTION_PAGE_ERROR } from "@/lib/desk-error-copy";

export default function AppError({
  error,
  retry,
  reset,
}: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const again = retry ?? reset;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center px-4 py-16 sm:px-6">
      <div className="mb-4 h-2 w-16 rounded bg-primary" />
      <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
        Notice Desk
      </p>
      <h1 className="mt-2 font-serif text-3xl text-primary">This page did not open</h1>
      <p className="mt-3 leading-7 text-muted-foreground">
        {process.env.NODE_ENV === "production" ? PRODUCTION_PAGE_ERROR : DEVELOPMENT_PAGE_ERROR}
      </p>
      {again ? (
        <Button type="button" className="mt-6 h-11 w-fit px-4" onClick={() => again()}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
