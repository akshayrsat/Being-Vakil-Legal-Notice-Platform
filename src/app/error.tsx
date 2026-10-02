// Shown when a page cannot open, for example if the database file is missing.

"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center px-4 py-16 sm:px-6">
      <div className="mb-4 h-2 w-16 rounded bg-primary" />
      <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
        Notice Desk
      </p>
      <h1 className="mt-2 font-serif text-3xl text-primary">This page did not open</h1>
      <p className="mt-3 leading-7 text-muted-foreground">
        Refresh the browser. If it keeps happening, go back to the terminal window, stop the
        site, and start it again with npm run dev. That recreates the practice database.
      </p>
      <Button type="button" className="mt-6 h-11 w-fit px-4" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}
