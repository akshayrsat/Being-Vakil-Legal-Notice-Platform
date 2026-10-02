// The top of every signed-in page: who you are, which bank is in use, and Sign out.

import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { SignOutButton } from "@/components/sign-out-button";
import { buttonVariants } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import type { SignedInUser } from "@/lib/auth";
import { workingBank } from "@/lib/bank-context";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/brand";
import { ROLE_ADMIN, roleAccent } from "@/lib/roles";

const barClass = {
  admin: "bg-primary",
  viewer: "bg-[#1a4a42]",
  unknown: "bg-[#8a6232]",
} as const;

function bankLine(user: SignedInUser): string {
  const bank = workingBank(user);
  if (user.role === ROLE_ADMIN) {
    return bank ? `Working on ${bank.name} (${bank.code})` : "No bank selected";
  }
  return bank
    ? `Your bank: ${bank.name} (${bank.code})`
    : "No bank linked to this login";
}

export function AppHeader({ user }: { user: SignedInUser }) {
  const accent = roleAccent(user.role);

  return (
    <>
      <div className={`h-2 ${barClass[accent]}`} />
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="shrink-0">
              <BrandLogo size="header" />
            </Link>
            <div>
              <p className="font-serif text-2xl leading-none text-primary">{PRODUCT_NAME}</p>
              <p className="mt-1 text-sm text-muted-foreground">{PRODUCT_TAGLINE}</p>
              <p className="mt-2 text-sm font-medium text-foreground">{bankLine(user)}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard"
              className={buttonVariants({ variant: "outline", className: "h-11 px-4" })}
            >
              Home
            </Link>
            {user.role === ROLE_ADMIN ? (
              <Link
                href="/banks"
                className={buttonVariants({ variant: "outline", className: "h-11 px-4" })}
              >
                Banks
              </Link>
            ) : null}
            <Link
              href="/uploads"
              className={buttonVariants({ variant: "outline", className: "h-11 px-4" })}
            >
              Uploads
            </Link>
            <Link
              href="/templates"
              className={buttonVariants({ variant: "outline", className: "h-11 px-4" })}
            >
              Templates
            </Link>
            <Link
              href="/campaigns"
              className={buttonVariants({ variant: "outline", className: "h-11 px-4" })}
            >
              Campaigns
            </Link>
            {user.role === ROLE_ADMIN ? (
              <Link
                href="/audit"
                className={buttonVariants({ variant: "outline", className: "h-11 px-4" })}
              >
                Audit
              </Link>
            ) : null}
            <form action={signOut}>
              <SignOutButton />
            </form>
          </div>
        </div>
      </header>
    </>
  );
}
