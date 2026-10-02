/**
 * ONE live test to exactly three allowlisted contacts.
 * Uses writePreparedDeliveries + deliverNotice (same as campaigns finishLiveSend).
 * Optional: LIVE_CHANNELS=SMS,EMAIL (default SMS,EMAIL,WHATSAPP).
 */
import { config } from "dotenv";
config({ path: ".env" });

import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";
import { suggestMapping, mapSheetRows } from "../src/lib/apply-mapping";
import { writePreparedDeliveries } from "../src/lib/prepare-send";
import {
  deliverNotice,
  isLiveSendEnabled,
  dryRunReason,
  type SendChannel,
} from "../src/lib/msg91";
import { smsNoticeVars, noticePublicUrl } from "../src/lib/notice-link";
import { toMsg91Mobile } from "../src/lib/phone";

const ALLOWED = [
  { name: "Akshay Sathe", mobile: "9619871393", email: "akshayrsathe@gmail.com" },
  { name: "Akshay R Sathe", mobile: "8828402800", email: "akshayrsat@gmail.com" },
  { name: "Shweta Sudhir", mobile: "9326247985", email: "advshwetasudhir@gmail.com" },
] as const;

const ALLOWED_MOBILES = new Set(ALLOWED.map((r) => toMsg91Mobile(r.mobile)!));
const ALLOWED_EMAILS = new Set(ALLOWED.map((r) => r.email.toLowerCase()));
const ALL_CHANNELS: SendChannel[] = ["SMS", "EMAIL", "WHATSAPP"];
const CHANNELS: SendChannel[] = (() => {
  const raw = (process.env.LIVE_CHANNELS ?? "").trim();
  if (!raw) return [...ALL_CHANNELS];
  const wanted = raw.split(",").map((p) => p.trim().toUpperCase()).filter(Boolean);
  const picked = ALL_CHANNELS.filter((c) => wanted.includes(c));
  if (!picked.length) throw new Error("LIVE_CHANNELS had no valid channel. Use SMS,EMAIL,WHATSAPP.");
  return picked;
})();

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  if (typeof value === "object" && "text" in value && typeof (value as { text: unknown }).text === "string") {
    return ((value as { text: string }).text || "").trim();
  }
  if (typeof value === "object" && "result" in value) {
    const result = (value as { result: unknown }).result;
    return result == null ? "" : String(result).trim();
  }
  return String(value).trim();
}

async function readSampleSheet(): Promise<{ headers: string[]; rows: string[][] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(readFileSync("samples/notice-recipients.xlsx") as never);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("Sample workbook has no sheet");
  const headers: string[] = [];
  const headerRow = sheet.getRow(1);
  headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
    headers[col - 1] = cellText(cell.value);
  });
  const cleanHeaders = headers.map((h) => h || "");
  while (cleanHeaders.length && !cleanHeaders[cleanHeaders.length - 1]) cleanHeaders.pop();
  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const values: string[] = cleanHeaders.map((_, i) => cellText(row.getCell(i + 1).value));
    if (values.every((v) => !v)) return;
    rows.push(values);
  });
  return { headers: cleanHeaders, rows };
}

function assertAllowlisted(rows: { customerName: string; mobile1: string; email: string }[]) {
  if (rows.length !== 3) throw new Error(`Expected exactly 3 recipients, got ${rows.length}. Aborting.`);
  for (const row of rows) {
    const mobile = toMsg91Mobile(row.mobile1);
    const email = row.email.trim().toLowerCase();
    if (!mobile || !ALLOWED_MOBILES.has(mobile)) {
      throw new Error(`Mobile not allowlisted: ${row.customerName} / ${row.mobile1}. Aborting.`);
    }
    if (!email || !ALLOWED_EMAILS.has(email)) {
      throw new Error(`Email not allowlisted: ${row.customerName} / ${row.email}. Aborting.`);
    }
  }
  for (const a of ALLOWED) {
    const m = toMsg91Mobile(a.mobile)!;
    if (!rows.find((r) => toMsg91Mobile(r.mobile1) === m)) {
      throw new Error(`Missing allowlisted person ${a.name}. Aborting.`);
    }
  }
}

async function main() {
  console.log("LIVE_SEND enabled?", isLiveSendEnabled());
  if (!isLiveSendEnabled()) {
    console.error(dryRunReason());
    process.exit(1);
  }
  console.log("NOTICE_PUBLIC_BASE_URL", process.env.NOTICE_PUBLIC_BASE_URL);
  console.log("Sample public URL format", noticePublicUrl("DEMO-LN10021"));

  const prisma = new PrismaClient();
  try {
    const bank = await prisma.bank.findFirst({ where: { code: "NWH" } });
    if (!bank) throw new Error("Northwind bank not found");
    const admin = await prisma.user.findFirst({ where: { email: "admin@noticedesk.local" } });
    if (!admin) throw new Error("admin user not found");
    await prisma.user.update({ where: { id: admin.id }, data: { selectedBankId: bank.id } });

    const template = await prisma.noticeTemplate.findFirst({
      where: { bankId: bank.id, status: "APPROVED", seedKey: "nwh-borrower-email" },
    });
    if (!template) throw new Error("Approved Northwind template not found");

    const parsed = await readSampleSheet();
    const mapping = suggestMapping(parsed.headers, null);
    const { recipients } = mapSheetRows(parsed.headers, parsed.rows, mapping);
    assertAllowlisted(recipients);
    console.log("Channels:", CHANNELS.join(","));
    console.log("Recipients OK:", recipients.map((r) => `${r.customerName}|${r.mobile1}|${r.email}`).join(" ;; "));

    const campaign = await prisma.$transaction(
      async (tx) => {
        const batch = await tx.uploadBatch.create({
          data: {
            bankId: bank.id,
            fileName: "notice-recipients.xlsx",
            headers: JSON.stringify(parsed.headers),
            rawRows: JSON.stringify(parsed.rows),
            mappingUsed: JSON.stringify(mapping),
            saved: true,
            rowCount: recipients.length,
          },
        });
        await tx.recipientRow.createMany({
          data: recipients.map((row) => ({
            batchId: batch.id,
            bankId: bank.id,
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
          })),
        });
        const rows = await tx.recipientRow.findMany({
          where: { batchId: batch.id },
          orderBy: { rowNumber: "asc" },
        });
        assertAllowlisted(rows);
        const created = await tx.campaign.create({
          data: {
            bankId: bank.id,
            batchId: batch.id,
            templateId: template.id,
            templateName: template.name,
            templateBody: template.body,
            dltTemplateId: template.dltTemplateId,
            channels: JSON.stringify(CHANNELS),
            mode: "LIVE",
            status: "REVIEW",
            dryRunNote: "",
            createdById: admin.id,
          },
        });
        await writePreparedDeliveries(tx, {
          campaignId: created.id,
          bankId: bank.id,
          bankName: bank.name,
          templateBody: template.body,
          rows,
          channels: CHANNELS,
        });
        return created;
      },
      { timeout: 60000 },
    );

    const pending = await prisma.campaignDelivery.findMany({
      where: { campaignId: campaign.id },
      orderBy: [{ rowNumber: "asc" }, { channel: "asc" }],
    });

    for (const row of pending) {
      if (row.status === "SKIPPED") continue;
      if (row.channel === "EMAIL") {
        if (!ALLOWED_EMAILS.has(row.email.trim().toLowerCase())) {
          throw new Error(`Delivery email not allowlisted: ${row.email}. Aborting.`);
        }
      } else {
        const mobile = toMsg91Mobile(row.mobile);
        if (!mobile || !ALLOWED_MOBILES.has(mobile)) {
          throw new Error(`Delivery mobile not allowlisted: ${row.mobile}. Aborting.`);
        }
      }
    }

    console.log("Campaign", campaign.id, "deliveries", pending.length);
    for (const row of pending) {
      console.log(
        `  prep ${row.customerName} ${row.channel} status=${row.status} notice=${row.noticeNumber} to=${row.channel === "EMAIL" ? row.email : row.mobile} link=${row.noticeNumber ? noticePublicUrl(row.noticeNumber) : ""}`,
      );
    }

    const results: Array<Record<string, string>> = [];
    for (const row of pending) {
      if (row.status !== "PENDING") {
        results.push({
          person: row.customerName,
          channel: row.channel,
          to: row.channel === "EMAIL" ? row.email : row.mobile,
          notice: row.noticeNumber,
          status: row.status,
          detail: row.detail,
          providerId: "",
          publicUrl: "",
        });
        continue;
      }
      const channel = row.channel as SendChannel;
      const to = channel === "EMAIL" ? row.email : row.mobile;
      const result = await deliverNotice({
        channel,
        to,
        body: row.messageText,
        dltTemplateId: template.dltTemplateId,
        sms:
          channel === "SMS" && row.noticeNumber
            ? smsNoticeVars({
                customerName: row.customerName,
                bankName: bank.name,
                noticeNumber: row.noticeNumber,
              })
            : undefined,
        email:
          channel === "EMAIL" && row.noticeNumber
            ? {
                contact_name: row.customerName.trim(),
                loan_account: row.loanNumber.trim() || row.noticeNumber,
                notice_id: row.noticeNumber,
              }
            : undefined,
        whatsapp:
          channel === "WHATSAPP"
            ? { customer_name: row.customerName.trim(), bank_name: bank.name.trim() }
            : undefined,
      });
      await prisma.campaignDelivery.update({
        where: { id: row.id },
        data: result.ok
          ? { status: "DELIVERED", detail: "Handed to MSG91.", providerId: result.providerId }
          : { status: "FAILED", detail: result.error },
      });
      results.push({
        person: row.customerName,
        channel,
        to,
        notice: row.noticeNumber,
        status: result.ok ? "DELIVERED" : "FAILED",
        detail: result.ok ? "Handed to MSG91." : result.error,
        providerId: result.ok ? result.providerId : "",
        publicUrl: row.noticeNumber ? noticePublicUrl(row.noticeNumber) : "",
      });
      console.log(`SENT ${row.customerName} ${channel} -> ${result.ok ? "OK " + result.providerId : "FAIL " + result.error}`);
    }

    const failed = results.filter((r) => r.status === "FAILED").length;
    const sentish = results.filter((r) => r.status === "DELIVERED").length;
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        status: failed > 0 && sentish === 0 ? "FAILED" : "COMPLETED",
        mode: "LIVE",
        confirmedAt: new Date(),
      },
    });
    await prisma.auditEvent
      .create({
        data: {
          action: "campaign.confirm",
          summary: `Confirmed a live send of ${template.name} (three-contact test).`,
          bankId: bank.id,
          bankName: bank.name,
          targetId: campaign.id,
          actorId: admin.id,
          actorName: admin.name,
          actorRole: admin.role,
        },
      })
      .catch(() => undefined);

    console.log("\n=== RESULTS JSON ===");
    console.log(JSON.stringify({ campaignId: campaign.id, results }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
