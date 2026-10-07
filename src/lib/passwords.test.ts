import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { canSetTemporaryPassword, peopleGroups } from "./people";
import {
  FORGOT_ADMIN_NOTE,
  FORGOT_LIMIT,
  FORGOT_NEUTRAL,
  RESET_WINDOW_MS,
  changePasswordError,
  destinationAfterSignIn,
  forgotPasswordReply,
  hashResetToken,
  newResetToken,
  otherSessionsWhere,
  resetPasswordError,
  resetTokenState,
} from "./passwords";
import { passwordResetMailReady, sendPasswordResetEmail } from "./system-email";
import { ROLE_BANK_USER, ROLE_COORDINATOR, ROLE_OWNER } from "./roles";

test("a temporary password forces a new password before the rest of the site", () => {
  assert.equal(destinationAfterSignIn(true), "/account/password");
  assert.equal(destinationAfterSignIn(false), "/dashboard");
  assert.equal(changePasswordError({ current: "old-password", next: "short", confirm: "short" }), "Use a password of at least 8 characters.");
  assert.equal(
    changePasswordError({ current: "old-password", next: "new-password", confirm: "other-password" }),
    "Type the new password again so both match.",
  );
  assert.equal(changePasswordError({ current: "same-password", next: "same-password", confirm: "same-password" })?.includes("different"), true);
  assert.equal(changePasswordError({ current: "old-password", next: "new-password", confirm: "new-password" }), null);
  assert.equal(resetPasswordError("new-password", "new-password"), null);
});

test("a reset token expires after 30 minutes and is single use", () => {
  const issued = newResetToken(1_000);
  assert.equal(issued.tokenHash, hashResetToken(issued.token));
  assert.notEqual(issued.token, issued.tokenHash);
  assert.equal(issued.expiresAt.getTime() - 1_000, RESET_WINDOW_MS);
  assert.equal(resetTokenState({ expiresAt: issued.expiresAt, usedAt: null }, 1_000 + 29 * 60 * 1000), "ready");
  assert.equal(resetTokenState({ expiresAt: issued.expiresAt, usedAt: null }, 1_000 + RESET_WINDOW_MS), "expired");
  assert.equal(resetTokenState({ expiresAt: issued.expiresAt, usedAt: new Date(2_000) }, 1_000), "used");
  assert.equal(resetTokenState(null, 1_000), "missing");
});

test("forgot-password uses one message, and adds the admin note only when mail cannot be sent", () => {
  const ready = forgotPasswordReply({ limited: false, mailerReady: true });
  const blocked = forgotPasswordReply({ limited: false, mailerReady: false });
  assert.equal(ready.error, null);
  assert.equal(ready.message, FORGOT_NEUTRAL);
  assert.equal(ready.message.includes(FORGOT_ADMIN_NOTE), false);
  assert.equal(blocked.message, `${FORGOT_NEUTRAL} ${FORGOT_ADMIN_NOTE}`);
  assert.equal(forgotPasswordReply({ limited: true, mailerReady: false }).error, FORGOT_LIMIT);
});

test("changing a password drops other sessions and keeps the current one", () => {
  assert.deepEqual(otherSessionsWhere("user-1", null), { userId: "user-1" });
  assert.deepEqual(otherSessionsWhere("user-1", "session-2"), { userId: "user-1", id: { not: "session-2" } });
});

test("a legal coordinator can set a temporary password for staff and bank users, not the owner", () => {
  assert.equal(canSetTemporaryPassword(ROLE_OWNER, ROLE_COORDINATOR, false), true);
  assert.equal(canSetTemporaryPassword(ROLE_OWNER, ROLE_BANK_USER, false), true);
  assert.equal(canSetTemporaryPassword(ROLE_OWNER, ROLE_OWNER, true), false);
  assert.equal(canSetTemporaryPassword(ROLE_COORDINATOR, ROLE_BANK_USER, false), true);
  assert.equal(canSetTemporaryPassword(ROLE_COORDINATOR, ROLE_COORDINATOR, false), true);
  assert.equal(canSetTemporaryPassword(ROLE_COORDINATOR, ROLE_COORDINATOR, true), false);
  assert.equal(canSetTemporaryPassword(ROLE_COORDINATOR, ROLE_OWNER, false), false);
  assert.equal(canSetTemporaryPassword(ROLE_BANK_USER, ROLE_BANK_USER, false), false);
});

test("legal coordinators are listed as law-firm staff and do not show a bank", () => {
  const groups = peopleGroups([
    { id: "1", name: "Priya", email: "priya@firm.example", role: ROLE_COORDINATOR, bankName: "Stale Bank" },
    { id: "2", name: "Ravi", email: "ravi@bank.example", role: ROLE_BANK_USER, bankName: "Northwind" },
    { id: "3", name: "Meera", email: "meera@firm.example", role: ROLE_OWNER, bankName: null },
  ]);
  assert.deepEqual(
    groups.staff.map((person) => person.name),
    ["Priya", "Meera"],
  );
  assert.equal(
    groups.staff.every((person) => person.bankName === null),
    true,
  );
  assert.deepEqual(
    groups.bankUsers.map((person) => [person.name, person.bankName]),
    [["Ravi", "Northwind"]],
  );
});

test("password reset mail ignores the ODR switch and notice live send", async () => {
  const source = readFileSync(new URL("./system-email.ts", import.meta.url), "utf8");
  assert.equal(/ODR_|MSG91_LIVE_SEND|liveSendIsOn|OdrSettings/.test(source), false);
  assert.equal(passwordResetMailReady({ ODR_LIVE_SEND: "kill" }), false);

  let calls = 0;
  const blocked = await sendPasswordResetEmail(
    { to: "priya@firm.example", name: "Priya", link: "https://example.test/login/reset?token=abc" },
    {
      env: { ODR_LIVE_SEND: "kill", MSG91_LIVE_SEND: "true" },
      fetchImpl: async () => {
        calls += 1;
        return new Response("{}", { status: 200 });
      },
    },
  );
  assert.deepEqual(blocked, { ok: false, reason: "unconfigured" });
  assert.equal(calls, 0);

  let body = "";
  let url = "";
  const sent = await sendPasswordResetEmail(
    { to: "priya@firm.example", name: "Priya", link: "https://example.test/login/reset?token=abc" },
    {
      env: {
        MSG91_AUTH_KEY: "test-key",
        MSG91_EMAIL_FROM: "advocate@beingvakil.in",
        MSG91_EMAIL_DOMAIN: "beingvakil.in",
        MSG91_PASSWORD_RESET_TEMPLATE_ID: "password_reset",
        ODR_LIVE_SEND: "kill",
        MSG91_LIVE_SEND: "false",
      },
      fetchImpl: async (input, init) => {
        url = String(input);
        body = String(init?.body ?? "");
        return new Response(JSON.stringify({ type: "success" }), { status: 200 });
      },
    },
  );
  assert.deepEqual(sent, { ok: true });
  assert.match(url, /\/email\/send$/);
  assert.match(body, /reset_link/);
  assert.match(body, /priya@firm\.example/);
  assert.equal(body.includes("kill"), false);
});

test("a stored reset token can be claimed once, and other sessions are removed", { timeout: 60_000 }, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "notice-pw-"));
  const dbUrl = `file:${path.join(dir, "pw.db")}`;
  const prismaBin = path.join(process.cwd(), "node_modules", ".bin", "prisma");
  execFileSync(prismaBin, ["db", "push", "--skip-generate"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: "pipe",
  });
  const db = new PrismaClient({ datasourceUrl: dbUrl });
  try {
    const user = await db.user.create({
      data: {
        name: "Priya Shah",
        email: "priya@firm.example",
        passwordHash: "hash",
        role: "LEGAL_COORDINATOR",
        mustChangePassword: true,
        bankId: null,
      },
    });
    assert.equal(destinationAfterSignIn(user.mustChangePassword), "/account/password");

    const current = await db.session.create({
      data: { token: "current-session", userId: user.id, expiresAt: new Date(Date.now() + 60_000) },
    });
    await db.session.create({
      data: { token: "other-session", userId: user.id, expiresAt: new Date(Date.now() + 60_000) },
    });
    await db.session.deleteMany({ where: otherSessionsWhere(user.id, current.id) });
    const left = await db.session.findMany({ where: { userId: user.id } });
    assert.deepEqual(
      left.map((session) => session.id),
      [current.id],
    );

    const issued = newResetToken();
    const row = await db.passwordReset.create({
      data: { userId: user.id, tokenHash: issued.tokenHash, expiresAt: issued.expiresAt },
    });
    assert.equal(resetTokenState(row), "ready");
    const claimed = await db.passwordReset.updateMany({
      where: { id: row.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    assert.equal(claimed.count, 1);
    const again = await db.passwordReset.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    assert.equal(again.count, 0);
    const used = await db.passwordReset.findUniqueOrThrow({ where: { id: row.id } });
    assert.equal(resetTokenState(used), "used");

    const expired = await db.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash: hashResetToken("expired-token-value-not-the-live-one"),
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    assert.equal(resetTokenState(expired), "expired");
    const expiredClaim = await db.passwordReset.updateMany({
      where: { id: expired.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    assert.equal(expiredClaim.count, 0);
  } finally {
    await db.$disconnect();
    rmSync(dir, { recursive: true, force: true });
  }
});
