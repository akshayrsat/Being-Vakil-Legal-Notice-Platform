"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isSendNoticePath, SEND_NOTICE_HREF, workspaceNav } from "@/lib/send-notice";

export function DeskNav({ role }: { role: string }) {
  const pathname = usePathname();
  const links = workspaceNav(role);

  return (
    <nav className="flex flex-wrap gap-1" aria-label="Workspace">
      {links.map((link) => {
        const active =
          link.href === SEND_NOTICE_HREF
            ? isSendNoticePath(pathname)
            : pathname === link.href || (link.href !== "/dashboard" && pathname.startsWith(`${link.href}/`));
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
