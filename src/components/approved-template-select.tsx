// Opens one Approved template. The options are wording names, not people or files.

"use client";

import { useRouter } from "next/navigation";

export function ApprovedTemplateSelect({
  templates,
}: {
  templates: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const empty = templates.length === 0;

  return (
    <label className="flex min-w-64 flex-1 flex-col gap-2 text-sm font-medium" htmlFor="select-approved-template">
      Select approved template
      <select
        id="select-approved-template"
        defaultValue=""
        disabled={empty}
        onChange={(event) => {
          const next = event.target.value;
          if (next) router.push(`/templates/${next}`);
        }}
        className="h-11 w-full rounded-lg border border-input bg-card px-3 text-sm font-normal disabled:opacity-60"
      >
        <option value="">
          {empty ? "No approved template yet" : "Choose an approved template"}
        </option>
        {templates.map((template) => (
          <option key={template.id} value={template.id}>
            {template.label}
          </option>
        ))}
      </select>
    </label>
  );
}
