// The ODR template list. Approved wording can be opened from the list.
// A pending template stays visible and cannot be selected.
// Reference ids are for the owner admin. Everyone else sees the name, the channel, and the status.

import {
  FIRST_HEARING_EMAIL_SUBJECT,
  FIRST_HEARING_EMAIL_TEXT,
  FIRST_HEARING_WHATSAPP_TEXT,
  ODR_WHATSAPP_LANGUAGE,
  odrTemplateSlots,
  slotLabel,
  type OdrChannelTemplates,
  type OdrTemplateMap,
} from "./odr-templates";
import { channelLabels, type TemplateChannel } from "./templates";

const CHANNELS: TemplateChannel[] = ["EMAIL", "WHATSAPP", "SMS"];

export type OdrLibraryItem = {
  id: string;
  slot: string;
  channel: TemplateChannel;
  name: string;
  status: "APPROVED" | "PENDING";
  vendorId: string;
  vendorLabel: string;
  body: string;
};

export function odrLibraryId(slot: string, channel: TemplateChannel): string {
  return `${slot.replace(".", "-")}-${channel.toLowerCase()}`;
}

export function parseOdrLibraryId(id: string): { slot: string; channel: TemplateChannel } | null {
  const match = /^(arbitration|mediation)-(first|next|reminder)-(email|whatsapp|sms)$/.exec(id.trim());
  if (!match) return null;
  const channel: TemplateChannel = match[3] === "sms" ? "SMS" : match[3] === "email" ? "EMAIL" : "WHATSAPP";
  return { slot: `${match[1]}.${match[2]}`, channel };
}

function vendorIdFor(row: OdrChannelTemplates, channel: TemplateChannel): string {
  if (channel === "SMS") return row.smsFlowId.trim();
  if (channel === "EMAIL") return row.emailTemplateId.trim();
  return row.whatsappTemplate.trim();
}

function vendorLabel(channel: TemplateChannel): string {
  if (channel === "SMS") return "SMS flow id";
  if (channel === "EMAIL") return "Email template id";
  return "WhatsApp template";
}

// Only the first arbitration hearing is approved. SMS still needs a DLT flow id.
// Next hearing, reminders, and mediation stay pending even when an id is saved.
export function odrChannelApproved(slot: string, channel: TemplateChannel, vendorId: string): boolean {
  if (slot !== "arbitration.first") return false;
  if (channel === "SMS") return vendorId.trim().length > 0;
  return vendorId.trim().length > 0;
}

export function odrLibraryBody(slot: string, channel: TemplateChannel, approved: boolean): string {
  if (approved && slot === "arbitration.first" && channel === "EMAIL") {
    return [`Subject: ${FIRST_HEARING_EMAIL_SUBJECT}`, "", FIRST_HEARING_EMAIL_TEXT].join("\n");
  }
  if (approved && slot === "arbitration.first" && channel === "WHATSAPP") {
    return FIRST_HEARING_WHATSAPP_TEXT;
  }
  if (approved && channel === "SMS") {
    return "This SMS is approved for the first arbitration hearing.";
  }
  return "This template is not approved yet. Until it is approved, this channel is not sent.";
}

export function odrTemplateLibrary(map: OdrTemplateMap): OdrLibraryItem[] {
  const items: OdrLibraryItem[] = [];
  for (const slot of odrTemplateSlots()) {
    const row = map[slot] ?? { smsFlowId: "", emailTemplateId: "", whatsappTemplate: "" };
    for (const channel of CHANNELS) {
      const vendorId = vendorIdFor(row, channel);
      const approved = odrChannelApproved(slot, channel, vendorId);
      const channelName = channelLabels([channel]);
      items.push({
        id: odrLibraryId(slot, channel),
        slot,
        channel,
        name: `${slotLabel(slot)} · ${channelName}`,
        status: approved ? "APPROVED" : "PENDING",
        vendorId,
        vendorLabel: vendorLabel(channel),
        body: odrLibraryBody(slot, channel, approved),
      });
    }
  }
  return items;
}

export function selectableOdrTemplates(items: readonly OdrLibraryItem[]): OdrLibraryItem[] {
  return items.filter((item) => item.status === "APPROVED");
}

export function pendingOdrTemplates(items: readonly OdrLibraryItem[]): OdrLibraryItem[] {
  return items.filter((item) => item.status === "PENDING");
}

export function odrLibraryDetail(item: OdrLibraryItem, showVendorDetail: boolean): string {
  const status = item.status === "APPROVED" ? "Approved" : "Pending";
  const channel = channelLabels([item.channel]);
  if (!showVendorDetail) return `${status} · ${channel}`;
  const idPart = item.vendorId ? `${item.vendorLabel} ${item.vendorId}` : `${item.vendorLabel} not set`;
  const language = item.channel === "WHATSAPP" && item.vendorId ? ` · language ${ODR_WHATSAPP_LANGUAGE}` : "";
  return `${status} · ${channel} · ${idPart}${language}`;
}

export function odrTemplatesListIntro(bankName: string, showVendorDetail: boolean): string {
  const shared = `These are the firm’s ODR templates. Every bank, including ${bankName}, can select an approved one.`;
  const vendor = showVendorDetail
    ? " SMS uses a DLT flow id. Email and WhatsApp use the template id."
    : "";
  return `${shared}${vendor} A pending template is listed and cannot be selected. This page does not send a message.`;
}

export function odrTemplatesListCard(showVendorDetail: boolean): string {
  if (showVendorDetail) {
    return "Approved templates can be selected. Pending templates stay on the list. Each row shows the channel and the reference id. Open one to read the wording.";
  }
  return "Approved templates can be selected. Pending templates stay on the list. Each row shows the name, the channel, and whether it is approved. Open one to read the wording.";
}

export function odrTemplateDetailCard(showVendorDetail: boolean): string {
  if (showVendorDetail) {
    return "The name, the status, the channel, the template reference, and the message. This page does not change them.";
  }
  return "The name, the status, the channel, and the message. This page does not change the template.";
}

export function odrTemplateMissingCopy(): string {
  return "That template is not one of the firm’s ODR templates.";
}

export function odrWordingPreview(body: string): string {
  return body.replace(/\s+/g, " ").trim().slice(0, 180);
}
