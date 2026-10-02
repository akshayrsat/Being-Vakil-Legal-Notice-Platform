export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card px-4 py-8 text-center">
      <p className="font-serif text-2xl text-foreground">{title}</p>
      <div className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{children}</div>
    </div>
  );
}
