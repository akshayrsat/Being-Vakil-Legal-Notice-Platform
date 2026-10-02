// Match spreadsheet columns, then check the first people saved from the file.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { ColumnMapper } from "@/components/column-mapper";
import { NoticeMergePreview } from "@/components/notice-merge-preview";
import { RecipientPreview } from "@/components/recipient-preview";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { parseStoredMapping, suggestMapping } from "@/lib/apply-mapping";
import { getCurrentUser } from "@/lib/auth";
import { workingBank } from "@/lib/bank-context";
import { prisma } from "@/lib/db";
import { ROLE_ADMIN } from "@/lib/roles";
import { SHEET_FIELDS, type FieldKey, type FieldMapping } from "@/lib/sheet-fields";
import { TEMPLATE_APPROVED } from "@/lib/templates";

export const metadata: Metadata = {
  title: "Match columns",
};

const PREVIEW_LIMIT = 10;

export default async function UploadBatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; skipped?: string; template?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const bank = workingBank(user);
  const { id } = await params;
  const query = await searchParams;
  const isAdmin = user.role === ROLE_ADMIN;

  if (!bank) {
    redirect("/uploads");
  }

  const batch = await prisma.uploadBatch.findFirst({
    where: { id, bankId: bank.id },
  });

  if (!batch) {
    return (
      <div className="flex min-h-full flex-col">
        <AppHeader user={user} />
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-8 sm:px-6">
          <h1 className="font-serif text-3xl">Spreadsheet not found</h1>
          <p className="leading-7 text-muted-foreground">
            That file is not under the bank you are working on.
          </p>
          <Link href="/uploads" className={buttonVariants({ variant: "outline", className: "h-11 w-fit px-4" })}>
            Back to uploads
          </Link>
        </main>
      </div>
    );
  }

  const headers = parseStringList(batch.headers);
  const rawCount = countRawRows(batch.rawRows);
  const savedMap = await prisma.bankColumnMap.findUnique({ where: { bankId: bank.id } });
  const usedMapping = parseStoredMapping(batch.mappingUsed);
  const suggested = suggestMapping(headers, parseStoredMapping(savedMap?.fields));
  const previewRows = batch.saved
    ? await prisma.recipientRow.findMany({
        where: { batchId: batch.id },
        orderBy: { rowNumber: "asc" },
        take: PREVIEW_LIMIT,
      })
    : [];
  const mappingForPreview = usedMapping ?? {};
  const previewColumns = SHEET_FIELDS.filter((field) => mappingForPreview[field.key]).map((field) => ({
    key: field.key,
    label: field.label,
  }));
  const skipped = Number(query.skipped ?? "0");
  const approvedTemplates = await prisma.noticeTemplate.findMany({
    where: { bankId: bank.id, status: TEMPLATE_APPROVED },
    orderBy: { name: "asc" },
    select: { id: true, name: true, dltTemplateId: true, channels: true, body: true },
  });
  const requestedTemplate = query.template?.trim() ?? "";
  const selectedTemplate =
    approvedTemplates.find((template) => template.id === requestedTemplate) ??
    approvedTemplates[0] ??
    null;

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader user={user} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <div>
          <p className="text-sm text-muted-foreground">{bank.name}</p>
          <h1 className="mt-1 font-serif text-4xl tracking-tight">{batch.fileName}</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {rawCount} data {rawCount === 1 ? "row" : "rows"} in the file.
            {batch.saved ? ` ${batch.rowCount} saved for later sending.` : " Columns are not saved yet."}
          </p>
        </div>

        {query.saved === "1" ? (
          <p className="rounded-lg border border-border bg-card px-3 py-2 text-sm" role="status">
            Column match saved for {bank.name}. The next upload for this bank will start with the
            same choices.
            {Number.isFinite(skipped) && skipped > 0
              ? ` ${skipped} ${skipped === 1 ? "row was" : "rows were"} left out because the customer name was empty.`
              : ""}
          </p>
        ) : null}

        {isAdmin ? (
          <Card>
            <CardHeader>
              <CardTitle>Match the columns</CardTitle>
              <CardDescription>
                {bank.active
                  ? "Customer name is required. Empty optional fields are fine."
                  : "This bank is inactive, so the match cannot be changed."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {bank.active ? (
                <ColumnMapper
                  batchId={batch.id}
                  headers={headers}
                  initial={suggested}
                  bankName={bank.name}
                  hasSavedMatch={Boolean(savedMap)}
                />
              ) : (
                <SavedMatchList mapping={usedMapping} />
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Column match</CardTitle>
              <CardDescription>You can see which column was used. You cannot change it.</CardDescription>
            </CardHeader>
            <CardContent>
              {batch.saved ? (
                <SavedMatchList mapping={usedMapping} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  The firm has not matched the columns on this file yet.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {batch.saved ? (
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>Check the first rows before anything is sent.</CardDescription>
            </CardHeader>
            <CardContent>
              <RecipientPreview
                total={batch.rowCount}
                columns={previewColumns}
                rows={previewRows.map((row) => ({
                  rowNumber: row.rowNumber,
                  values: previewValues(row),
                }))}
              />
            </CardContent>
          </Card>
        ) : null}

        <NoticeMergePreview
          batchId={batch.id}
          bankName={bank.name}
          saved={batch.saved}
          total={batch.rowCount}
          rows={previewRows}
          templates={approvedTemplates}
          selectedId={selectedTemplate?.id ?? ""}
          canEdit={isAdmin && bank.active}
        />

        {isAdmin && bank.active && batch.saved ? (
          <Link
            href={`/campaigns/new?batch=${batch.id}`}
            className={buttonVariants({ className: "h-11 w-fit px-4" })}
          >
            Prepare a send
          </Link>
        ) : null}

        <Link href="/uploads" className={buttonVariants({ variant: "outline", className: "h-11 w-fit px-4" })}>
          Back to uploads
        </Link>
      </main>
    </div>
  );
}

function SavedMatchList({ mapping }: { mapping: Partial<FieldMapping> | null }) {
  const chosen = SHEET_FIELDS.filter((field) => mapping?.[field.key]);
  if (!mapping || chosen.length === 0) {
    return <p className="text-sm text-muted-foreground">No column match has been saved for this file.</p>;
  }
  const leftOut = SHEET_FIELDS.filter((field) => !mapping[field.key]).map((field) => field.label);

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2 text-sm">
        {chosen.map((field) => (
          <li key={field.key}>
            <span className="font-medium">{field.label}</span>
            <span className="text-muted-foreground"> — column “{mapping[field.key]}”</span>
          </li>
        ))}
      </ul>
      {leftOut.length > 0 ? (
        <p className="text-sm text-muted-foreground">Left blank: {leftOut.join(", ")}.</p>
      ) : null}
    </div>
  );
}

function previewValues(row: {
  customerName: string;
  mobile1: string;
  mobile2: string;
  mobile3: string;
  email: string;
  address: string;
  loanNumber: string;
  customerId: string;
  loanAmount: string;
  outstandingAmount: string;
  loanType: string;
  referenceNumber: string;
  collectionManager: string;
  collectionManagerMobile: string;
  bankWebsite: string;
  coBorrowerName: string;
  coBorrowerMobile: string;
  coBorrowerEmail: string;
  guarantorName: string;
  guarantorMobile: string;
  guarantorEmail: string;
}): Record<FieldKey, string> {
  return {
    customerName: row.customerName,
    mobile1: row.mobile1,
    mobile2: row.mobile2,
    mobile3: row.mobile3,
    email: row.email,
    address: row.address,
    loanNumber: row.loanNumber,
    customerId: row.customerId,
    loanAmount: row.loanAmount,
    outstandingAmount: row.outstandingAmount,
    loanType: row.loanType,
    referenceNumber: row.referenceNumber,
    collectionManager: row.collectionManager,
    collectionManagerMobile: row.collectionManagerMobile,
    bankWebsite: row.bankWebsite,
    coBorrowerName: row.coBorrowerName,
    coBorrowerMobile: row.coBorrowerMobile,
    coBorrowerEmail: row.coBorrowerEmail,
    guarantorName: row.guarantorName,
    guarantorMobile: row.guarantorMobile,
    guarantorEmail: row.guarantorEmail,
  };
}

function parseStringList(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function countRawRows(raw: string): number {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}
