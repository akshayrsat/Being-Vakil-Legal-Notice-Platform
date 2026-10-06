"use client";

import { useActionState } from "react";
import { removeBankRepresentative, saveBankRepresentative } from "@/app/actions/banks";
import { Button } from "@/components/ui/button";

const field = "h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal";

export function BankRepresentativesForm({
  bankId,
  people,
}: {
  bankId: string;
  people: Array<{ id: string; name: string; email: string; mobile: string }>;
}) {
  const [state, action, pending] = useActionState(saveBankRepresentative, null);
  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="text-sm font-medium">Bank representatives</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        These people are invited to the hearing calendar. The customer is not. ODR sending stays off until you turn it on, and then the calendar invite goes out.
      </p>
      {people.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {people.map((person) => (
            <li key={person.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {person.name} · {person.email}
                {person.mobile ? ` · ${person.mobile}` : ""}
              </span>
              <form action={removeBankRepresentative}>
                <input type="hidden" name="representativeId" value={person.id} />
                <Button type="submit" variant="outline" className="h-9 px-3">
                  Remove
                </Button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No representative yet.</p>
      )}
      <form action={action} className="mt-3 grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="bankId" value={bankId} />
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input name="name" required className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input name="email" type="email" required className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Mobile
          <input name="mobile" className={field} />
        </label>
        <div className="flex items-end">
          <Button type="submit" className="h-11 px-4" disabled={pending}>
            {pending ? "Saving…" : "Add representative"}
          </Button>
        </div>
        {state?.error ? <p className="text-sm text-destructive sm:col-span-2">{state.error}</p> : null}
      </form>
    </div>
  );
}
