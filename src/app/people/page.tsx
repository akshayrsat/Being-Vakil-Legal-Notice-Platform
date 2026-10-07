// Add a login. The owner and a legal coordinator can open this. There is no public signup.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { AddLoginForm } from "@/components/add-login-form";
import { TemporaryPasswordButton } from "@/components/temporary-password-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { clearCoordinatorBankLinks } from "@/lib/coordinator-bank";
import { prisma } from "@/lib/db";
import { canSetTemporaryPassword, peopleGroups, rolesThisPersonCanCreate, type PersonRow } from "@/lib/people";
import {
  canCreateLogins,
  isBankUser,
  isOwner,
  ROLE_BANK_USER,
  ROLE_BANK_VIEWER,
  ROLE_COORDINATOR,
  roleTitle,
} from "@/lib/roles";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "People",
};

const ROLE_COPY = {
  [ROLE_COORDINATOR]: {
    label: "Legal coordinator",
    detail:
      "Law-firm staff. Can switch banks and send notices. Not tied to one bank. Cannot change live send, add a bank, or open the audit log.",
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
  await clearCoordinatorBankLinks(prisma);
  const listed = await prisma.user.findMany({
    where: owner ? {} : { role: { in: [ROLE_COORDINATOR, ROLE_BANK_USER, ROLE_BANK_VIEWER] } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      bank: { select: { name: true } },
    },
  });
  const people: PersonRow[] = listed.map((person) => ({
    id: person.id,
    name: person.name,
    email: person.email,
    role: person.role,
    bankName: isBankUser(person.role) ? (person.bank?.name ?? null) : null,
  }));
  const groups = peopleGroups(people);

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader user={user} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">People</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            {owner
              ? "Add a legal coordinator or a bank user. A legal coordinator is law-firm staff and is not tied to one bank. A bank user sees only one bank. Nothing is emailed."
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
        <PeopleSection
          title="Law-firm staff"
          empty="No law-firm staff yet."
          note="A legal coordinator is not tied to one bank."
          people={groups.staff}
          actorId={user.id}
          actorRole={user.role}
        />
        <PeopleSection
          title="Bank users"
          empty="No bank users yet."
          note="A bank user can see only the bank named here."
          people={groups.bankUsers}
          actorId={user.id}
          actorRole={user.role}
        />
      </main>
    </div>
  );
}

function PeopleSection({
  title,
  empty,
  note,
  people,
  actorId,
  actorRole,
}: {
  title: string;
  empty: string;
  note: string;
  people: PersonRow[];
  actorId: string;
  actorRole: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="font-serif text-2xl">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{note}</p>
      </div>
      {people.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {people.map((person) => (
            <li key={person.id} className="rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10">
              <p className="font-medium">{person.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {person.email}
                <span className="mx-2">·</span>
                {roleTitle(person.role)}
                {person.bankName ? (
                  <>
                    <span className="mx-2">·</span>
                    {person.bankName}
                  </>
                ) : null}
              </p>
              {canSetTemporaryPassword(actorRole, person.role, person.id === actorId) ? (
                <TemporaryPasswordButton userId={person.id} name={person.name} />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
