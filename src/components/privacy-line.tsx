// Short purpose line for a public page. The full notice is /privacy.
// DRAFT FOR COUNSEL REVIEW.

import Link from "next/link";
import { privacyPurposeLine } from "@/lib/privacy-copy";

export function PrivacyLine({ purpose }: { purpose: "notice" | "odr" }) {
  return (
    <p className="no-print text-sm leading-6 text-muted-foreground">
      {privacyPurposeLine(purpose)}{" "}
      <Link href="/privacy" className="underline">
        Privacy notice
      </Link>
      {" · "}
      <Link href="/privacy#request" className="underline">
        Ask for access, correction, erasure, a grievance, or a nominee
      </Link>
      .
    </p>
  );
}
