// After the staff entry code, /login must show the email and password form.
// No session cookie. A Postgres URL is used on purpose: any database read throws,
// which is what used to open the local "npm run dev" error page on Cloud Run.

import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import test from "node:test";
import { STAFF_GATE_COOKIE, createStaffGateToken } from "./staff-gate";
import { SESSION_COOKIE } from "./auth";

const PORT = 4391;
const CODE = "correct-horse-battery";
const BASE = `http://127.0.0.1:${PORT}`;

async function waitForServer(child: ChildProcess, logs: { text: string }): Promise<void> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`next start exited ${child.exitCode}\n${logs.text.slice(-2000)}`);
    }
    try {
      const response = await fetch(`${BASE}/`, { redirect: "manual" });
      if (response.status > 0) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw new Error(`next start did not open\n${logs.text.slice(-2000)}`);
}

test("cleared cookies then entry code opens the sign-in form", { timeout: 40_000 }, async (t) => {
  const previousCode = process.env.NOTICE_DESK_ENTRY_CODE;
  process.env.NOTICE_DESK_ENTRY_CODE = CODE;

  const logs = { text: "" };
  const child = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(PORT)],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: "production",
        NOTICE_DESK_ENTRY_CODE: CODE,
        DATABASE_URL: "postgresql://postgres:unused@127.0.0.1:5432/notice_desk",
        PORT: String(PORT),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout?.on("data", (chunk: Buffer) => {
    logs.text += chunk.toString();
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    logs.text += chunk.toString();
  });

  t.after(() => {
    process.env.NOTICE_DESK_ENTRY_CODE = previousCode;
    child.kill("SIGTERM");
  });

  await waitForServer(child, logs);

  const locked = await fetch(`${BASE}/login`, { redirect: "manual" });
  assert.equal(locked.status, 307);
  assert.equal(locked.headers.get("location"), "/?staff=1");

  const token = createStaffGateToken();
  assert.ok(token);

  const opened = await fetch(`${BASE}/login`, {
    redirect: "manual",
    headers: { cookie: `${STAFF_GATE_COOKIE}=${token}` },
  });
  const html = await opened.text();
  assert.equal(opened.status, 200, html.slice(0, 300));
  assert.match(html, /Sign in/);
  assert.match(html, /name="email"/);
  assert.match(html, /name="password"/);
  assert.doesNotMatch(html, /This page did not open/);
  assert.doesNotMatch(html, /npm run dev/);
  assert.doesNotMatch(html, /practice database/);

  const withStaleSession = await fetch(`${BASE}/login`, {
    redirect: "manual",
    headers: {
      cookie: `${STAFF_GATE_COOKIE}=${token}; ${SESSION_COOKIE}=not-a-real-session`,
    },
  });
  const staleHtml = await withStaleSession.text();
  assert.equal(withStaleSession.status, 200, staleHtml.slice(0, 300));
  assert.match(staleHtml, /name="email"/);
  assert.doesNotMatch(staleHtml, /npm run dev/);
  assert.doesNotMatch(staleHtml, /This page did not open/);
});
