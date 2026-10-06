"use client";

import { useEffect, useState } from "react";
import { processOdrBatch } from "@/app/actions/odr";

type Progress = {
  done: boolean;
  pending: number;
  ready: number;
  skipped: number;
  failed: number;
  note: string;
  error?: string;
};

export function OdrSendProgress({ batchId, initial }: { batchId: string; initial: Progress }) {
  const [progress, setProgress] = useState(initial);

  useEffect(() => {
    if (initial.done) return;
    let cancel = false;
    async function run() {
      let current = initial;
      while (!cancel && !current.done) {
        current = await processOdrBatch(batchId);
        if (cancel) return;
        setProgress(current);
        if (current.error) return;
      }
    }
    void run();
    return () => {
      cancel = true;
    };
  }, [batchId, initial]);

  return (
    <div className="rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10" role="status">
      <p className="font-medium">{progress.done ? "Finished" : "Sending in batches"}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {progress.note} {progress.pending} still waiting. {progress.ready} sent, {progress.skipped} not sent, {progress.failed} failed
        in this pass.
      </p>
      {progress.error ? <p className="mt-2 text-sm text-destructive">{progress.error}</p> : null}
    </div>
  );
}
