"use client";

import { useActionState } from "react";
import {
  addSpeedPostEvent,
  importSpeedPostCsv,
  markCampaignSpeedPost,
  refreshSpeedPost,
  saveArticleNumber,
} from "@/app/actions/speed-post";
import { Button } from "@/components/ui/button";
import { POSTAL_STATUS_OPTIONS } from "@/lib/postal";

function FormNote({ state }: { state: { error: string; saved?: string } | null }) {
  if (state?.error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {state.error}
      </p>
    );
  }
  if (state?.saved) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {state.saved}
      </p>
    );
  }
  return null;
}

export function MarkSpeedPostForm({
  campaignId,
  recipientRowId,
  label,
}: {
  campaignId: string;
  recipientRowId?: string;
  label: string;
}) {
  const [state, action, pending] = useActionState(markCampaignSpeedPost, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="campaignId" value={campaignId} />
      {recipientRowId ? <input type="hidden" name="recipientRowId" value={recipientRowId} /> : null}
      <FormNote state={state} />
      <Button type="submit" variant="outline" className="h-11 w-fit px-4" disabled={pending}>
        {pending ? "Saving…" : label}
      </Button>
    </form>
  );
}

export function ArticleForm({ consignmentId, articleNumber }: { consignmentId: string; articleNumber: string }) {
  const [state, action, pending] = useActionState(saveArticleNumber, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="consignmentId" value={consignmentId} />
      <label className="flex flex-col gap-1 text-sm font-medium">
        Article number
        <input
          name="articleNumber"
          defaultValue={articleNumber}
          placeholder="EK123456789IN"
          className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal uppercase"
        />
      </label>
      <FormNote state={state} />
      <Button type="submit" className="h-11 w-fit px-4" disabled={pending}>
        {pending ? "Saving…" : "Save article number"}
      </Button>
    </form>
  );
}

export function StatusForm({ consignmentId }: { consignmentId: string }) {
  const [state, action, pending] = useActionState(addSpeedPostEvent, null);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="consignmentId" value={consignmentId} />
      <label className="flex flex-col gap-1 text-sm font-medium">
        Status
        <select name="status" className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal" defaultValue="IN_TRANSIT">
          {POSTAL_STATUS_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        When
        <input name="occurredAt" type="date" className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
        Note
        <input
          name="note"
          maxLength={300}
          placeholder="Booked at Mumbai GPO"
          className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal"
        />
      </label>
      <div className="sm:col-span-2 flex flex-col gap-2">
        <FormNote state={state} />
        <Button type="submit" className="h-11 w-fit px-4" disabled={pending}>
          {pending ? "Saving…" : "Add status"}
        </Button>
      </div>
    </form>
  );
}

export function RefreshSpeedPostForm({ consignmentId }: { consignmentId: string }) {
  const [state, action, pending] = useActionState(refreshSpeedPost, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="consignmentId" value={consignmentId} />
      <FormNote state={state} />
      <Button type="submit" variant="outline" className="h-11 w-fit px-4" disabled={pending}>
        {pending ? "Checking…" : "Refresh from India Post"}
      </Button>
    </form>
  );
}

export function ImportSpeedPostForm() {
  const [state, action, pending] = useActionState(importSpeedPostCsv, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium">
        CSV file
        <input name="file" type="file" accept=".csv,text/csv" required className="text-sm font-normal" />
      </label>
      <FormNote state={state} />
      <Button type="submit" className="h-11 w-fit px-4" disabled={pending}>
        {pending ? "Importing…" : "Import CSV"}
      </Button>
    </form>
  );
}
