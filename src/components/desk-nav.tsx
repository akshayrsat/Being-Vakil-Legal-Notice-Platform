"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROLE_ADMIN } from "@/lib/roles";

const LINKS = [
  { href: "/dashboard", label: "Home" },
  { href: "/uploads", label: "Uploads" },
  { href: "/templates", label: "Templates" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/deliveries", label: "Tracking" },
  { href: "/speed-post", label: "Speed Post" },
  { href: "/loans", label: "Loans" },
  { href: "/reports", label: "Reports" },
];

export function DeskNav({ role }: { role: string }) {
  const pathname = usePathname();
  const links = role === ROLE_ADMIN ? [...LINKS, { href: "/banks", label: "Banks" }, { href: "/audit", label: "Audit" }] : LINKS;

  return (
    <nav className="flex flex-wrap gap-1" aria-label="Workspace">
      {links.map((link) => {
        const active = pathname === link.href || (link.href !== "/dashboard" && pathname.startsWith(`${link.href}/`));
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-md px-3 py-2 text-sm ${
              active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
            }`}
            aria-current={active ? "page" : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
