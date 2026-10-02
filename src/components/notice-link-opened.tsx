// Webpage open for one public notice. Kept apart from MSG91 "Opened", which is an email or WhatsApp read.

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
      ? `Last viewed ${formatWhen(open.linkLastViewedAt)}`
      : undefined;
  return (
    <p className={className} title={lastViewed}>
      Notice link opened {formatWhen(open.linkOpenedAt)}
      {views}
    </p>
  );
}

export function MessageOpened({
  openedAt,
  className = "text-muted-foreground",
}: {
  openedAt: Date | null;
  className?: string;
}) {
  if (!openedAt) return null;
  return <p className={className}>Opened {formatWhen(openedAt)}</p>;
}

function formatWhen(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
