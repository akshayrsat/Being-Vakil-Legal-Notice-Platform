"use client";

import { useActionState } from "react";
import { verifyPublicNotice } from "@/app/actions/notice-public";
import { Button } from "@/components/ui/button";

const field = "h-11 rounded-lg border border-input bg-card px-3 text-sm";

export function NoticeVerifyForm({ noticeNumber, source = "account" }: { noticeNumber: string; source?: "account" | "mobile" }) {
  const [state, action, pending] = useActionState(verifyPublicNotice, null);
  return (
    <form action={action} className="mt-6 flex flex-col gap-3">
      <input type="hidden" name="noticeNumber" value={noticeNumber} />
      <label className="flex flex-col gap-1 text-sm font-medium">
        {source === "mobile" ? "Last 4 digits of your mobile number" : "Last 4 digits of the loan or card account"}
        <input name="last4" inputMode="numeric" autoComplete="off" maxLength={4} pattern="[0-9]{4}" required className={field} />
      </label>
      {state?.error ? (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" className="h-11 w-fit px-4" disabled={pending}>
        {pending ? "Checking…" : "Open the notice"}
      </Button>
    </form>
  );
}
