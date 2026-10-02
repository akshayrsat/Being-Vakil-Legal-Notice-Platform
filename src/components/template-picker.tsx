// Picks an approved template on a spreadsheet page and reloads the filled preview.

"use client";

import { useRouter } from "next/navigation";

export function TemplatePicker({
  batchId,
  templates,
  selectedId,
}: {
  batchId: string;
  templates: Array<{ id: string; name: string }>;
  selectedId: string;
}) {
  const router = useRouter();

  return (
    <label className="flex flex-col gap-2 text-sm font-medium">
      Select approved template
      <select
        value={selectedId}
        onChange={(event) => {
          const next = event.target.value;
          const query = next ? `?template=${encodeURIComponent(next)}` : "";
          router.push(`/uploads/${batchId}${query}`);
        }}
        className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal"
      >
        {templates.map((template) => (
          <option key={template.id} value={template.id}>
            {template.name}
          </option>
        ))}
      </select>
    </label>
  );
}
