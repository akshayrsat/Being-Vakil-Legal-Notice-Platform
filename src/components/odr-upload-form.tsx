"use client";

import { useActionState, useState } from "react";
import { uploadOdrExcel } from "@/app/actions/odr";
import { OdrSlotFields } from "@/components/odr-slot-fields";
import { Button } from "@/components/ui/button";

const fieldClass = "h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal";

export function OdrUploadForm({
  neutrals,
}: {
  neutrals: Array<{ id: string; name: string; qualification: string; email: string; mobile: string }>;
}) {
  const [state, formAction, pending] = useActionState(uploadOdrExcel, null);
  const [count, setCount] = useState(1);
  const [mode, setMode] = useState<"SPLIT" | "PANEL">("SPLIT");
  const [route, setRoute] = useState("ARBITRATION");
  const lokAdalat = route === "LOK_ADALAT";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">
          Legal route <span className="font-normal text-muted-foreground">Required. This choice is the default for every row. You can change it on a case later.</span>
        </legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="legalRoute" value="ARBITRATION" checked={route === "ARBITRATION"} onChange={() => setRoute("ARBITRATION")} className="size-4 accent-primary" required />
          Arbitration
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="legalRoute" value="CONCILIATION" checked={route === "CONCILIATION"} onChange={() => setRoute("CONCILIATION")} className="size-4 accent-primary" />
          Conciliation (A&C Act Part III)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="legalRoute" value="MEDIATION" checked={route === "MEDIATION"} onChange={() => setRoute("MEDIATION")} className="size-4 accent-primary" />
          Contractual mediation
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="legalRoute" value="LOK_ADALAT" checked={route === "LOK_ADALAT"} onChange={() => setRoute("LOK_ADALAT")} className="size-4 accent-primary" />
          Lok Adalat
        </label>
      </fieldset>
      {lokAdalat ? (
        <p className="text-sm leading-6 text-muted-foreground">A Lok Adalat referral does not schedule a hearing on this platform. Export the pack from the case after upload.</p>
      ) : null}
      {lokAdalat ? null : (
      <>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Number of neutrals</legend>
        {[1, 2, 3].map((value) => (
          <label key={value} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="arbitratorCount"
              value={value}
              checked={count === value}
              onChange={() => setCount(value)}
              className="size-4 accent-primary"
              required
            />
            {value}
          </label>
        ))}
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">How they sit</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="arbitratorMode"
            value="SPLIT"
            checked={mode === "SPLIT"}
            onChange={() => setMode("SPLIT")}
            className="size-4 accent-primary"
          />
          Split customers. Each person hears their own list, at the same time.
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="arbitratorMode"
            value="PANEL"
            checked={mode === "PANEL"}
            onChange={() => setMode("PANEL")}
            className="size-4 accent-primary"
          />
          Panel. All of them sit together on every hearing.
        </label>
      </fieldset>
      {[0, 1, 2].slice(0, count).map((index) => (
        <label key={index} className="flex flex-col gap-1 text-sm font-medium">
          {count === 1 ? "Arbitrator or mediator" : `Arbitrator or mediator ${index + 1}`}
          <select
            name={index === 0 ? "neutralId" : `neutralId${index + 1}`}
            required
            className={fieldClass}
            defaultValue=""
          >
            <option value="" disabled>
              Choose a name
            </option>
            {neutrals.map((neutral) => (
              <option key={neutral.id} value={neutral.id}>
                {neutral.name}
                {neutral.qualification ? ` · ${neutral.qualification}` : ""}
                {neutral.email ? ` · ${neutral.email}` : ""}
                {neutral.mobile ? ` · ${neutral.mobile}` : ""}
              </option>
            ))}
          </select>
        </label>
      ))}
      <OdrSlotFields />
      </>
      )}
      {lokAdalat ? null : (
        <p className="text-sm leading-6 text-muted-foreground">
          Each customer gets the next open time. A hearing must finish by the end of the window, and none run through the lunch break. The email and mobile saved for the chosen name are used for the invite, the morning list, and the hearing notice.
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm font-medium">
        Bank Excel file
        <input name="file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required className="text-sm" />
      </label>
      {state?.error ? (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" className="h-11 w-fit px-4" disabled={pending || (!lokAdalat && neutrals.length === 0)}>
        {pending ? "Uploading…" : "Upload and match columns"}
      </Button>
    </form>
  );
}
