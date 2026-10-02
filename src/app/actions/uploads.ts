// Saves an Excel file under the bank the Admin is working on, then stores the matched rows.

"use server";

import { redirect } from "next/navigation";
import { auditCurrentUser } from "@/lib/audit";
import { getSessionContext } from "@/lib/auth";
import {
  mapSheetRows,
  mappingFromForm,
  validateMapping,
} from "@/lib/apply-mapping";
import { uploadBatchWhere } from "@/lib/bank-data";
import { workingBank } from "@/lib/bank-context";
import { prisma } from "@/lib/db";
import { parseXlsx, SheetReadError } from "@/lib/parse-xlsx";
import { ROLE_ADMIN } from "@/lib/roles";

export type UploadFormState = { error: string } | null;

const MAX_BYTES = 5 * 1024 * 1024;

async function adminBank() {
  const current = await getSessionContext();
  if (!current) redirect("/login");
  if (current.user.role !== ROLE_ADMIN) {
    return {
      ok: false as const,
      error: "Only firm staff can upload a spreadsheet or change the column match.",
    };
  }
  const bank = workingBank(current.user);
  if (!bank) {
    return { ok: false as const, error: "Choose a bank before uploading a spreadsheet." };
  }
  return { ok: true as const, bank };
}

export async function uploadExcel(
  _previous: UploadFormState,
  formData: FormData,
): Promise<UploadFormState> {
  const scope = await adminBank();
  if (!scope.ok) return { error: scope.error };
  if (!scope.bank.active) {
    return {
      error: "This bank is inactive. Mark it active on the Banks page before uploading.",
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an Excel file (.xlsx)." };
  }

  const fileName = file.name.trim().slice(0, 200);
  if (!fileName.toLowerCase().endsWith(".xlsx")) {
    return { error: "Save the file as an Excel workbook (.xlsx) and try again." };
  }
  if (file.size > MAX_BYTES) {
    return { error: "That file is larger than 5 MB. Split it into a smaller workbook." };
  }

  let parsed: { headers: string[]; rows: string[][] };
  try {
    parsed = await parseXlsx(Buffer.from(await file.arrayBuffer()));
  } catch (error) {
    if (error instanceof SheetReadError) return { error: error.message };
    throw error;
  }

  const batch = await prisma.uploadBatch.create({
    data: {
      bankId: scope.bank.id,
      fileName,
      headers: JSON.stringify(parsed.headers),
      rawRows: JSON.stringify(parsed.rows),
    },
  });

  await auditCurrentUser({
    action: "upload",
    summary: `Uploaded ${fileName}.`,
    bankId: scope.bank.id,
    bankName: scope.bank.name,
    targetId: batch.id,
  });

  redirect(`/uploads/${batch.id}`);
}

export async function saveMapping(
  _previous: UploadFormState,
  formData: FormData,
): Promise<UploadFormState> {
  const scope = await adminBank();
  if (!scope.ok) return { error: scope.error };
  if (!scope.bank.active) {
    return {
      error: "This bank is inactive. Mark it active on the Banks page before saving a column match.",
    };
  }

  const batchId = String(formData.get("batchId") ?? "");
  const batch = await prisma.uploadBatch.findFirst({
    where: { id: batchId, ...uploadBatchWhere(scope.bank.id) },
  });
  if (!batch) {
    return { error: "That spreadsheet was not found for the bank you are working on." };
  }

  let headers: string[];
  let rawRows: string[][];
  try {
    headers = JSON.parse(batch.headers) as string[];
    rawRows = JSON.parse(batch.rawRows) as string[][];
  } catch {
    return { error: "This saved spreadsheet could not be read. Upload it again." };
  }

  const mapping = mappingFromForm(formData);
  const problem = validateMapping(mapping, headers);
  if (problem) return { error: problem };

  const { recipients, skipped } = mapSheetRows(headers, rawRows, mapping);
  if (recipients.length === 0) {
    return { error: "No row had a customer name. Check the customer name column." };
  }

  const storedMapping = JSON.stringify(mapping);
  const rows = recipients.map((row) => ({
    batchId: batch.id,
    bankId: scope.bank.id,
    rowNumber: row.rowNumber,
    customerName: row.customerName,
    mobile1: row.mobile1,
    mobile2: row.mobile2,
    mobile3: row.mobile3,
    mobiles: JSON.stringify(row.mobiles),
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
  }));

  await prisma.$transaction(
    async (tx) => {
      await tx.recipientRow.deleteMany({ where: { batchId: batch.id } });
      for (let index = 0; index < rows.length; index += 200) {
        await tx.recipientRow.createMany({ data: rows.slice(index, index + 200) });
      }
      await tx.uploadBatch.update({
        where: { id: batch.id },
        data: {
          saved: true,
          rowCount: recipients.length,
          mappingUsed: storedMapping,
        },
      });
      await tx.bankColumnMap.upsert({
        where: { bankId: scope.bank.id },
        create: { bankId: scope.bank.id, fields: storedMapping },
        update: { fields: storedMapping },
      });
    },
    { timeout: 20000 },
  );

  await auditCurrentUser({
    action: "mapping.save",
    summary: `Saved the column match for ${batch.fileName}.`,
    bankId: scope.bank.id,
    bankName: scope.bank.name,
    targetId: batch.id,
  });

  const skippedNote = skipped > 0 ? `&skipped=${skipped}` : "";
  redirect(`/uploads/${batch.id}?saved=1${skippedNote}`);
}
