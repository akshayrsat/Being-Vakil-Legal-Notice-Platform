import assert from "node:assert/strict";
import test from "node:test";
import type { SignedInUser } from "./auth";
import { canReadBank, scopedBankId } from "./report-bank";

function user(role: "ADMIN" | "BANK_VIEWER" | "LEGAL_COORDINATOR" | "BANK_USER", bankId: string | null): SignedInUser {
  return {
    id: "user-1",
    name: "Tester",
    email: "tester@noticedesk.local",
    role,
    mustChangePassword: false,
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

test("an admin cannot open another bank by naming it in the address", () => {
  const admin = user("ADMIN", "bank-a");
  assert.equal(canReadBank(admin, "bank-a"), true);
  assert.equal(canReadBank(admin, "bank-b"), false);
  assert.equal(canReadBank(admin, "bank-b", "bank-b"), false);
  assert.equal(canReadBank(admin, "bank-a", "bank-b"), true);
  assert.equal(scopedBankId(admin, "  bank-b  "), "bank-a");
  assert.equal(scopedBankId(admin, "bank-a"), "bank-a");
});

test("a legal coordinator can read each bank they switch to, one at a time", () => {
  const onA = user("LEGAL_COORDINATOR", "bank-a");
  const onB = user("LEGAL_COORDINATOR", "bank-b");
  assert.equal(canReadBank(onA, "bank-a"), true);
  assert.equal(canReadBank(onA, "bank-b"), false);
  assert.equal(canReadBank(onA, "bank-b", "bank-b"), false);
  assert.equal(canReadBank(onB, "bank-b"), true);
  assert.equal(canReadBank(onB, "bank-a"), false);
  assert.equal(scopedBankId(onB, "bank-a"), "bank-b");
});

test("a bank user still cannot see another bank", () => {
  const banker = user("BANK_USER", "bank-a");
  assert.equal(canReadBank(banker, "bank-a"), true);
  assert.equal(canReadBank(banker, "bank-b"), false);
  assert.equal(canReadBank(banker, "bank-b", "bank-b"), false);
  assert.equal(scopedBankId(banker, "bank-b"), "bank-a");
});

test("an admin with no bank selected cannot guess an id", () => {
  const admin = user("ADMIN", null);
  assert.equal(scopedBankId(admin, null), null);
  assert.equal(scopedBankId(admin, "bank-a"), null);
  assert.equal(canReadBank(admin, "bank-a"), false);
  assert.equal(canReadBank(admin, "bank-a", "bank-a"), false);
});
