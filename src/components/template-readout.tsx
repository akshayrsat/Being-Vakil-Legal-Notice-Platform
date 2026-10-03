// A template shown without a form.
// Everyone who can open it sees the name, the channel, and the message.
// The owner admin also sees the reference id.

import { channelLabels, templateStatusLabel, type TemplateChannel } from "@/lib/templates";

export function TemplateReadout({
  name,
  dltTemplateId = "",
  channels,
  status,
  body = "",
  showVendorDetail = false,
}: {
  name: string;
  dltTemplateId?: string;
  channels: TemplateChannel[];
  status: string;
  body?: string;
  showVendorDetail?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 text-sm leading-6">
      <div>
        <p className="text-muted-foreground">Name</p>
        <p className="font-medium">{name}</p>
      </div>
      <div className={showVendorDetail ? "grid gap-4 sm:grid-cols-3" : undefined}>
        {showVendorDetail ? (
          <div>
            <p className="text-muted-foreground">Status</p>
            <p className="font-medium">{templateStatusLabel(status)}</p>
          </div>
        ) : null}
        <div>
          <p className="text-muted-foreground">Channel</p>
          <p className="font-medium">{channelLabels(channels) || "None"}</p>
        </div>
        {showVendorDetail ? (
          <div>
            <p className="text-muted-foreground">DLT template id</p>
            <p className="font-medium break-all">{dltTemplateId || "Not set"}</p>
          </div>
        ) : null}
      </div>
      <div>
        <p className="text-muted-foreground">Message</p>
        <p className="mt-1 whitespace-pre-wrap rounded-lg bg-muted/60 px-3 py-3 text-foreground">
          {body || "This template has no text."}
        </p>
      </div>
      <p className="text-muted-foreground">You cannot change this template.</p>
    </div>
  );
}
