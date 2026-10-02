// Shown for a moment while the site checks who is signed in.

export default function DashboardLoading() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl items-center px-4 py-16 sm:px-6">
      <p className="text-base text-muted-foreground">Checking who is signed in…</p>
    </div>
  );
}
