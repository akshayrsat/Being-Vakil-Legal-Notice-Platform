// The top of every signed-in page: who you are, which bank is in use, and Sign out.

import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { BrandLogo } from "@/components/brand-logo";
import { DeskNav } from "@/components/desk-nav";
import { SignOutButton } from "@/components/sign-out-button";
import type { SignedInUser } from "@/lib/auth";
import { workingBank } from "@/lib/bank-context";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/brand";
import { canChooseBank, roleAccent, roleTitle } from "@/lib/roles";

const barClass = {
  admin: "bg-primary",
  viewer: "bg-[#1a4a42]",
  unknown: "bg-[#8a6232]",
} as const;

function bankLine(user: SignedInUser): string {
  const bank = workingBank(user);
  if (canChooseBank(user.role)) {
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
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link href="/dashboard" className="flex min-w-0 items-center gap-4">
              <BrandLogo size="header" />
              <span className="min-w-0">
                <span className="block font-serif text-2xl leading-none text-primary">{PRODUCT_NAME}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{PRODUCT_TAGLINE}</span>
              </span>
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm">
                <span className="font-medium">{user.name}</span>
                <span className="text-muted-foreground"> · {roleTitle(user.role)}</span>
              </p>
              <form action={signOut}>
                <SignOutButton />
              </form>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-foreground">{bankLine(user)}</p>
            <DeskNav role={user.role} />
          </div>
        </div>
      </header>
    </>
  );
}
