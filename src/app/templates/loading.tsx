// Shown for a moment while the template list opens.

export default function TemplatesLoading() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl items-center px-4 py-16 sm:px-6">
      <p className="text-base text-muted-foreground">Loading templates…</p>
    </div>
  );
}
