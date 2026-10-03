// The public address of one notice.
// SMS and email use https://www.notice.beingvakil.in/notice-<id>
// when NOTICE_PUBLIC_BASE_URL is that host.
// Live SMS still sends DLT template Legal_Notice_12092026 with
// customer_name, bank_name, and notice_number.

export const DLT_SMS_TEMPLATE_NAME = "Legal_Notice_12092026";

const PRODUCTION_BASE = "https://www.notice.beingvakil.in";
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
  return `/notice-${encodeURIComponent(noticeNumber)}`;
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

// Same sentence as smsNoticeText. The three flow variables stay where Legal_Notice_12092026 reads them.
export function smsApprovedTemplateBody(): string {
  return `Dear {{customer_name}}, {{bank_name}} has issued a legal notice. Notice no. {{notice_number}}. View: ${PRODUCTION_BASE}/notice-{{notice_number}}`;
}

export function withNoticeLink(body: string, noticeNumber: string): string {
  const number = noticeNumber.trim();
  if (!number) return body;
  const url = noticePublicUrl(number);
  if (body.includes(url)) return body;
  return `${body}\n\nRead the notice: ${url}`;
}

export type EmailNoticeVars = {
  contact_name: string;
  loan_account: string;
  // Full HTTPS URL so the current MSG91 template {{notice_id}} prints a clickable link.
  notice_id: string;
  notice_link: string;
  // Bare notice code for a future template that shows the code as link text.
  notice_code: string;
};

export function emailNoticeVars(input: {
  customerName: string;
  loanAccount: string;
  noticeNumber: string;
}): EmailNoticeVars {
  const notice_code = input.noticeNumber.trim();
  const notice_link = noticePublicUrl(notice_code);
  return {
    contact_name: input.customerName.trim(),
    loan_account: input.loanAccount.trim() || notice_code,
    notice_id: notice_link,
    notice_link,
    notice_code,
  };
}

export type WhatsAppNoticeLinkVars = {
  customer_name: string;
  bank_name: string;
  /** Suffix for MSG91 URL button https://www.notice.beingvakil.in/{{1}} */
  notice_path: string;
};

export function whatsappNoticePath(noticeNumber: string): string {
  const id = noticeNumber.trim();
  if (!id) return "";
  return `notice-${id}`;
}

export function whatsappNoticeVars(input: {
  customerName: string;
  bankName: string;
  noticeNumber: string;
}): WhatsAppNoticeLinkVars {
  return {
    customer_name: input.customerName.trim(),
    bank_name: input.bankName.trim(),
    notice_path: whatsappNoticePath(input.noticeNumber),
  };
}
