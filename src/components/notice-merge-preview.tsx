// Shows the first saved people with an approved template filled in. Nothing is sent.

import Link from "next/link";
import { TemplatePicker } from "@/components/template-picker";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { fillNotice, valuesForRecipient, type NoticePart, type NoticeRecipient } from "@/lib/merge-notice";
import { channelLabels, parseChannels } from "@/lib/templates";

const SAMPLE_COUNT = 3;

type ApprovedTemplate = {
  id: string;
  name: string;
  dltTemplateId: string;
  channels: string;
  body: string;
};

export function NoticeMergePreview({
  batchId,
  bankName,
  saved,
  total,
  rows,
  templates,
  selectedId,
  libraryNotes = [],
}: {
  batchId: string;
  bankName: string;
  saved: boolean;
  total: number;
  rows: Array<NoticeRecipient & { rowNumber: number; customerName: string }>;
  templates: ApprovedTemplate[];
  selectedId: string;
  libraryNotes?: string[];
}) {
  const selected = templates.find((template) => template.id === selectedId) ?? null;
  const sample = rows.slice(0, SAMPLE_COUNT);
  const channels = selected ? parseChannels(selected.channels) : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Filled notice</CardTitle>
        <CardDescription>
          Choose an approved MSG91 template. The same templates are listed for every bank. The first{" "}
          {SAMPLE_COUNT} people are from this spreadsheet for {bankName} only. Nothing is sent.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!saved ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm leading-6 text-muted-foreground">
              Save a column match before previewing a notice. There are no people to fill in yet.
            </p>
            {templates.length === 0
              ? (libraryNotes.length > 0
                  ? libraryNotes
                  : ["No approved template yet."]
                ).map((note) => (
                  <p key={note} className="text-sm leading-6 text-muted-foreground">
                    {note}
                  </p>
                ))
              : null}
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col gap-3">
            {(libraryNotes.length > 0
              ? libraryNotes
              : ["The firm’s approved MSG91 templates are not in the library yet. This page does not write a template."]
            ).map((note) => (
              <p key={note} className="text-sm leading-6 text-muted-foreground">
                {note}
              </p>
            ))}
            <Link href="/templates" className={buttonVariants({ className: "h-11 w-fit px-4" })}>
              Go to templates
            </Link>
          </div>
        ) : selected ? (
          <>
            <TemplatePicker batchId={batchId} templates={templates} selectedId={selected.id} />
            <p className="text-sm text-muted-foreground">
              {channelLabels(channels) || "No channel"}
              {selected.dltTemplateId ? ` · DLT id ${selected.dltTemplateId}` : ""}
              <span className="mx-2">·</span>
              Showing {sample.length} of {total} saved {total === 1 ? "person" : "people"}.
            </p>
            <ul className="flex flex-col gap-4">
              {sample.map((row) => {
                const filled = fillNotice(selected.body, valuesForRecipient(row, bankName));
                return (
                  <li key={row.rowNumber} className="rounded-lg ring-1 ring-foreground/10">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-3 py-2">
                      <p className="font-medium">{row.customerName}</p>
                      <p className="text-sm text-muted-foreground">Row {row.rowNumber}</p>
                    </div>
                    <div className="px-3 py-3 text-sm leading-6 whitespace-pre-wrap">
                      <NoticeText parts={filled.parts} />
                    </div>
                    {filled.missingLabels.length > 0 ? (
                      <p className="px-3 pb-3 text-sm text-muted-foreground">
                        Empty for this person: {filled.missingLabels.join(", ")}.
                      </p>
                    ) : null}
                    {filled.unknownTokens.length > 0 ? (
                      <p className="px-3 pb-3 text-sm text-muted-foreground">
                        Unknown placeholder{filled.unknownTokens.length === 1 ? "" : "s"}:{" "}
                        {filled.unknownTokens.map((token) => `{{${token}}}`).join(", ")}.
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <Link
              href={`/templates/${selected.id}`}
              className={buttonVariants({ variant: "outline", className: "h-11 w-fit px-4" })}
            >
              View this template
            </Link>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function NoticeText({ parts }: { parts: NoticePart[] }) {
  return (
    <>
      {parts.map((part, index) => {
        if (part.kind === "missing") {
          return (
            <span key={index} className="text-muted-foreground">
              [not provided]
            </span>
          );
        }
        if (part.kind === "unknown") {
          return (
            <span key={index} className="text-[#8a6232]">
              {`{{${part.token}}}`}
            </span>
          );
        }
        return <span key={index}>{part.text}</span>;
      })}
    </>
  );
}
