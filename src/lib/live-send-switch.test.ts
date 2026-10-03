import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { readLiveSendEnabled, saveLiveSendSwitch } from "./live-send-store";
import { confirmSendsForReal, effectiveLiveSend } from "./live-send-switch";

test("a missing switch starts on, and a saved choice overrides the env flag", () => {
  const previous = process.env.MSG91_LIVE_SEND;
  try {
    process.env.MSG91_LIVE_SEND = "false";
    assert.equal(effectiveLiveSend(null), true);
    assert.equal(effectiveLiveSend(undefined), true);
    process.env.MSG91_LIVE_SEND = "true";
    assert.equal(effectiveLiveSend(false), false);
    assert.equal(effectiveLiveSend(true), true);
  } finally {
    if (previous === undefined) delete process.env.MSG91_LIVE_SEND;
    else process.env.MSG91_LIVE_SEND = previous;
  }
});

test("confirm sends for real only when the switch, the notice, and the key all say yes", () => {
  assert.equal(confirmSendsForReal({ switchOn: false, preparedLive: true, authKeySet: true }), false);
  assert.equal(confirmSendsForReal({ switchOn: true, preparedLive: false, authKeySet: true }), false);
  assert.equal(confirmSendsForReal({ switchOn: true, preparedLive: true, authKeySet: false }), false);
  assert.equal(confirmSendsForReal({ switchOn: true, preparedLive: true, authKeySet: true }), true);
});

test("the saved switch is still there after a new database connection", { timeout: 60_000 }, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "notice-live-"));
  const dbUrl = `file:${path.join(dir, "live.db")}`;
  const prismaBin = path.join(process.cwd(), "node_modules", ".bin", "prisma");
  execFileSync(prismaBin, ["db", "push", "--skip-generate"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: "pipe",
  });

  const first = new PrismaClient({ datasourceUrl: dbUrl });
  try {
    assert.equal(await readLiveSendEnabled(first), true);
    await saveLiveSendSwitch(false, first);
    assert.equal(await readLiveSendEnabled(first), false);
  } finally {
    await first.$disconnect();
  }

  const second = new PrismaClient({ datasourceUrl: dbUrl });
  try {
    assert.equal(await readLiveSendEnabled(second), false);
    await saveLiveSendSwitch(true, second);
    assert.equal(await readLiveSendEnabled(second), true);
  } finally {
    await second.$disconnect();
    rmSync(dir, { recursive: true, force: true });
  }
});
