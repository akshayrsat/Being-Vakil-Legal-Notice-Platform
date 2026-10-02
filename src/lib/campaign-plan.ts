// Decides, before anything is sent, which people can be reached on each channel.

import { fillNotice, noticePlainText, valuesForRecipient, type NoticeRecipient } from "./merge-notice";
import { noticePublicUrl, smsNoticeText, withNoticeLink } from "./notice-link";

export const SEND_CHANNELS = ["SMS", "EMAIL", "WHATSAPP"] as const;

export type SendChannel = (typeof SEND_CHANNELS)[number];

export type PlannedDelivery = {
  recipientRowId: string;
  rowNumber: number;
  customerName: string;
  mobile: string;
  email: string;
  loanNumber: string;
  customerId: string;
  channel: SendChannel;
  status: "PENDING" | "SKIPPED";
  detail: string;
  messageText: string;
  noticeNumber: string;
};

type PlanRow = NoticeRecipient & {
  id: string;
  rowNumber: number;
};

export function planDeliveries(
  rows: PlanRow[],
  channels: SendChannel[],
  bankName: string,
  templateBody: string,
  noticeNumbers?: ReadonlyMap<string, string>,
): PlannedDelivery[] {
  const planned: PlannedDelivery[] = [];

  for (const row of rows) {
    const noticeNumber = noticeNumbers?.get(row.id) ?? "";
    const values = valuesForRecipient(row, bankName);
    if (noticeNumber) {
      values.notice_number = noticeNumber;
      values.notice_link = noticePublicUrl(noticeNumber);
    }
    const filled = noticePlainText(fillNotice(templateBody, values));
    const mobile = values.mobile ?? "";
    const email = values.email?.trim() ?? "";

    for (const channel of channels) {
      const missing = channel === "EMAIL" ? !email : !mobile;
      planned.push({
        recipientRowId: row.id,
        rowNumber: row.rowNumber,
        customerName: row.customerName,
        mobile,
        email,
        loanNumber: row.loanNumber,
        customerId: row.customerId,
        channel,
        status: missing ? "SKIPPED" : "PENDING",
        detail: missing
          ? channel === "EMAIL"
            ? "No email on this row."
            : "No mobile number on this row."
          : "",
        messageText: missing ? "" : messageForChannel(channel, filled, row.customerName, bankName, noticeNumber),
        noticeNumber,
      });
    }
  }

  return planned;
}

function messageForChannel(
  channel: SendChannel,
  filled: string,
  customerName: string,
  bankName: string,
  noticeNumber: string,
): string {
  if (channel === "SMS" && noticeNumber) {
    return smsNoticeText({ customerName, bankName, noticeNumber });
  }
  return withNoticeLink(filled, noticeNumber);
}

export function isSendChannel(value: string): value is SendChannel {
  return (SEND_CHANNELS as readonly string[]).includes(value);
}

export function parseSendChannels(raw: string | null | undefined): SendChannel[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return SEND_CHANNELS.filter((channel) => parsed.includes(channel));
  } catch {
    return [];
  }
}
