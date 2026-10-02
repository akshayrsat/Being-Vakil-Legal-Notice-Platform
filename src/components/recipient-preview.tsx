// The first rows after a column match, so a person can check the names and numbers.

export function RecipientPreview({
  rows,
  total,
  columns,
}: {
  rows: Array<{ rowNumber: number; values: Record<string, string> }>;
  total: number;
  columns: Array<{ key: string; label: string }>;
}) {
  if (total === 0 || columns.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No people have been saved from this file yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Showing {rows.length} of {total} saved {total === 1 ? "person" : "people"}. Nothing has
        been sent.
      </p>
      <div className="overflow-x-auto rounded-lg ring-1 ring-foreground/10">
        <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
          <thead className="bg-muted/70">
            <tr>
              <th className="sticky left-0 bg-muted px-3 py-2 font-medium">Row</th>
              {columns.map((column) => (
                <th key={column.key} className="px-3 py-2 font-medium whitespace-nowrap">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.rowNumber} className="border-t border-border">
                <th className="sticky left-0 bg-card px-3 py-2 text-left font-medium">
                  {row.rowNumber}
                </th>
                {columns.map((column) => {
                  const value = row.values[column.key] ?? "";
                  return (
                    <td key={column.key} className="max-w-xs px-3 py-2 align-top">
                      {value || <span className="text-muted-foreground">—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
