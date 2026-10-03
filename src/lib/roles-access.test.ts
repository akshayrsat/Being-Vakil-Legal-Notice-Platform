import assert from "node:assert/strict";
import test from "node:test";
import { auditActor } from "./audit";
import { canFlipLiveSend } from "./live-send-switch";
import { draftLogin, rolesThisPersonCanCreate } from "./people";
import {
  ROLE_ADMIN,
  ROLE_BANK_USER,
  ROLE_BANK_VIEWER,
  ROLE_COORDINATOR,
  ROLE_OWNER,
  canCreateLogins,
  canManageFirm,
  canSendNotices,
  isBankUser,
  isOwner,
  roleTitle,
  usesAssignedBank,
} from "./roles";

test("owner, legal coordinator, and bank user keep their own permissions", () => {
  assert.equal(isOwner(ROLE_OWNER), true);
  assert.equal(isOwner(ROLE_ADMIN), true);
  assert.equal(canSendNotices(ROLE_OWNER), true);
  assert.equal(canSendNotices(ROLE_COORDINATOR), true);
  assert.equal(canSendNotices(ROLE_BANK_USER), false);
  assert.equal(canManageFirm(ROLE_OWNER), true);
  assert.equal(canManageFirm(ROLE_COORDINATOR), false);
  assert.equal(canFlipLiveSend(ROLE_OWNER), true);
  assert.equal(canFlipLiveSend(ROLE_ADMIN), true);
  assert.equal(canFlipLiveSend(ROLE_COORDINATOR), false);
  assert.equal(canFlipLiveSend(ROLE_BANK_USER), false);
  assert.equal(canCreateLogins(ROLE_COORDINATOR), true);
  assert.equal(canCreateLogins(ROLE_BANK_VIEWER), false);
  assert.equal(usesAssignedBank(ROLE_BANK_USER), true);
  assert.equal(usesAssignedBank(ROLE_BANK_VIEWER), true);
  assert.equal(usesAssignedBank(ROLE_COORDINATOR), false);
  assert.equal(isBankUser(ROLE_BANK_VIEWER), true);
  assert.equal(roleTitle(ROLE_ADMIN), "Owner");
  assert.equal(roleTitle(ROLE_BANK_VIEWER), "Bank user");
  assert.equal(roleTitle(ROLE_COORDINATOR), "Legal coordinator");
});

test("the owner can add a coordinator or a bank user, and a coordinator can add only a bank user", () => {
  assert.deepEqual(rolesThisPersonCanCreate(ROLE_OWNER), [ROLE_COORDINATOR, ROLE_BANK_USER]);
  assert.deepEqual(rolesThisPersonCanCreate(ROLE_ADMIN), [ROLE_COORDINATOR, ROLE_BANK_USER]);
  assert.deepEqual(rolesThisPersonCanCreate(ROLE_COORDINATOR), [ROLE_BANK_USER]);
  assert.deepEqual(rolesThisPersonCanCreate(ROLE_BANK_USER), []);

  const coordinator = draftLogin({
    actorRole: ROLE_OWNER,
    name: "  Priya  Shah ",
    email: "Priya@Firm.Example",
    password: "notice-desk",
    role: ROLE_COORDINATOR,
    bankId: "should-be-ignored",
  });
  assert.equal(coordinator.ok, true);
  if (coordinator.ok) {
    assert.equal(coordinator.name, "Priya Shah");
    assert.equal(coordinator.email, "priya@firm.example");
    assert.equal(coordinator.bankId, null);
  }

  const blocked = draftLogin({
    actorRole: ROLE_COORDINATOR,
    name: "Second Owner",
    email: "owner2@firm.example",
    password: "notice-desk",
    role: ROLE_OWNER,
    bankId: "",
  });
  assert.deepEqual(blocked, { ok: false, error: "You cannot create that kind of login." });

  const missingBank = draftLogin({
    actorRole: ROLE_COORDINATOR,
    name: "Ravi Menon",
    email: "ravi@bank.example",
    password: "notice-desk",
    role: ROLE_BANK_USER,
    bankId: "",
  });
  assert.equal(missingBank.ok, false);

  const bankUser = draftLogin({
    actorRole: ROLE_COORDINATOR,
    name: "Ravi Menon",
    email: "ravi@bank.example",
    password: "notice-desk",
    role: ROLE_BANK_USER,
    bankId: "bank_north",
  });
  assert.equal(bankUser.ok, true);
  if (bankUser.ok) assert.equal(bankUser.bankId, "bank_north");
});

test("audit records the signed-in person's name and role", () => {
  const actor = auditActor({ id: "user-1", name: " Meera Iyer ", role: ROLE_OWNER });
  assert.deepEqual(actor, { actorId: "user-1", actorName: "Meera Iyer", actorRole: ROLE_OWNER });
  assert.notEqual(actor?.actorName, "Admin");
  assert.equal(auditActor({ id: "user-1", name: "   ", role: ROLE_OWNER }), null);
  assert.equal(auditActor({ id: "", name: "Meera Iyer", role: ROLE_OWNER }), null);
  assert.equal(auditActor(null), null);
});
