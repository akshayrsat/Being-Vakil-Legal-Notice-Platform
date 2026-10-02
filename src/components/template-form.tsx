// The form firm staff use to write or change a notice template for the current bank.

"use client";

import { useRef, useState } from "react";
import { useActionState } from "react";
import { saveTemplate } from "@/app/actions/templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  NOTICE_PLACEHOLDERS,
  PLACEHOLDER_GROUPS,
  placeholderToken,
} from "@/lib/notice-placeholders";
import {
  TEMPLATE_APPROVED,
  TEMPLATE_CHANNELS,
  TEMPLATE_DRAFT,
  type TemplateChannel,
  type TemplateStatusValue,
} from "@/lib/templates";

export function TemplateForm({
  bankName,
  initial,
}: {
  bankName: string;
  initial: {
    id: string;
    name: string;
    dltTemplateId: string;
    channels: TemplateChannel[];
    status: TemplateStatusValue;
    body: string;
  };
}) {
  const [state, formAction, pending] = useActionState(saveTemplate, null);
  const [body, setBody] = useState(initial.body);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  function insertPlaceholder(token: string) {
    const snippet = placeholderToken(token);
    const field = bodyRef.current;
    const start = field?.selectionStart ?? body.length;
    const end = field?.selectionEnd ?? body.length;
    const next = `${body.slice(0, start)}${snippet}${body.slice(end)}`;
    setBody(next);
    const caret = start + snippet.length;
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(caret, caret);
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="templateId" value={initial.id} />
      <p className="text-sm leading-6 text-muted-foreground">
        This template is saved on {bankName} only. Another bank does not see it. Mark it Approved
        when the wording is ready to fill in. Nothing is sent from this page.
      </p>

      <div className="flex flex-col gap-2">
        <Label htmlFor="template-name">Template name</Label>
        <Input
          id="template-name"
          name="name"
          required
          maxLength={80}
          defaultValue={initial.name}
          placeholder="Example: Loan recall notice"
          className="h-11 px-3 text-base md:text-base"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="dlt-id">DLT template id</Label>
          <Input
            id="dlt-id"
            name="dltTemplateId"
            maxLength={64}
            defaultValue={initial.dltTemplateId}
            spellCheck={false}
            placeholder="Example: 1107165400000000001"
            className="h-11 px-3 text-base md:text-base"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="template-status">Status</Label>
          <select
            id="template-status"
            name="status"
            defaultValue={initial.status}
            className="h-11 rounded-lg border border-input bg-card px-3 text-sm"
          >
            <option value={TEMPLATE_DRAFT}>Draft</option>
            <option value={TEMPLATE_APPROVED}>Approved</option>
          </select>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Approved needs a DLT template id. This site does not check that id with a phone company.
        A draft cannot be picked when you fill a notice.
      </p>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Channels</legend>
        <div className="flex flex-wrap gap-4">
          {TEMPLATE_CHANNELS.map((channel) => (
            <label key={channel.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="channel"
                value={channel.id}
                defaultChecked={initial.channels.includes(channel.id)}
                className="size-4 accent-primary"
              />
              {channel.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="template-body">Notice text</Label>
        <Textarea
          ref={bodyRef}
          id="template-body"
          name="body"
          required
          rows={8}
          maxLength={4000}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Dear {{customer_name}}, loan {{loan_number}} has Rs {{outstanding_amount}} outstanding."
          className="min-h-40 text-base md:text-base"
        />
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium">Insert a placeholder</p>
        <p className="text-sm text-muted-foreground">
          Press a name to drop it into the notice text. Empty details show as “not provided” in the
          preview.
        </p>
        {PLACEHOLDER_GROUPS.map((group) => (
          <div key={group} className="flex flex-col gap-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {group}
            </p>
            <div className="flex flex-wrap gap-2">
              {NOTICE_PLACEHOLDERS.filter((item) => item.group === group).map((item) => (
                <Button
                  key={item.token}
                  type="button"
                  variant="outline"
                  className="h-9 px-3"
                  onClick={() => insertPlaceholder(item.token)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </div>
        ))}
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
        {pending ? "Saving…" : "Save template"}
      </Button>
    </form>
  );
}
