import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import type { SignedInUser } from "./auth";
import { campaignWhere, onlyThisBank, recipientRowWhere, uploadBatchWhere } from "./bank-data";
import { clearCoordinatorBankLinks } from "./coordinator-bank";
import { canReadBank, scopedBankId } from "./report-bank";

test("bank A cannot see bank B upload batches, rows, or campaigns", () => {
  const rows = [
    { bankId: "test-bank", fileName: "test sheet.xlsx", kind: "upload" },
    { bankId: "northwind", fileName: "OD Data more than 154 day.xlsx", kind: "upload" },
    { bankId: "test-bank", fileName: "Test person", kind: "row" },
    { bankId: "northwind", fileName: "Northwind person", kind: "row" },
    { bankId: "test-bank", fileName: "Test send", kind: "campaign" },
    { bankId: "northwind", fileName: "Northwind send", kind: "campaign" },
  ];

  const visible = onlyThisBank(rows, "test-bank");
  assert.deepEqual(
    visible.map((row) => row.fileName),
    ["test sheet.xlsx", "Test person", "Test send"],
  );
  assert.equal(onlyThisBank(rows, "northwind").some((row) => row.bankId === "test-bank"), false);
  assert.equal(onlyThisBank(rows, "").length, 0);
  assert.equal(onlyThisBank(rows, undefined).length, 0);

  assert.deepEqual(uploadBatchWhere("test-bank"), { bankId: "test-bank" });
  assert.deepEqual(recipientRowWhere("test-bank", "batch-a"), { bankId: "test-bank", batchId: "batch-a" });
  assert.deepEqual(campaignWhere("test-bank"), { bankId: "test-bank" });
  for (const where of [uploadBatchWhere(""), uploadBatchWhere(undefined), uploadBatchWhere("  ")]) {
    assert.equal(typeof where.bankId, "string");
    assert.notEqual(where.bankId, "");
    assert.notEqual(where.bankId, "test-bank");
    assert.notEqual(where.bankId, "northwind");
  }
});

test("a database query for one bank does not return the other bank's uploads", { timeout: 60_000 }, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "notice-iso-"));
  const dbFile = path.join(dir, "iso.db");
  const dbUrl = `file:${dbFile}`;
  assert.match(dbUrl, /^file:.*notice-iso-/);
  const prismaBin = path.join(process.cwd(), "node_modules", ".bin", "prisma");
  execFileSync(prismaBin, ["db", "push", "--skip-generate"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: "pipe",
  });

  const db = new PrismaClient({ datasourceUrl: dbUrl });
  try {
    const testBank = await db.bank.create({ data: { name: "Test Bank", code: "MH", active: true } });
    const northwind = await db.bank.create({
      data: { name: "Northwind Housing Finance", code: "NWH", active: true },
    });
    const testBatch = await db.uploadBatch.create({
      data: {
        bankId: testBank.id,
        fileName: "test sheet.xlsx",
        headers: "[]",
        rawRows: "[]",
        saved: true,
        rowCount: 3,
      },
    });
    const northBatch = await db.uploadBatch.create({
      data: {
        bankId: northwind.id,
        fileName: "OD Data more than 154 day.xlsx",
        headers: "[]",
        rawRows: "[]",
        saved: true,
        rowCount: 74,
      },
    });
    await db.recipientRow.create({
      data: { batchId: testBatch.id, bankId: testBank.id, rowNumber: 1, customerName: "Test person" },
    });
    await db.recipientRow.create({
      data: { batchId: northBatch.id, bankId: northwind.id, rowNumber: 1, customerName: "Northwind person" },
    });
    const testTemplate = await db.noticeTemplate.create({
      data: { bankId: testBank.id, name: "Test notice", body: "Hello", channels: "[]", status: "APPROVED" },
    });
    const northTemplate = await db.noticeTemplate.create({
      data: { bankId: northwind.id, name: "Northwind notice", body: "Hello", channels: "[]", status: "APPROVED" },
    });
    await db.campaign.create({
      data: {
        bankId: testBank.id,
        batchId: testBatch.id,
        templateId: testTemplate.id,
        templateName: testTemplate.name,
        templateBody: testTemplate.body,
        channels: "[]",
        mode: "DRY_RUN",
      },
    });
    await db.campaign.create({
      data: {
        bankId: northwind.id,
        batchId: northBatch.id,
        templateId: northTemplate.id,
        templateName: northTemplate.name,
        templateBody: northTemplate.body,
        channels: "[]",
        mode: "DRY_RUN",
      },
    });

    const everything = await db.uploadBatch.findMany();
    assert.equal(everything.length, 2);

    const uploads = await db.uploadBatch.findMany({
      where: uploadBatchWhere(testBank.id),
      orderBy: { fileName: "asc" },
    });
    assert.deepEqual(
      uploads.map((batch) => batch.fileName),
      ["test sheet.xlsx"],
    );
    assert.equal(uploads.some((batch) => batch.bankId === northwind.id), false);

    const rows = await db.recipientRow.findMany({ where: recipientRowWhere(testBank.id) });
    assert.deepEqual(
      rows.map((row) => row.customerName),
      ["Test person"],
    );

    const campaigns = await db.campaign.findMany({ where: campaignWhere(testBank.id) });
    assert.equal(campaigns.length, 1);
    assert.equal(campaigns[0]?.bankId, testBank.id);
    assert.notEqual(campaigns[0]?.templateName, "Northwind notice");

    const unscoped = await db.uploadBatch.findMany({ where: uploadBatchWhere("") });
    assert.equal(unscoped.length, 0);
    const missing = await db.uploadBatch.findMany({ where: uploadBatchWhere(undefined) });
    assert.equal(missing.length, 0);

    const coordinator = await db.user.create({
      data: {
        name: "Legal Coord",
        email: "coord@firm.example",
        passwordHash: "hash",
        role: "LEGAL_COORDINATOR",
        bankId: testBank.id,
        selectedBankId: testBank.id,
      },
    });
    assert.equal(await clearCoordinatorBankLinks(db), 1);
    const firmStaff = await db.user.findUniqueOrThrow({ where: { id: coordinator.id } });
    assert.equal(firmStaff.bankId, null);
    assert.equal(firmStaff.selectedBankId, testBank.id);

    const working = (bankId: string, name: string, code: string): SignedInUser => ({
      id: coordinator.id,
      name: coordinator.name,
      email: coordinator.email,
      role: "LEGAL_COORDINATOR",
      mustChangePassword: false,
      bank: { id: bankId, name, code, active: true },
    });
    const onTest = working(testBank.id, testBank.name, testBank.code);
    const onNorth = working(northwind.id, northwind.name, northwind.code);
    const testNames = (
      await db.uploadBatch.findMany({ where: uploadBatchWhere(scopedBankId(onTest) ?? "") })
    ).map((batch) => batch.fileName);
    const northNames = (
      await db.uploadBatch.findMany({ where: uploadBatchWhere(scopedBankId(onNorth) ?? "") })
    ).map((batch) => batch.fileName);
    assert.deepEqual(testNames, ["test sheet.xlsx"]);
    assert.deepEqual(northNames, ["OD Data more than 154 day.xlsx"]);
    assert.equal(canReadBank(onTest, northwind.id), false);
    assert.equal(canReadBank(onNorth, testBank.id), false);

    await db.user.create({
      data: {
        name: "Bank Person",
        email: "banker@bank.example",
        passwordHash: "hash",
        role: "BANK_USER",
        bankId: testBank.id,
        selectedBankId: northwind.id,
      },
    });
    const banker: SignedInUser = {
      id: "bank-user",
      name: "Bank Person",
      email: "banker@bank.example",
      role: "BANK_USER",
      mustChangePassword: false,
      bank: { id: testBank.id, name: testBank.name, code: testBank.code, active: true },
    };
    assert.equal(canReadBank(banker, northwind.id), false);
    assert.equal(scopedBankId(banker, northwind.id), testBank.id);
    const visibleToBanker = await db.uploadBatch.findMany({
      where: uploadBatchWhere(scopedBankId(banker, northwind.id) ?? ""),
    });
    assert.deepEqual(
      visibleToBanker.map((batch) => batch.fileName),
      ["test sheet.xlsx"],
    );
    assert.equal(visibleToBanker.some((batch) => batch.bankId === northwind.id), false);
  } finally {
    await db.$disconnect();
    rmSync(dir, { recursive: true, force: true });
  }
});
