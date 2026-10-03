import assert from "node:assert/strict";
import test from "node:test";
import { collectStatusHits, parseWebhookPayload, storedReceipt } from "./msg91-webhook";

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

test("an SMS delivery receipt is delivered and a failure or bounce is failed", () => {
  const delivered = collectStatusHits({
    event: "sent",
    eventName: "delivered",
    status: "1",
    telNum: "919876543210",
    requestId: "sms-delivered",
    senderId: "BVAKIL",
  });
  assert.equal(delivered.length, 1);
  assert.equal(delivered[0]?.status, "DELIVERED");
  assert.equal(delivered[0]?.channel, "SMS");

  const handed = collectStatusHits({
    eventName: "sent",
    status: "0",
    telNum: "919876543210",
    requestId: "sms-sent",
    senderId: "BVAKIL",
  });
  assert.equal(handed.length, 0);

  for (const status of ["2", "9", "16", "17", "20", "25"]) {
    const failed = collectStatusHits({
      status,
      desc: status === "16" ? "REJECTED" : "FAILED",
      telNum: "919876543210",
      requestId: `sms-fail-${status}`,
      senderId: "BVAKIL",
    });
    assert.equal(failed[0]?.status, "FAILED", status);
    assert.equal(failed[0]?.channel, "SMS");
  }

  const bounced = collectStatusHits({
    description: "bounced",
    telNum: "919876543210",
    requestId: "sms-bounce",
    senderId: "BVAKIL",
  });
  assert.equal(bounced[0]?.status, "FAILED");
});

test("a stringified SMS report and a numbers map become delivery receipts", () => {
  const wrapped = collectStatusHits({
    data: JSON.stringify([
      {
        requestId: "sms-data",
        senderId: "BVAKIL",
        report: [{ desc: "DELIVERED", status: "1", number: "919876543210", date: "2024-05-22 10:06:20" }],
      },
    ]),
  });
  assert.equal(wrapped.length, 1);
  assert.equal(wrapped[0]?.status, "DELIVERED");
  assert.equal(wrapped[0]?.channel, "SMS");
  assert.equal(wrapped[0]?.requestId, "sms-data");

  const numbers = collectStatusHits({
    requestId: "sms-numbers",
    senderId: "BVAKIL",
    numbers: {
      "919876543210": { status: 2, desc: "FAILED", date: "2014-11-18 17:45:59" },
    },
  });
  assert.equal(numbers.length, 1);
  assert.equal(numbers[0]?.status, "FAILED");
  assert.equal(numbers[0]?.mobile, "919876543210");
  assert.equal(numbers[0]?.channel, "SMS");
});

test("SMS read is stored as delivered, and email read stays an open", () => {
  const openedAt = new Date("2026-10-02T04:15:00.000Z");
  const sms = storedReceipt({
    requestId: "sms",
    mobile: "919876543210",
    email: "",
    channel: "SMS",
    status: "READ",
    openedAt,
  });
  assert.equal(sms.status, "DELIVERED");
  assert.equal(sms.openedAt, null);

  const failed = storedReceipt({
    requestId: "sms-fail",
    mobile: "919876543210",
    email: "",
    channel: "SMS",
    status: "FAILED",
    openedAt: null,
  });
  assert.equal(failed.status, "FAILED");

  const email = storedReceipt({
    requestId: "mail",
    mobile: "",
    email: "person@bank.example",
    channel: "EMAIL",
    status: "READ",
    openedAt,
  });
  assert.equal(email.status, "READ");
  assert.equal(email.openedAt, openedAt);
});

test("a form body with a data field is accepted", () => {
  const body = parseWebhookPayload(
    "data=" +
      encodeURIComponent(
        JSON.stringify({ status: "1", telNum: "919876543210", requestId: "sms-form", senderId: "BVAKIL" }),
      ),
  );
  const hits = collectStatusHits(body);
  assert.equal(hits[0]?.status, "DELIVERED");
  assert.equal(hits[0]?.channel, "SMS");
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
