import { BackLink } from "@/components/back-link";
import { HistoryBack } from "@/components/history-back";
import type { OdrBackTarget } from "@/lib/odr-back";

export function OdrBackLink({ target }: { target: OdrBackTarget }) {
  if (target.kind === "history") {
    return <HistoryBack fallbackHref={target.fallbackHref}>{target.label}</HistoryBack>;
  }
  return <BackLink href={target.href}>{target.label}</BackLink>;
}
