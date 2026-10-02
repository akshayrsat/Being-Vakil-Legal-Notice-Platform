export function DeskLoading({ label }: { label: string }) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col justify-center gap-3 px-4 py-16 sm:px-6">
      <div className="h-2 w-28 animate-pulse rounded bg-[#5b2c83]/30" />
      <p className="text-base text-muted-foreground">{label}</p>
    </div>
  );
}
