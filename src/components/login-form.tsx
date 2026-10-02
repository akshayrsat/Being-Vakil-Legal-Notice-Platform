// The sign-in form, plus buttons that fill in the practice accounts.

"use client";

import { useState } from "react";
import { useActionState } from "react";
import { signIn } from "@/app/actions/auth";
import { DEMO_ACCOUNTS, type DemoAccount } from "@/lib/demo-accounts";
import { roleTitle } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [filledAs, setFilledAs] = useState<string | null>(null);

  function fillAccount(account: DemoAccount) {
    setEmail(account.email);
    setPassword(account.password);
    setFilledAs(roleTitle(account.role));
  }

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-11 px-3 text-base md:text-base"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-11 px-3 text-base md:text-base"
          />
        </div>

        {state?.error ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {state.error}
          </p>
        ) : null}

        {filledAs ? (
          <p aria-live="polite" className="text-sm text-muted-foreground">
            Filled in the {filledAs} practice login. Press Sign in.
          </p>
        ) : null}

        <Button
          type="submit"
          size="lg"
          className="h-11 w-full text-base"
          disabled={pending}
        >
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="flex flex-col gap-3 border-t border-border pt-5">
        <div>
          <h2 className="text-sm font-medium">Practice logins</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            These are sample people, not real clients. Use them to try both roles.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {DEMO_ACCOUNTS.map((account) => (
            <article
              key={account.email}
              className="flex flex-col rounded-lg border border-border bg-muted/50 p-3"
            >
              <p className="text-sm font-medium">{roleTitle(account.role)}</p>
              <p className="text-xs text-muted-foreground">{account.who}</p>
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Email</dt>
                  <dd className="text-right font-medium break-all">{account.email}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Password</dt>
                  <dd className="font-medium">{account.password}</dd>
                </div>
              </dl>
              <Button
                type="button"
                variant="secondary"
                className="mt-3 h-10 w-full"
                onClick={() => fillAccount(account)}
              >
                Fill in this login
              </Button>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
