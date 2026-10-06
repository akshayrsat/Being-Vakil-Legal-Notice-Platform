import Link from "next/link";

export function RecordSwitch({ base, view }: { base: "/deliveries" | "/reports"; view: "notices" | "odr" }) {
  const links = [
    { id: "notices" as const, href: base, label: "Notices" },
    { id: "odr" as const, href: `${base}?view=odr`, label: "ODR" },
  ];
  return (
    <div className="flex gap-1" role="tablist" aria-label="What to look at">
      {links.map((link) => (
        <Link
          key={link.id}
          href={link.href}
          role="tab"
          aria-selected={view === link.id}
          className={`rounded-md px-3 py-2 text-sm ${view === link.id ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
