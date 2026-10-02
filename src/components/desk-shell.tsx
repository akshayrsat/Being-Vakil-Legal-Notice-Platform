import { AppHeader } from "@/components/app-header";
import type { SignedInUser } from "@/lib/auth";

export function DeskShell({
  user,
  children,
}: {
  user: SignedInUser;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <AppHeader user={user} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
