import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { ODR_NOT_SENT_DETAIL } from "./odr-live";
import { fakeMeetLink } from "./odr-meet";
import { templatesFor, defaultTemplateMap } from "./odr-templates";

test("an ODR case stays on its bank, and a switched-off send does not call the message service", { timeout: 60_000 }, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "notice-odr-"));
  const dbFile = path.join(dir, "odr.db");
  const dbUrl = `file:${dbFile}`;
  const prismaBin = path.join(process.cwd(), "node_modules", ".bin", "prisma");
  execFileSync(prismaBin, ["db", "push", "--skip-generate"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: "pipe",
  });
  process.env.DATABASE_URL = dbUrl;
  process.env.ODR_LIVE_SEND = "";
  delete process.env.GOOGLE_MEET_SERVICE_ACCOUNT;
  delete process.env.GOOGLE_MEET_HOST_EMAIL;

  const { PrismaClient } = await import("@prisma/client");
  const { scheduleHearingRecord, processOdrWork } = await import("./odr-runner");
  const db = new PrismaClient({ datasourceUrl: dbUrl });
  let delivered = 0;
  try {
    const bank = await db.bank.create({ data: { name: "Test Bank", code: "TBODR", active: true } });
    const other = await db.bank.create({ data: { name: "Other Bank", code: "OBODR", active: true } });
    const batch = await db.odrBatch.create({
      data: {
        bankId: bank.id,
        fileName: "odr.xlsx",
        matterType: "ARBITRATION",
        hearingAt: new Date("2026-10-20T05:30:00.000Z"),
        durationMinutes: 60,
        saved: true,
        status: "SENDING",
      },
    });
    const item = await db.odrCase.create({
      data: {
        bankId: bank.id,
        batchId: batch.id,
        refNo: "ARB-2026-TEST01",
        matterType: "ARBITRATION",
        customerName: "Ravi Shah",
        accountNumber: "1234567781",
        mobile: "9876543210",
        email: "ravi@example.com",
        publicToken: "token-test-odr-case-page-0001",
        neutralName: "A. Rao",
      },
    });
    const templates = templatesFor(defaultTemplateMap({}), "ARBITRATION", "first");
    await scheduleHearingRecord(db, {
      caseId: item.id,
      bankId: bank.id,
      matterType: "ARBITRATION",
      mobile: item.mobile,
      email: item.email,
      number: 1,
      scheduledAt: new Date("2026-10-20T05:30:00.000Z"),
      durationMinutes: 60,
      kind: "FIRST",
      live: false,
      templates,
      actorName: "Test",
    });
    const progress = await processOdrWork(db, {
      bankId: bank.id,
      batchId: batch.id,
      deps: {
        now: new Date("2026-10-01T00:00:00.000Z"),
        live: false,
        rules: {
          templates: defaultTemplateMap({}),
          reminderDaysBefore: 1,
          reminderHoursBefore: 1,
          reminderDayOn: true,
          reminderHourOn: true,
          maxNoShow: 3,
          autoRescheduleDays: 0,
          sendWindowStart: "09:00",
          sendWindowEnd: "18:30",
          maxRemindersPerHearing: 1,
          maxMessagesPerDay: 1,
          sheetRetentionDays: 30,
          closedDataRetentionDays: 0,
          consentDays: 15,
          liveStored: false,
          live: false,
        },
        createMeet: async (input) => ({
          ok: true,
          fake: true,
          link: fakeMeetLink(input.requestId),
          eventId: "",
          meetingCode: "",
        }),
        deliver: async () => {
          delivered += 1;
          return { ok: false, skipped: true, detail: ODR_NOT_SENT_DETAIL };
        },
      },
    });
    assert.equal(progress.done, true);
    assert.equal(delivered, 0);
    const hearing = await db.odrHearing.findFirst({ where: { caseId: item.id, bankId: bank.id } });
    assert.match(hearing?.meetLink ?? "", /practice-odr-link/);
    assert.equal(hearing?.meetFake, true);
    const messages = await db.odrMessage.findMany({ where: { caseId: item.id, bankId: bank.id } });
    assert.equal(messages.length, 3);
    const email = messages.find((row) => row.channel === "EMAIL");
    const sms = messages.find((row) => row.channel === "SMS");
    assert.equal(email?.status, "SKIPPED");
    assert.equal(email?.detail, ODR_NOT_SENT_DETAIL);
    assert.equal(sms?.detail, "SMS template not configured");
    assert.equal(await db.odrCase.count({ where: { bankId: other.id } }), 0);
    assert.equal(await db.odrMessage.count({ where: { bankId: other.id } }), 0);
  } finally {
    await db.$disconnect();
    rmSync(dir, { recursive: true, force: true });
  }
});
