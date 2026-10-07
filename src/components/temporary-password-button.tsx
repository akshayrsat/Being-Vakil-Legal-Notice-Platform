"use client";

import { useState } from "react";
import { useActionState } from "react";
import { setTemporaryPassword } from "@/app/actions/people";
import { Button } from "@/components/ui/button";

export function TemporaryPasswordButton({ userId, name }: { userId: string; name: string }) {
  const [state, formAction, pending] = useActionState(setTemporaryPassword, null);
  const password = state && "password" in state ? state.password : "";
  const [copied, setCopied] = useState(false);

  async function copyPassword() {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-2">
      <input type="hidden" name="userId" value={userId} />
      <Button type="submit" variant="outline" disabled={pending} className="w-fit">
        {pending ? "Setting…" : "Set temporary password"}
      </Button>
      {state && "error" in state ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {password ? (
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <p className="text-sm">
            Temporary password for {name}. It is shown once. They must choose a new password the next time they sign in.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              readOnly
              value={password}
              aria-label={`Temporary password for ${name}`}
              className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-card px-3 font-mono text-sm"
            />
            <Button type="button" variant="secondary" onClick={copyPassword}>
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      ) : null}
    </form>
  );
}
