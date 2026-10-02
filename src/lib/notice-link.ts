// The public address of one notice.
// Live SMS uses DLT template Legal_Notice_12092026. Its variables are
// customer_name, bank_name, and notice_number. The registered link is
// www.notice.beingvakil.com/?notice=##notice_number##.
// This app serves that same query. NOTICE_PUBLIC_BASE_URL picks the host.

export const DLT_SMS_TEMPLATE_NAME = "Legal_Notice_12092026";

const PRODUCTION_BASE = "https://www.notice.beingvakil.com";
const LOCAL_BASE = "http://localhost:4317";

export type SmsNoticeVars = {
  customer_name: string;
  bank_name: string;
  notice_number: string;
};

export function noticePublicBaseUrl(): string {
  const configured = (process.env.NOTICE_PUBLIC_BASE_URL ?? "").trim().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(configured)) return configured;
  if (process.env.NODE_ENV === "production") return PRODUCTION_BASE;
  return LOCAL_BASE;
}

export function noticePageHref(noticeNumber: string): string {
  return `/?notice=${encodeURIComponent(noticeNumber)}`;
}

export function noticePublicUrl(noticeNumber: string): string {
  return `${noticePublicBaseUrl()}${noticePageHref(noticeNumber)}`;
}

export function smsNoticeVars(input: {
  customerName: string;
  bankName: string;
  noticeNumber: string;
}): SmsNoticeVars {
  return {
    customer_name: input.customerName.trim(),
    bank_name: input.bankName.trim(),
    notice_number: input.noticeNumber.trim(),
  };
}

export function smsNoticeText(input: {
  customerName: string;
  bankName: string;
  noticeNumber: string;
}): string {
  const vars = smsNoticeVars(input);
  const url = noticePublicUrl(vars.notice_number);
  return `Dear ${vars.customer_name}, ${vars.bank_name} has issued a legal notice. Notice no. ${vars.notice_number}. View: ${url}`;
}

export function withNoticeLink(body: string, noticeNumber: string): string {
  const number = noticeNumber.trim();
  if (!number) return body;
  const url = noticePublicUrl(number);
  if (body.includes(url)) return body;
  return `${body}\n\nRead the notice: ${url}`;
}
