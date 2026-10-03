import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { alignMsg91Library, practiceTemplateDisposition } from "./align-msg91-library";
import { DEMO_TEMPLATES, MSG91_EMAIL_TEMPLATE_ID, MSG91_SMS_FLOW_ID, MSG91_WHATSAPP_TEMPLATE_ID } from "./demo-templates";
import { staffTemplateLibraryView } from "./templates";

const SMS = DEMO_TEMPLATES[0];
const EMAIL = DEMO_TEMPLATES[1];
const WHATSAPP = DEMO_TEMPLATES[2];

test("practice rows are deleted, retired, or kept without touching the three live ids", () => {
  const live = new Set(["sms", "email", "whatsapp"]);
  assert.equal(
    practiceTemplateDisposition(
      {
        id: "sms",
        bankCode: "NWH",
        name: SMS.name,
        dltTemplateId: SMS.dltTemplateId,
        seedKey: SMS.seedKey,
        status: "APPROVED",
        referenced: true,
      },
      live,
    ),
    "keep",
  );
  assert.equal(
    practiceTemplateDisposition(
      {
        id: "old-sms",
        bankCode: "NWH",
        name: "Loan recall notice (SMS)",
        dltTemplateId: "1107165400000000001",
        seedKey: null,
        status: "APPROVED",
        referenced: false,
      },
      live,
    ),
    "delete",
  );
  assert.equal(
    practiceTemplateDisposition(
      {
        id: "used",
        bankCode: "NWH",
        name: "Practice send wording",
        dltTemplateId: "practice-id",
        seedKey: null,
        status: "APPROVED",
        referenced: true,
      },
      live,
    ),
    "retire",
  );
  assert.equal(
    practiceTemplateDisposition(
      {
        id: "used-draft",
        bankCode: "MCB",
        name: "Practice send wording",
        dltTemplateId: "practice-id",
        seedKey: null,
        status: "DRAFT",
        referenced: true,
      },
      live,
    ),
    "keep",
  );
  assert.equal(
    practiceTemplateDisposition(
      {
        id: "real",
        bankCode: "MH",
        name: "Branch circular",
        dltTemplateId: "real-bank-template",
        seedKey: null,
        status: "APPROVED",
        referenced: false,
      },
      live,
    ),
    "keep",
  );
  assert.equal(
    practiceTemplateDisposition(
      {
        id: "copy",
        bankCode: "MH",
        name: "Legal notice (SMS) copy",
        dltTemplateId: MSG91_SMS_FLOW_ID,
        seedKey: null,
        status: "APPROVED",
        referenced: false,
      },
      live,
    ),
    "delete",
  );
});

test("the align script does not assign MSG91_LIVE_SEND", () => {
  const source = readFileSync(new URL("../../scripts/align-msg91-library.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /MSG91_LIVE_SEND\s*=/);
  assert.match(source, /moveExistingToBank:\s*false/);
});

test("Cloud SQL align keeps the three live templates and drops practice rows", { timeout: 60_000 }, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "notice-align-"));
  const dbUrl = `file:${path.join(dir, "align.db")}`;
  const liveSendBefore = process.env.MSG91_LIVE_SEND;
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
    const meridian = await db.bank.create({
      data: { name: "Meridian Co-operative Bank", code: "MCB", active: true },
    });
    const harbour = await db.bank.create({ data: { name: "Harbour Credit", code: "HCR", active: false } });
    const user = await db.user.create({
      data: {
        name: "Staff",
        email: "staff@example.com",
        passwordHash: "kept-password-hash",
        role: "ADMIN",
        selectedBankId: testBank.id,
      },
    });

    const sms = await db.noticeTemplate.create({
      data: {
        bankId: northwind.id,
        name: "Legal notice (SMS)",
        dltTemplateId: MSG91_SMS_FLOW_ID,
        channels: '["SMS"]',
        body: "sms note",
        status: "APPROVED",
        seedKey: "nwh-loan-recall-sms",
      },
    });
    const email = await db.noticeTemplate.create({
      data: {
        bankId: northwind.id,
        name: "Legal notice (email)",
        dltTemplateId: MSG91_EMAIL_TEMPLATE_ID,
        channels: '["EMAIL"]',
        body: "email note",
        status: "APPROVED",
        seedKey: "nwh-borrower-email",
      },
    });
    const whatsapp = await db.noticeTemplate.create({
      data: {
        bankId: northwind.id,
        name: "Legal notice (WhatsApp)",
        dltTemplateId: MSG91_WHATSAPP_TEMPLATE_ID,
        channels: '["WHATSAPP"]',
        body: "whatsapp note",
        status: "APPROVED",
        seedKey: "msg91-legal-notice-whatsapp",
      },
    });
    await db.noticeTemplate.create({
      data: {
        bankId: northwind.id,
        name: "Loan recall notice (SMS)",
        dltTemplateId: "1107165400000000001",
        channels: '["SMS"]',
        body: "old practice sms",
        status: "APPROVED",
      },
    });
    await db.noticeTemplate.create({
      data: {
        bankId: meridian.id,
        name: "Borrower email notice",
        dltTemplateId: "1107165400000000002",
        channels: '["EMAIL"]',
        body: "old practice email",
        status: "APPROVED",
      },
    });
    await db.noticeTemplate.create({
      data: {
        bankId: harbour.id,
        name: "Harbour demo",
        dltTemplateId: "",
        channels: "[]",
        body: "demo",
        status: "DRAFT",
      },
    });
    await db.noticeTemplate.create({
      data: {
        bankId: northwind.id,
        name: "Legal notice (SMS) copy",
        dltTemplateId: MSG91_SMS_FLOW_ID,
        channels: '["SMS"]',
        body: "duplicate",
        status: "APPROVED",
      },
    });
    const used = await db.noticeTemplate.create({
      data: {
        bankId: northwind.id,
        name: "Practice send wording",
        dltTemplateId: "practice-id",
        channels: '["SMS"]',
        body: "used by a send",
        status: "APPROVED",
      },
    });
    const batch = await db.uploadBatch.create({
      data: {
        bankId: testBank.id,
        fileName: "kept-people.xlsx",
        headers: "[]",
        rawRows: "[]",
        saved: true,
        rowCount: 1,
      },
    });
    await db.recipientRow.create({
      data: { batchId: batch.id, bankId: testBank.id, rowNumber: 1, customerName: "Kept person" },
    });
    const campaign = await db.campaign.create({
      data: {
        bankId: testBank.id,
        batchId: batch.id,
        templateId: used.id,
        templateName: used.name,
        templateBody: "snapshot of the send",
        dltTemplateId: used.dltTemplateId,
        channels: '["SMS"]',
        mode: "DRY_RUN",
        createdById: user.id,
      },
    });
    const linkedNotice = await db.publicNotice.create({
      data: {
        noticeNumber: "KEEP-NOTICE-1",
        bankId: northwind.id,
        campaignId: campaign.id,
        customerName: "Akshay Sathe",
        bankName: "Northwind Housing Finance",
        body: "practice notice body",
        seedKey: "demo-akshay-sathe",
      },
    });
    await db.publicNotice.create({
      data: {
        noticeNumber: "KEEP-NOTICE-2",
        bankId: testBank.id,
        customerName: "Kept borrower",
        bankName: "Test Bank",
        body: "loose notice",
      },
    });

    const first = await alignMsg91Library(db, { bankIdForNew: northwind.id, moveExistingToBank: false });
    assert.deepEqual(first.upserted, [SMS.name, EMAIL.name, WHATSAPP.name]);
    assert.equal(first.retired, 1);
    assert.equal(first.deleted, 4);

    const second = await alignMsg91Library(db, { bankIdForNew: northwind.id, moveExistingToBank: false });
    assert.deepEqual(second.upserted, [SMS.name, EMAIL.name, WHATSAPP.name]);
    assert.equal(second.retired, 0);
    assert.equal(second.deleted, 0);
    assert.equal(process.env.MSG91_LIVE_SEND, liveSendBefore);

    const keptSms = await db.noticeTemplate.findUnique({ where: { id: sms.id } });
    const keptEmail = await db.noticeTemplate.findUnique({ where: { id: email.id } });
    const keptWhatsapp = await db.noticeTemplate.findUnique({ where: { id: whatsapp.id } });
    assert.equal(keptSms?.dltTemplateId, MSG91_SMS_FLOW_ID);
    assert.equal(keptEmail?.dltTemplateId, MSG91_EMAIL_TEMPLATE_ID);
    assert.equal(keptWhatsapp?.dltTemplateId, MSG91_WHATSAPP_TEMPLATE_ID);
    assert.equal(keptSms?.status, "APPROVED");
    assert.equal(keptEmail?.status, "APPROVED");
    assert.equal(keptWhatsapp?.status, "APPROVED");
    assert.equal(keptSms?.bankId, northwind.id);
    assert.equal(keptSms?.name, "Legal notice (SMS)");
    assert.equal(keptEmail?.name, "Legal notice (email)");
    assert.equal(keptWhatsapp?.name, "Legal notice (WhatsApp)");
    assert.equal(keptSms?.body, SMS.body);
    assert.equal(keptEmail?.body, EMAIL.body);
    assert.equal(keptWhatsapp?.body, WHATSAPP.body);
    assert.doesNotMatch(keptSms?.body ?? "", /not this free text/);
    assert.doesNotMatch(keptEmail?.body ?? "", /not this free text/);
    assert.doesNotMatch(keptWhatsapp?.body ?? "", /not this free text/);

    const usedAfter = await db.noticeTemplate.findUnique({ where: { id: used.id } });
    assert.equal(usedAfter?.status, "DRAFT");
    assert.equal(usedAfter?.dltTemplateId, "practice-id");

    const names = (await db.noticeTemplate.findMany({ select: { name: true, dltTemplateId: true } })).map(
      (row) => row.name,
    );
    assert.equal(names.includes("Loan recall notice (SMS)"), false);
    assert.equal(names.includes("Borrower email notice"), false);
    assert.equal(names.includes("Harbour demo"), false);
    assert.equal(names.includes("Legal notice (SMS) copy"), false);
    assert.equal(
      (await db.noticeTemplate.findMany({ where: { dltTemplateId: MSG91_SMS_FLOW_ID } })).length,
      1,
    );

    const rows = await db.noticeTemplate.findMany({ include: { bank: { select: { name: true } } } });
    const view = staffTemplateLibraryView(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        bankId: row.bankId,
        bankName: row.bank.name,
        status: row.status,
        channels: row.channels,
        dltTemplateId: row.dltTemplateId,
        seedKey: row.seedKey,
      })),
      testBank.id,
    );
    assert.deepEqual(view.choiceLabels, [
      "Legal notice (email)",
      "Legal notice (SMS)",
      "Legal notice (WhatsApp)",
    ]);
    assert.deepEqual(
      view.saved.map((row) => row.name),
      ["Legal notice (email)", "Legal notice (SMS)", "Legal notice (WhatsApp)"],
    );
    const visible = JSON.stringify(view);
    assert.doesNotMatch(visible, /Northwind|Meridian|Harbour|Written for/);
    assert.deepEqual(
      view.saved.map((row) => row.detail),
      ["Email", "SMS", "WhatsApp"],
    );
    assert.doesNotMatch(visible, new RegExp(MSG91_SMS_FLOW_ID));
    assert.doesNotMatch(visible, new RegExp(MSG91_EMAIL_TEMPLATE_ID));
    assert.doesNotMatch(visible, new RegExp(MSG91_WHATSAPP_TEMPLATE_ID));
    const ownerView = staffTemplateLibraryView(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        bankId: row.bankId,
        bankName: row.bank.name,
        status: row.status,
        channels: row.channels,
        dltTemplateId: row.dltTemplateId,
        seedKey: row.seedKey,
      })),
      testBank.id,
      { showVendorDetail: true },
    );
    const ownerVisible = JSON.stringify(ownerView);
    assert.match(ownerVisible, new RegExp(MSG91_SMS_FLOW_ID));
    assert.match(ownerVisible, new RegExp(MSG91_EMAIL_TEMPLATE_ID));
    assert.match(ownerVisible, new RegExp(MSG91_WHATSAPP_TEMPLATE_ID));

    assert.equal((await db.bank.findMany()).length, 4);
    assert.equal((await db.user.findUnique({ where: { id: user.id } }))?.passwordHash, "kept-password-hash");
    const notices = await db.publicNotice.findMany({ orderBy: { noticeNumber: "asc" } });
    assert.deepEqual(
      notices.map((notice) => notice.body),
      ["practice notice body", "loose notice"],
    );
    assert.equal(notices[0]?.id, linkedNotice.id);
    const keptCampaign = await db.campaign.findUnique({ where: { id: campaign.id } });
    assert.equal(keptCampaign?.templateId, used.id);
    assert.equal(keptCampaign?.templateBody, "snapshot of the send");
    assert.equal((await db.recipientRow.findMany()).length, 1);
    assert.equal((await db.recipientRow.findFirst())?.customerName, "Kept person");
  } finally {
    await db.$disconnect();
    rmSync(dir, { recursive: true, force: true });
  }
});
