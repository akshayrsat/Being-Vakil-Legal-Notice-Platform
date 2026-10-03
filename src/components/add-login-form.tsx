"use client";

import { useState } from "react";
import { useActionState } from "react";
import { createLogin } from "@/app/actions/people";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_BANK_USER } from "@/lib/roles";

type RoleChoice = { id: string; label: string; detail: string };
type BankChoice = { id: string; name: string };

export function AddLoginForm({ roles, banks }: { roles: RoleChoice[]; banks: BankChoice[] }) {
  const [state, formAction, pending] = useActionState(createLogin, null);
  const [role, setRole] = useState(roles[0]?.id ?? ROLE_BANK_USER);
  const needsBank = role === ROLE_BANK_USER;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="login-name">Name</Label>
        <Input id="login-name" name="name" required autoComplete="off" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="login-email">Email</Label>
        <Input id="login-email" name="email" type="email" required autoComplete="off" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="login-password">Password</Label>
        <Input id="login-password" name="password" type="password" required minLength={8} autoComplete="new-password" />
        <p className="text-sm text-muted-foreground">At least 8 characters. It is not emailed.</p>
      </div>
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium">Role</legend>
        {roles.map((choice) => (
          <label key={choice.id} className="flex items-start gap-2 text-sm leading-6">
            <input
              type="radio"
              name="role"
              value={choice.id}
              checked={role === choice.id}
              onChange={() => setRole(choice.id)}
              className="mt-1 size-4 accent-primary"
            />
            <span>
              <span className="font-medium">{choice.label}</span>
              <span className="mt-0.5 block text-muted-foreground">{choice.detail}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {needsBank ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="login-bank">Bank they can see</Label>
          <select
            id="login-bank"
            name="bankId"
            required
            defaultValue=""
            className="h-11 rounded-lg border border-input bg-card px-3 text-sm"
          >
            <option value="" disabled>
              Choose one bank
            </option>
            {banks.map((bank) => (
              <option key={bank.id} value={bank.id}>
                {bank.name}
              </option>
            ))}
          </select>
          <p className="text-sm text-muted-foreground">This person can see only this bank.</p>
        </div>
      ) : (
        <input type="hidden" name="bankId" value="" />
      )}
      {state?.error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </p>
      ) : null}
      <Button type="submit" className="h-11 w-full px-4 sm:w-fit" disabled={pending || roles.length === 0}>
        {pending ? "Saving…" : "Add login"}
      </Button>
    </form>
  );
}
