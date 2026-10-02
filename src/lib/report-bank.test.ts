import assert from "node:assert/strict";
import test from "node:test";
import type { SignedInUser } from "./auth";
import { canReadBank, scopedBankId } from "./report-bank";

function user(role: "ADMIN" | "BANK_VIEWER", bankId: string | null): SignedInUser {
  return {
    id: "user-1",
    name: "Tester",
    email: "tester@noticedesk.local",
    role,
    bank: bankId ? { id: bankId, name: "Bank", code: "BB", active: true } : null,
  };
}

test("a bank viewer cannot read another bank, even with an explicit filter", () => {
  const viewer = user("BANK_VIEWER", "bank-a");
  assert.equal(canReadBank(viewer, "bank-a"), true);
  assert.equal(canReadBank(viewer, "bank-b"), false);
  assert.equal(canReadBank(viewer, "bank-b", "bank-b"), false);
  assert.equal(scopedBankId(viewer, "bank-b"), "bank-a");
});

test("an admin sees only the switched bank unless the address names one bank", () => {
  const admin = user("ADMIN", "bank-a");
  assert.equal(canReadBank(admin, "bank-a"), true);
  assert.equal(canReadBank(admin, "bank-b"), false);
  assert.equal(canReadBank(admin, "bank-b", "bank-b"), true);
  assert.equal(canReadBank(admin, "bank-a", "bank-b"), false);
  assert.equal(scopedBankId(admin, "  bank-b  "), "bank-b");
});

test("an admin with no bank selected cannot guess an id", () => {
  const admin = user("ADMIN", null);
  assert.equal(scopedBankId(admin, null), null);
  assert.equal(canReadBank(admin, "bank-a"), false);
  assert.equal(canReadBank(admin, "bank-a", "bank-a"), true);
});
