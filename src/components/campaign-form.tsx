// Picks a spreadsheet, an approved template, and the channels for one send.

"use client";

import { useState } from "react";
import { useActionState } from "react";
import { createCampaign } from "@/app/actions/campaigns";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { isSendChannel, SEND_CHANNELS, type SendChannel } from "@/lib/campaign-plan";
import { sendChannelLabel } from "@/lib/campaigns";

type BatchOption = { id: string; fileName: string; rowCount: number };
type TemplateOption = { id: string; name: string; channels: SendChannel[] };
type LegalNoticeOption = { id: string; name: string };

export function CampaignForm({
  batches,
  templates,
  legalNotices,
  initialBatchId,
}: {
  batches: BatchOption[];
  templates: TemplateOption[];
  legalNotices: LegalNoticeOption[];
  initialBatchId: string;
}) {
  const [state, formAction, pending] = useActionState(createCampaign, null);
  const startingBatch = batches.some((batch) => batch.id === initialBatchId)
    ? initialBatchId
    : batches[0]?.id ?? "";
  const onlyTemplate = templates.length === 1 ? templates[0] : null;
  const onlyLegalNotice = legalNotices.length === 1 ? legalNotices[0] : null;
  const [templateId, setTemplateId] = useState(onlyTemplate?.id ?? "");
  const [legalNoticeId, setLegalNoticeId] = useState(onlyLegalNotice?.id ?? "");
  const [channels, setChannels] = useState<SendChannel[]>(
    onlyTemplate?.channels.length ? onlyTemplate.channels : onlyTemplate ? ["SMS"] : [],
  );

  function chooseTemplate(nextId: string) {
    setTemplateId(nextId);
    const next = templates.find((template) => template.id === nextId);
    const fromTemplate = (next?.channels ?? []).filter(isSendChannel);
    setChannels(fromTemplate.length > 0 ? fromTemplate : ["SMS"]);
  }

  function toggleChannel(channel: SendChannel, checked: boolean) {
    setChannels((current) => {
      if (checked) return SEND_CHANNELS.filter((item) => current.includes(item) || item === channel);
      return current.filter((item) => item !== channel);
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="campaign-batch">Spreadsheet of people</Label>
        <select
          id="campaign-batch"
          name="batchId"
          defaultValue={startingBatch}
          required
          className="h-11 rounded-lg border border-input bg-card px-3 text-sm"
        >
          {batches.map((batch) => (
            <option key={batch.id} value={batch.id}>
              {batch.fileName} ({batch.rowCount} {batch.rowCount === 1 ? "person" : "people"})
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="campaign-template">SMS, email, or WhatsApp</Label>
        <select
          id="campaign-template"
          name="templateId"
          value={templateId}
          onChange={(event) => chooseTemplate(event.target.value)}
          required
          className="h-11 rounded-lg border border-input bg-card px-3 text-sm"
        >
          {templates.length > 1 ? (
            <option value="" disabled>
              Choose SMS, email, or WhatsApp
            </option>
          ) : null}
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
        <p className="text-sm font-normal text-muted-foreground">
          This is the message. Approved wording, A to Z, for every bank. Drafts are not listed. The same list is on Templates.
        </p>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium">How to send it</legend>
        <div className="flex flex-col gap-2">
          {SEND_CHANNELS.map((channel) => (
            <label key={channel} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="channel"
                value={channel}
                checked={channels.includes(channel)}
                onChange={(event) => toggleChannel(channel, event.target.checked)}
                className="size-4 accent-primary"
              />
              {sendChannelLabel(channel)}
            </label>
          ))}
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" disabled className="size-4" />
            Speed Post
            <span className="text-xs">Coming soon</span>
          </label>
        </div>
        <p className="text-sm text-muted-foreground">
          These start from the wording. A person with no mobile is skipped for SMS and WhatsApp.
          A person with no email is skipped for email. Speed Post cannot be ticked yet.
        </p>
      </fieldset>

      <div className="flex flex-col gap-2 border-t border-border pt-5">
        <h3 className="font-serif text-2xl">Choose the legal notice</h3>
        <p className="text-sm leading-6 text-muted-foreground">
          This is the printed notice. It is separate from the SMS, email, and WhatsApp message. The same list is on Legal notice templates.
        </p>
        <Label htmlFor="campaign-legal-notice">Legal notice</Label>
        <select
          id="campaign-legal-notice"
          name="legalNoticeTemplateId"
          value={legalNoticeId}
          onChange={(event) => setLegalNoticeId(event.target.value)}
          required
          className="h-11 rounded-lg border border-input bg-card px-3 text-sm"
        >
          {legalNotices.length !== 1 ? (
            <option value="" disabled>
              Choose the legal notice
            </option>
          ) : null}
          {legalNotices.map((notice) => (
            <option key={notice.id} value={notice.id}>
              {notice.name}
            </option>
          ))}
        </select>
      </div>

      {state?.error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </p>
      ) : null}

      <Button type="submit" className="h-11 w-full px-4 sm:w-fit" disabled={pending}>
        {pending ? "Preparing…" : "Review who will get it"}
      </Button>
    </form>
  );
}
