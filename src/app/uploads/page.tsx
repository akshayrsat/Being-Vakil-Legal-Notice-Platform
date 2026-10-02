// Spreadsheets for the current bank. Firm staff can upload. A bank viewer can only look.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { UploadForm } from "@/components/upload-form";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { workingBank } from "@/lib/bank-context";
import { prisma } from "@/lib/db";
import { ROLE_ADMIN } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Uploads",
};

export default async function UploadsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const bank = workingBank(user);
  const isAdmin = user.role === ROLE_ADMIN;

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader user={user} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">Uploads</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            {bank
              ? isAdmin
                ? `Spreadsheets for ${bank.name}. Match the columns once. The next file for this bank starts from the same match.`
                : `Spreadsheets the firm has uploaded for ${bank.name}. You can look, but you cannot upload a new file.`
              : "Choose a bank before uploading a spreadsheet."}
          </p>
        </div>

        {!bank ? (
          <Card>
            <CardHeader>
              <CardTitle>No bank selected</CardTitle>
              <CardDescription>A spreadsheet has to belong to one bank.</CardDescription>
            </CardHeader>
            <CardContent>
              {isAdmin ? (
                <Link
                  href="/banks"
                  className={buttonVariants({ variant: "outline", className: "h-11 px-4" })}
                >
                  Choose a bank
                </Link>
              ) : (
                <p>This login is not linked to a bank. Ask the firm administrator.</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {isAdmin ? (
              <Card>
                <CardHeader>
                  <CardTitle>Upload an Excel file</CardTitle>
                  <CardDescription>
                    {bank.active
                      ? "The first row of the sheet must be the column names."
                      : "This bank is inactive. Mark it active before uploading."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {bank.active ? (
                    <UploadForm />
                  ) : (
                    <Link
                      href="/banks"
                      className={buttonVariants({ variant: "outline", className: "h-11 px-4" })}
                    >
                      Go to banks
                    </Link>
                  )}
                </CardContent>
              </Card>
            ) : null}

            <UploadList bankId={bank.id} canEdit={isAdmin} />
          </>
        )}
      </main>
    </div>
  );
}

async function UploadList({ bankId, canEdit }: { bankId: string; canEdit: boolean }) {
  const batches = await prisma.uploadBatch.findMany({
    where: { bankId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fileName: true,
      saved: true,
      rowCount: true,
      createdAt: true,
    },
  });

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-serif text-2xl">Files for this bank</h2>
      {batches.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {canEdit ? "No spreadsheets yet. Upload the first one above." : "No spreadsheets yet."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {batches.map((batch) => (
            <li
              key={batch.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10"
            >
              <div>
                <p className="font-medium">{batch.fileName}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatWhen(batch.createdAt)}
                  <span className="mx-2">·</span>
                  {batch.saved
                    ? `${batch.rowCount} ${batch.rowCount === 1 ? "person" : "people"} saved`
                    : "Needs a column match"}
                </p>
              </div>
              <Link
                href={`/uploads/${batch.id}`}
                className={buttonVariants({ variant: "outline", className: "h-11 px-4" })}
              >
                {canEdit ? (batch.saved ? "View or change" : "Match columns") : "View"}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatWhen(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
