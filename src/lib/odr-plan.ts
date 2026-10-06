// What each channel will do before anything is handed to an operator.

import { ODR_NOT_SENT_DETAIL } from "./odr-live";
import { unconfiguredDetail, type OdrChannelTemplates } from "./odr-templates";
import { toMsg91Mobile } from "./phone";

export const ODR_CHANNELS = ["SMS", "EMAIL", "WHATSAPP"] as const;
export type OdrChannel = (typeof ODR_CHANNELS)[number];

export type ChannelPlan = {
  channel: OdrChannel;
  to: string;
  status: "QUEUED" | "SKIPPED";
  detail: string;
};

export function planOdrChannels(input: {
  live: boolean;
  mobile: string;
  email: string;
  templates: OdrChannelTemplates;
}): ChannelPlan[] {
  return ODR_CHANNELS.map((channel) => planOne(channel, input));
}

function planOne(
  channel: OdrChannel,
  input: { live: boolean; mobile: string; email: string; templates: OdrChannelTemplates },
): ChannelPlan {
  if (channel === "EMAIL") {
    const email = input.email.trim();
    if (!email.includes("@")) return { channel, to: email, status: "SKIPPED", detail: "No email address" };
    if (!input.templates.emailTemplateId) {
      return { channel, to: email, status: "SKIPPED", detail: unconfiguredDetail(channel) };
    }
    if (!input.live) return { channel, to: email, status: "SKIPPED", detail: ODR_NOT_SENT_DETAIL };
    return { channel, to: email, status: "QUEUED", detail: "" };
  }

  const mobile = toMsg91Mobile(input.mobile) ?? "";
  if (!mobile) return { channel, to: input.mobile.trim(), status: "SKIPPED", detail: "No mobile number" };
  const template = channel === "SMS" ? input.templates.smsFlowId : input.templates.whatsappTemplate;
  if (!template) return { channel, to: mobile, status: "SKIPPED", detail: unconfiguredDetail(channel) };
  if (!input.live) return { channel, to: mobile, status: "SKIPPED", detail: ODR_NOT_SENT_DETAIL };
  return { channel, to: mobile, status: "QUEUED", detail: "" };
}

export function autoSendAllowed(input: { flaggedExParte: boolean; noShowCount: number; maxNoShow: number }): boolean {
  if (input.flaggedExParte) return false;
  return input.noShowCount < input.maxNoShow;
}

export function nextNoShowState(input: {
  noShowCount: number;
  maxNoShow: number;
}): { noShowCount: number; flaggedExParte: boolean } {
  const noShowCount = input.noShowCount + 1;
  const cap = input.maxNoShow > 0 ? input.maxNoShow : 3;
  return { noShowCount, flaggedExParte: noShowCount >= cap };
}
