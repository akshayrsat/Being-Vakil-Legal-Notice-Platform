// Words shown for a prepared send and for each person’s result.

import type { DeliveryStatus } from "@prisma/client";
import { SEND_CHANNELS, type SendChannel } from "./campaign-plan";
import { channelLabels, type TemplateChannel } from "./templates";

export const DELIVERY_STATUS_OPTIONS = [
  { id: "SIMULATED_SENT", label: "Dry run" },
  { id: "QUEUED", label: "Queued" },
  { id: "DELIVERED", label: "Delivered" },
  { id: "READ", label: "Read" },
  { id: "FAILED", label: "Failed" },
  { id: "SKIPPED", label: "Skipped" },
  { id: "PENDING", label: "Waiting" },
] as const;

export function deliveryStatusLabel(status: string, technical = false): string {
  if (status === "SENT" || status === "DELIVERED") return "Delivered";
  if (status === "SIMULATED_SENT") return technical ? "Dry run" : "Not sent";
  return DELIVERY_STATUS_OPTIONS.find((option) => option.id === status)?.label ?? "Waiting";
}

export function deliveryStatusChoices(technical = false): Array<{ id: string; label: string }> {
  return DELIVERY_STATUS_OPTIONS.map((option) => ({
    id: option.id,
    label: deliveryStatusLabel(option.id, technical),
  }));
}

export function isDeliveryStatus(value: string): boolean {
  return value === "SENT" || DELIVERY_STATUS_OPTIONS.some((option) => option.id === value);
}

export function statusesForFilter(status: string): DeliveryStatus[] {
  if (status === "DELIVERED" || status === "SENT") return ["SENT", "DELIVERED"];
  return [status as DeliveryStatus];
}

export function campaignStatusLabel(status: string, mode: string, technical = false): string {
  if (status === "REVIEW") return "Waiting for confirmation";
  if (status === "FAILED") return "Failed";
  if (status === "COMPLETED" && mode === "DRY_RUN") {
    return technical ? "Dry run finished" : "Recorded, nothing sent";
  }
  if (status === "COMPLETED") return "Send finished";
  return "Waiting for confirmation";
}

export function sendChannelLabel(channel: string): string {
  if (channel === "SMS") return "SMS";
  if (channel === "EMAIL") return "Email";
  if (channel === "WHATSAPP") return "WhatsApp";
  return channel;
}

export function labelsForChannels(channels: SendChannel[]): string {
  return channelLabels(channels as TemplateChannel[]);
}

export function countByChannel(
  deliveries: Array<{ channel: string; status: string }>,
): Array<{ channel: SendChannel; ready: number; skipped: number }> {
  return SEND_CHANNELS.filter((channel) => deliveries.some((row) => row.channel === channel)).map(
    (channel) => {
      const rows = deliveries.filter((row) => row.channel === channel);
      const skipped = rows.filter((row) => row.status === "SKIPPED").length;
      return { channel, ready: rows.length - skipped, skipped };
    },
  );
}
