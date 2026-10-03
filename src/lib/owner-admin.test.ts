import assert from "node:assert/strict";
import test from "node:test";
import { isOwnerAdmin, ownerAdminEmails } from "./owner-admin";
import { ROLE_ADMIN, ROLE_BANK_VIEWER, ROLE_COORDINATOR, ROLE_OWNER } from "./roles";

test("the built-in owner list is the two owner admin addresses", () => {
  assert.deepEqual(ownerAdminEmails(undefined), ["akshayrsathe@gmail.com", "akshayrsat@gmail.com"]);
  assert.deepEqual(ownerAdminEmails("   "), ["akshayrsathe@gmail.com", "akshayrsat@gmail.com"]);
});

test("OWNER_ADMIN_EMAILS replaces the built-in list", () => {
  assert.deepEqual(ownerAdminEmails("Owner@Firm.example, other@firm.example"), [
    "owner@firm.example",
    "other@firm.example",
  ]);
  assert.deepEqual(ownerAdminEmails("owner@firm.example;other@firm.example"), [
    "owner@firm.example",
    "other@firm.example",
  ]);
});

test("only an Admin on the owner list sees vendor template detail", () => {
  assert.equal(isOwnerAdmin({ role: ROLE_ADMIN, email: "AkshayRSathe@gmail.com" }), true);
  assert.equal(isOwnerAdmin({ role: ROLE_ADMIN, email: "akshayrsat@gmail.com" }), true);
  assert.equal(isOwnerAdmin({ role: ROLE_OWNER, email: "akshayrsat@gmail.com" }), true);
  assert.equal(isOwnerAdmin({ role: ROLE_COORDINATOR, email: "akshayrsat@gmail.com" }), false);
  assert.equal(isOwnerAdmin({ role: ROLE_ADMIN, email: "admin@noticedesk.local" }), false);
  assert.equal(isOwnerAdmin({ role: ROLE_ADMIN, email: "shweta@beingvakil.com" }), false);
  assert.equal(isOwnerAdmin({ role: ROLE_BANK_VIEWER, email: "akshayrsathe@gmail.com" }), false);
  assert.equal(isOwnerAdmin({ role: ROLE_BANK_VIEWER, email: "viewer@noticedesk.local" }), false);
  assert.equal(isOwnerAdmin(null), false);
  assert.equal(
    isOwnerAdmin({ role: ROLE_ADMIN, email: "admin@noticedesk.local" }, "admin@noticedesk.local"),
    true,
  );
  assert.equal(
    isOwnerAdmin({ role: ROLE_ADMIN, email: "akshayrsat@gmail.com" }, "owner@firm.example"),
    false,
  );
});
