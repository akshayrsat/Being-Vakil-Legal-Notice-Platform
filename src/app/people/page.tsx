// Add a login. The owner and a legal coordinator can open this. There is no public signup.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { AddLoginForm } from "@/components/add-login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rolesThisPersonCanCreate } from "@/lib/people";
import { canCreateLogins, isOwner, ROLE_BANK_USER, ROLE_COORDINATOR, roleTitle } from "@/lib/roles";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "People",
};

const ROLE_COPY = {
  [ROLE_COORDINATOR]: {
    label: "Legal coordinator",
    detail: "Can send notices and add a bank user. Cannot change live send, banks, or the audit log.",
  },
  [ROLE_BANK_USER]: {
    label: "Bank user",
    detail: "Can look at notices already sent for one bank, including delivery status, and can download that bank’s report. Cannot upload, send, change wording, or see another bank.",
  },
} as const;

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ added?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canCreateLogins(user.role)) redirect("/dashboard");

  const query = await searchParams;
  const owner = isOwner(user.role);
  const choices = rolesThisPersonCanCreate(user.role).map((id) => ({ id, ...ROLE_COPY[id] }));
  const banks = await prisma.bank.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const people = await prisma.user.findMany({
    where: owner ? {} : { role: { in: ["BANK_USER", "BANK_VIEWER"] } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      bank: { select: { name: true } },
    },
  });

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader user={user} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">People</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            {owner
              ? "Add a legal coordinator, or a bank user who can see only one bank. Nothing is emailed."
              : "Add a bank user for one bank. You cannot add an owner or another legal coordinator, and nothing is emailed."}
          </p>
        </div>
        {query.added === "1" ? (
          <p className="rounded-lg border border-border bg-card px-3 py-2 text-sm" role="status">
            Login added. Share the email and password with that person yourself.
          </p>
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle>Add a login</CardTitle>
            <CardDescription>Name, email, password, and role. A bank user also needs one bank.</CardDescription>
          </CardHeader>
          <CardContent>
            <AddLoginForm roles={choices} banks={banks} />
          </CardContent>
        </Card>
        <section className="flex flex-col gap-3">
          <h2 className="font-serif text-2xl">{owner ? "Logins" : "Bank users"}</h2>
          {people.length === 0 ? (
            <p className="text-sm text-muted-foreground">No logins yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {people.map((person) => (
                <li key={person.id} className="rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10">
                  <p className="font-medium">{person.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {person.email}
                    <span className="mx-2">·</span>
                    {roleTitle(person.role)}
                    {person.bank ? (
                      <>
                        <span className="mx-2">·</span>
                        {person.bank.name}
                      </>
                    ) : null}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
