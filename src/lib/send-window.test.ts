import assert from "node:assert/strict";
import test from "node:test";
import { planOdrChannels } from "./odr-plan";
import {
  canQueueReminder,
  dayHold,
  istDayKey,
  nextSendWindowStart,
  pickReminderChannel,
  sendWindowOpen,
  validSendWindow,
  windowHold,
} from "./send-window";

const window = { start: "09:00", end: "18:30" };

function at(clock: string, day = "2026-10-06"): Date {
  return new Date(`${day}T${clock}:00.000+05:30`);
}

test("messages go out only from 09:00 to 18:30 IST", () => {
  assert.equal(sendWindowOpen(at("08:59"), window), false);
  assert.equal(sendWindowOpen(at("09:00"), window), true);
  assert.equal(sendWindowOpen(at("18:30"), window), true);
  assert.equal(sendWindowOpen(at("18:31"), window), false);
  assert.equal(istDayKey(at("23:30")), "2026-10-06");
});

test("a message outside the window waits for the next opening", () => {
  const early = windowHold(at("08:15"), window);
  assert.equal(early.hold, true);
  if (!early.hold) return;
  assert.equal(early.notBefore.toISOString(), at("09:00").toISOString());
  assert.match(early.detail, /09:00–18:30 IST/);

  const late = windowHold(at("19:05"), window);
  assert.equal(late.hold, true);
  if (!late.hold) return;
  assert.equal(late.notBefore.toISOString(), at("09:00", "2026-10-07").toISOString());
  assert.equal(windowHold(at("12:00"), window).hold, false);
  assert.equal(nextSendWindowStart(at("18:31"), window).toISOString(), at("09:00", "2026-10-07").toISOString());
});

test("automatic reminders stay within the per-hearing and per-day caps", () => {
  assert.equal(canQueueReminder(0, 1), true);
  assert.equal(canQueueReminder(1, 1), false);
  const plans = planOdrChannels({
    live: true,
    mobile: "919876543210",
    email: "person@example.com",
    templates: { smsFlowId: "sms", emailTemplateId: "email", whatsappTemplate: "wa" },
  });
  const chosen = pickReminderChannel(plans);
  assert.equal(chosen?.channel, "EMAIL");
  const smsOnly = planOdrChannels({
    live: true,
    mobile: "919876543210",
    email: "",
    templates: { smsFlowId: "sms", emailTemplateId: "email", whatsappTemplate: "wa" },
  });
  assert.equal(pickReminderChannel(smsOnly)?.channel, "SMS");
  const full = dayHold(at("12:00"), window, 1, 1);
  assert.equal(full.hold, true);
  if (!full.hold) return;
  assert.equal(full.notBefore.toISOString(), at("09:00", "2026-10-07").toISOString());
  assert.match(full.detail, /per day/);
  assert.equal(dayHold(at("12:00"), window, 0, 1).hold, false);
});

test("the send window must start before it ends", () => {
  assert.equal(validSendWindow("09:00", "18:30"), true);
  assert.equal(validSendWindow("18:30", "09:00"), false);
  assert.equal(validSendWindow("09:00", "09:00"), false);
});
