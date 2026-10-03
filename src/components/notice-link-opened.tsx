// Webpage open for one public notice. Kept apart from MSG91 "Opened", which is an email or WhatsApp read.

import { formatIndiaDateTime } from "@/lib/india-day";
import type { NoticeLinkOpen } from "@/lib/public-notice";

export function NoticeLinkOpened({
  open,
  className = "text-muted-foreground",
}: {
  open: NoticeLinkOpen | null | undefined;
  className?: string;
}) {
  if (!open?.linkOpenedAt) return null;
  const views = open.linkViewCount > 1 ? ` · ${open.linkViewCount} views` : "";
  const lastViewed =
    open.linkViewCount > 1 && open.linkLastViewedAt
      ? `Last viewed ${formatIndiaDateTime(open.linkLastViewedAt)}`
      : undefined;
  return (
    <p className={className} title={lastViewed}>
      Notice link opened {formatIndiaDateTime(open.linkOpenedAt)}
      {views}
    </p>
  );
}

export function MessageOpened({
  openedAt,
  channel = "",
  className = "text-muted-foreground",
}: {
  openedAt: Date | null;
  channel?: string;
  className?: string;
}) {
  if (!openedAt || channel === "SMS") return null;
  return <p className={className}>Opened {formatIndiaDateTime(openedAt)}</p>;
}
