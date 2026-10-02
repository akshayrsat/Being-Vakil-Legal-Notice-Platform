// A template shown without a form. Bank viewers, and an inactive bank, use this.

import { placeholderToken } from "@/lib/notice-placeholders";
import { channelLabels, templateStatusLabel, type TemplateChannel } from "@/lib/templates";

export function TemplateReadout({
  name,
  dltTemplateId,
  channels,
  status,
  body,
}: {
  name: string;
  dltTemplateId: string;
  channels: TemplateChannel[];
  status: string;
  body: string;
}) {
  return (
    <div className="flex flex-col gap-4 text-sm leading-6">
      <div>
        <p className="text-muted-foreground">Name</p>
        <p className="font-medium">{name}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-muted-foreground">Status</p>
          <p className="font-medium">{templateStatusLabel(status)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Channels</p>
          <p className="font-medium">{channelLabels(channels) || "None"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">DLT template id</p>
          <p className="font-medium break-all">{dltTemplateId || "Not set"}</p>
        </div>
      </div>
      <div>
        <p className="text-muted-foreground">Notice text</p>
        <p className="mt-1 whitespace-pre-wrap rounded-lg bg-muted/60 px-3 py-3 text-foreground">
          {body || "This template has no text."}
        </p>
      </div>
      <p className="text-muted-foreground">
        Placeholders look like {placeholderToken("customer_name")}. You cannot change this
        template.
      </p>
    </div>
  );
}
