// A text link back to the previous step. Navigation only: saved rows stay in the database.

import Link from "next/link";
import type { BackTarget } from "@/lib/desk-back";

export const backLinkClass =
  "inline-flex w-fit items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline";

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={backLinkClass}
    >
      <span aria-hidden="true">←</span>
      {children}
    </Link>
  );
}

export function BackLinks({ links }: { links: BackTarget[] }) {
  if (links.length === 0) return null;
  return (
    <nav aria-label="Back" className="flex flex-wrap gap-x-4 gap-y-1">
      {links.map((link) => (
        <BackLink key={`${link.href}:${link.label}`} href={link.href}>
          {link.label}
        </BackLink>
      ))}
    </nav>
  );
}
