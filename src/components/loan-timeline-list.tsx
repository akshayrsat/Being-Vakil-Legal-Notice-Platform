import Link from "next/link";
import { formatIndiaDateTime } from "@/lib/india-day";
import type { AccountTimeline } from "@/lib/loan-timeline";

const kindLabel = {
  notice: "Notice",
  channel: "Channel",
  link: "Link",
  "speed-post": "Speed Post",
} as const;

export function LoanTimelineList({ timeline }: { timeline: AccountTimeline }) {
  if (timeline.events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No notices, channel events, or Speed Post updates are on file for this loan yet.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-0">
      {timeline.events.map((event, index) => (
        <li key={event.id} className="grid grid-cols-[1rem_minmax(0,1fr)] gap-3">
          <div className="flex flex-col items-center">
            <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
            {index < timeline.events.length - 1 ? <span className="w-px flex-1 bg-border" /> : null}
          </div>
          <div className="pb-5">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {kindLabel[event.kind]} · {formatIndiaDateTime(event.at)}
            </p>
            <p className="mt-1 font-medium">{event.title}</p>
            {event.detail ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{event.detail}</p> : null}
            {event.href ? (
              <Link href={event.href} className="mt-1 inline-block text-sm underline">
                {event.hrefLabel}
              </Link>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
