import assert from "node:assert/strict";
import test from "node:test";
import { collectStatusHits } from "./msg91-webhook";

test("SMS status 2 is a failure and email event 2 is ignored", () => {
  const sms = collectStatusHits({ status: "2", telNum: "919876543210", requestId: "sms-1" });
  assert.equal(sms.length, 1);
  assert.equal(sms[0]?.status, "FAILED");

  const email = collectStatusHits({
    eventName: "Accepted",
    eventId: "2",
    recipient: "person@bank.example",
    requestId: "mail-1",
  });
  assert.equal(email.length, 0);
});

test("negative delivery words are not treated as delivered or read", () => {
  const missed = collectStatusHits({
    description: "not delivered",
    mobile: "919876543210",
    requestId: "sms-2",
  });
  assert.equal(missed[0]?.status, "FAILED");

  const unread = collectStatusHits({
    eventName: "unread",
    customerNumber: "919876543210",
    requestId: "wa-1",
  });
  assert.equal(unread.length, 0);
});

test("a non-object payload and a huge walk do not throw", () => {
  assert.deepEqual(collectStatusHits("nope"), []);
  assert.deepEqual(collectStatusHits(null), []);
  assert.deepEqual(collectStatusHits(1), []);
  const nested = collectStatusHits({
    eventName: "delivered",
    requestId: "ok",
    mobile: "919876543210",
    extra: { eventName: "delivered", requestId: "ok-2", telNum: "919876543210" },
  });
  assert.ok(nested.length >= 1);
  assert.ok(nested.every((hit) => hit.status === "DELIVERED"));
});
