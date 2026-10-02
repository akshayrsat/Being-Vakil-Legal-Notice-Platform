// The bank list. Firm staff only. A Bank Viewer is sent back to the home page.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AddBankForm } from "@/components/add-bank-form";
import { AppHeader } from "@/components/app-header";
import { BankList } from "@/components/bank-list";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { workingBank } from "@/lib/bank-context";
import { toBankSnapshot } from "@/lib/banks";
import { prisma } from "@/lib/db";
import { ROLE_ADMIN } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Banks",
};

export default async function BanksPage({
  searchParams,
}: {
  searchParams: Promise<{ added?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== ROLE_ADMIN) redirect("/dashboard");

  const { added } = await searchParams;
  const addedCode = added?.trim().toUpperCase() ?? "";

  const banks = await prisma.bank.findMany({ orderBy: { name: "asc" } });
  const addedBank = banks.find((bank) => bank.code === addedCode);

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader user={user} />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <div>
          <h1 className="font-serif text-4xl tracking-tight text-foreground">Client banks</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            Add each bank the firm works for. Then press Use this bank. Later files and
            notices will be filed under that bank. A bank viewer never sees this list.
          </p>
        </div>

        {addedBank ? (
          <p className="rounded-lg border border-border bg-card px-3 py-2 text-sm" role="status">
            Added {addedBank.name}. Press Use this bank when you want to work on it.
          </p>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Add a bank</CardTitle>
            <CardDescription>The name is what people read. The short code is the id.</CardDescription>
          </CardHeader>
          <CardContent>
            <AddBankForm />
          </CardContent>
        </Card>

        <section className="flex flex-col gap-3">
          <h2 className="font-serif text-2xl">Banks on file</h2>
          <BankList
            banks={banks.map((bank) => toBankSnapshot(bank)!)}
            currentBankId={workingBank(user)?.id ?? null}
          />
        </section>
      </main>
    </div>
  );
}
