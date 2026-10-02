import assert from "node:assert/strict";
import test from "node:test";
import {
  codesMatch,
  createStaffGateToken,
  staffGateCookieOptions,
  staffGateTokenValid,
} from "./staff-gate";

test("entry code checks, cookie expiry, and logout cookie flags", () => {
  const originalCode = process.env.NOTICE_DESK_ENTRY_CODE;
  const originalEnv = process.env.NODE_ENV;
  try {
    delete process.env.NOTICE_DESK_ENTRY_CODE;
    assert.equal(codesMatch("noticedesk-unset-entry-code"), false);
    assert.equal(codesMatch("correct-horse"), false);
    process.env.NOTICE_DESK_ENTRY_CODE = "short";
    assert.equal(codesMatch("short"), false);

    process.env.NOTICE_DESK_ENTRY_CODE = "correct-horse-battery";
    assert.equal(codesMatch("wrong-horse-battery"), false);
    assert.equal(codesMatch("correct-horse-battery"), true);

    const now = 1_700_000_000_000;
    const token = createStaffGateToken(now);
    assert.ok(token);
    assert.equal(staffGateTokenValid(token, now + 1000), true);
    assert.equal(staffGateTokenValid(token, now + 3 * 60 * 60 * 1000), false);
    assert.equal(staffGateTokenValid(token.replace(".", ".0"), now + 1000), false);
    assert.equal(staffGateTokenValid(undefined, now), false);

    (process.env as { NODE_ENV?: string }).NODE_ENV = "production";
    const cleared = staffGateCookieOptions(0);
    assert.equal(cleared.maxAge, 0);
    assert.equal(cleared.path, "/");
    assert.equal(cleared.httpOnly, true);
    assert.equal(cleared.secure, true);
  } finally {
    if (originalCode === undefined) delete process.env.NOTICE_DESK_ENTRY_CODE;
    else process.env.NOTICE_DESK_ENTRY_CODE = originalCode;
    (process.env as { NODE_ENV?: string }).NODE_ENV = originalEnv;
  }
});
