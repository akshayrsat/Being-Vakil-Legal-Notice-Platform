// MSG91 access. The auth key is read from the environment on the server.
// Never put it in a NEXT_PUBLIC_ variable, and never send it to the browser.

import { liveSendIsOn } from "./live-send-store";
import type { EmailNoticeVars, SmsNoticeVars } from "./notice-link";
import { toMsg91Mobile } from "./phone";

export type { EmailNoticeVars } from "./notice-link";

const OTP_SEND_URL = "https://control.msg91.com/api/v5/otp";
const OTP_VERIFY_URL = "https://control.msg91.com/api/v5/otp/verify";
const SMS_FLOW_URL = "https://control.msg91.com/api/v5/flow/";
const EMAIL_SEND_URL = "https://control.msg91.com/api/v5/email/send";
const WHATSAPP_SEND_URL = "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/";

export type SendChannel = "SMS" | "EMAIL" | "WHATSAPP";

export type WhatsAppNoticeVars = {
  customer_name: string;
  bank_name: string;
  /** Path suffix for URL button, e.g. notice-UWAT73Y72777 (not the full URL). */
  notice_path: string;
};

// Approved MSG91 email template legal_notice_non_payment (id 64975).
// API template_id must be the slug, not the numeric id.
// Vars: contact_name, loan_account, notice_id (full URL for current template),
// notice_link (same URL), notice_code (bare id for a future template edit).
export const EMAIL_TEMPLATE_SLUG = "legal_notice_non_payment";

// Wording recorded for legal_notice_non_payment in MSG91_EMAIL.md.
// Subject, then the body. The notice code is the link text; notice_link is the URL.
// Live send also sets notice_id to that same URL.
export const EMAIL_TEMPLATE_BODY = [
  "Subject: Legal Notice Regarding Overdue Payment - Account {{loan_account}}",
  "",
  "Dear {{contact_name}},",
  "",
  "We have issued a legal notice due to non-repayment of dues on your loan account {{loan_account}}.",
  "",
  "Please find the attached notice: {{notice_code}}",
  "{{notice_link}}",
  "",
  "Or open: {{notice_link}}",
  "",
  "Please contact us at your earliest convenience to avoid further action.",
  "",
  "Regards,",
  "Team Being Vakil",
].join("\n");

export type EmailAttachment = {
  fileName: string;
  /** MSG91 data URI, data:application/pdf;base64,... */
  file: string;
};

export type DeliveryRequest = {
  channel: SendChannel;
  to: string;
  body: string;
  dltTemplateId: string;
  sms?: SmsNoticeVars;
  email?: EmailNoticeVars;
  whatsapp?: WhatsAppNoticeVars;
  attachments?: EmailAttachment[];
};

// Approved MSG91 WhatsApp template legal_notice_link (POSITIONAL):
// body_1 = customer name, body_2 = bank name, button_1 = notice path suffix for
// https://www.notice.beingvakil.in/{{1}} (e.g. notice-UWAT73Y72777).
// Old legal_notice had a static example.com URL button and no URL variable.
export const WHATSAPP_TEMPLATE_NAME = "legal_notice_link";

// legal_notice_link is positional: body_1 is the customer name, body_2 is the bank name,
// and the URL button is https://www.notice.beingvakil.in/{{1}} with {{1}} = notice-<id>.
// The repo has no other sentence for this template.
export const WHATSAPP_TEMPLATE_BODY = [
  "{{customer_name}}",
  "",
  "{{bank_name}}",
  "",
  "https://www.notice.beingvakil.in/notice-{{notice_number}}",
].join("\n");
export const WHATSAPP_LANGUAGE = "en_US";
export const WHATSAPP_TEMPLATE_NAMESPACE = "50ed4427_8a87_49c0_aad5_c2d3b8981e32";

export type DeliveryResult = { ok: true; providerId: string } | { ok: false; error: string };

function envValue(name: string): string {
  return (process.env[name] ?? "").trim();
}

export function msg91AuthKey(): string {
  return envValue("MSG91_AUTH_KEY");
}

export function isOtpEnabled(): boolean {
  return Boolean(msg91AuthKey() && envValue("MSG91_OTP_TEMPLATE_ID") && toMsg91Mobile(envValue("MSG91_OTP_MOBILE")));
}

// A key by itself does not send notices.
// The admin switch in Settings is the on/off control. It overrides MSG91_LIVE_SEND.
export async function isLiveSendEnabled(): Promise<boolean> {
  return (await liveSendIsOn()) && Boolean(msg91AuthKey());
}

export async function dryRunReason(): Promise<string> {
  if (!(await liveSendIsOn())) {
    return "Live send is off. Confirming records a dry run. Nothing is sent.";
  }
  if (!msg91AuthKey()) {
    return "Live send is on, but MSG91 is not set up, so nothing is sent.";
  }
  return "";
}

export async function sendLoginOtp(): Promise<{ ok: true } | { ok: false; error: string }> {
  const authKey = msg91AuthKey();
  const templateId = envValue("MSG91_OTP_TEMPLATE_ID");
  const mobile = toMsg91Mobile(envValue("MSG91_OTP_MOBILE"));
  if (!authKey || !templateId || !mobile) {
    return { ok: false, error: "MSG91 one-time code is not fully set up." };
  }

  const url = new URL(OTP_SEND_URL);
  url.searchParams.set("template_id", templateId);
  url.searchParams.set("mobile", mobile);
  url.searchParams.set("otp_expiry", "10");

  return postMsg91(url, authKey, undefined, "MSG91 did not send the one-time code. Check the template id and the mobile number.");
}

export async function verifyLoginOtp(otp: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const authKey = msg91AuthKey();
  const mobile = toMsg91Mobile(envValue("MSG91_OTP_MOBILE"));
  if (!authKey || !mobile) {
    return { ok: false, error: "MSG91 one-time code is not fully set up." };
  }

  const url = new URL(OTP_VERIFY_URL);
  url.searchParams.set("mobile", mobile);
  url.searchParams.set("otp", otp);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { authkey: authKey, accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    const payload = (await response.json().catch(() => null)) as { type?: string } | null;
    if (!response.ok || payload?.type === "error") {
      return { ok: false, error: "That code is not correct." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "The one-time code could not be checked. Try again in a moment." };
  }
}

// Called only when live send is switched on. A dry run must not call this.
// The flag is checked here as well as by the caller, so a missed check cannot send.
export async function deliverNotice(request: DeliveryRequest): Promise<DeliveryResult> {
  if (!(await liveSendIsOn())) {
    return { ok: false, error: "Live send is off. Nothing was sent." };
  }
  const authKey = msg91AuthKey();
  if (!authKey) {
    return { ok: false, error: "MSG91 is not set up, so nothing was sent." };
  }

  if (request.channel === "SMS") return deliverSms(authKey, request);
  if (request.channel === "EMAIL") return deliverEmail(authKey, request);
  return deliverWhatsApp(authKey, request);
}

async function deliverSms(authKey: string, request: DeliveryRequest): Promise<DeliveryResult> {
  const flowId = envValue("MSG91_SMS_FLOW_ID");
  const senderId = envValue("MSG91_SENDER_ID");
  const mobile = toMsg91Mobile(request.to);
  if (!flowId || !senderId || !mobile) {
    return {
      ok: false,
      error: "Set MSG91_SMS_FLOW_ID and MSG91_SENDER_ID before a live SMS. Nothing was sent.",
    };
  }

  // MSG91's flow API can return type=success for unknown string flow ids without sending.
  // Confirm the Template ID exists and has versions before calling flow.
  const flowCheck = await verifySmsFlowId(authKey, flowId);
  if (!flowCheck.ok) return flowCheck;

  // DLT Legal_Notice_12092026 reads customer_name, bank_name, and notice_number.
  // message is kept for a flow that still expects one body variable.
  const recipient: Record<string, string> = {
    mobiles: mobile,
    message: request.body,
  };
  if (request.sms) {
    recipient.customer_name = request.sms.customer_name;
    recipient.bank_name = request.sms.bank_name;
    recipient.notice_number = request.sms.notice_number;
  }
  const result = await postMsg91(
    SMS_FLOW_URL,
    authKey,
    {
      flow_id: flowId,
      sender: senderId,
      recipients: [recipient],
    },
    "MSG91 did not accept the SMS.",
  );
  return result.ok ? { ok: true, providerId: result.providerId } : result;
}

async function verifySmsFlowId(
  authKey: string,
  flowId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch("https://control.msg91.com/api/v5/sms/getTemplateVersions", {
      method: "POST",
      headers: {
        authkey: authKey,
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({ template_id: flowId }),
      signal: AbortSignal.timeout(15000),
    });
    const payload = (await response.json().catch(() => null)) as {
      status?: string;
      hasError?: boolean;
      errors?: unknown;
      data?: unknown;
    } | null;
    const errors = payload?.errors;
    const errorText = Array.isArray(errors)
      ? errors.map(String).join("; ")
      : typeof errors === "string"
        ? errors
        : "";
    if (!response.ok || payload?.hasError || payload?.status === "error") {
      return {
        ok: false,
        error:
          "MSG91 SMS flow/template id is invalid or unreadable" +
          (errorText ? ": " + errorText : ".") +
          " Copy the Template ID from MSG91 SMS > Templates. Nothing was sent.",
      };
    }
    if (!Array.isArray(payload?.data) || payload.data.length === 0) {
      return {
        ok: false,
        error:
          "MSG91 SMS flow/template id has no versions. Copy the Template ID from MSG91 SMS > Templates (sender BVAKIL / Legal_Notice_12092026). Nothing was sent.",
      };
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "MSG91 SMS template could not be checked. Nothing was sent.",
    };
  }
}

async function deliverEmail(authKey: string, request: DeliveryRequest): Promise<DeliveryResult> {
  const from = envValue("MSG91_EMAIL_FROM");
  const domain = envValue("MSG91_EMAIL_DOMAIN");
  const configured = envValue("MSG91_EMAIL_TEMPLATE_ID");
  // MSG91 email API expects the template slug (legal_notice_non_payment), not numeric id 64975.
  const templateId =
    !configured || configured === "64975" ? EMAIL_TEMPLATE_SLUG : configured;
  if (!from || !domain || !templateId) {
    return {
      ok: false,
      error: "Set MSG91_EMAIL_FROM, MSG91_EMAIL_DOMAIN, and MSG91_EMAIL_TEMPLATE_ID. Nothing was sent.",
    };
  }
  const contactName = request.email?.contact_name.trim() ?? "";
  const loanAccount = request.email?.loan_account.trim() ?? "";
  const noticeLink = (request.email?.notice_link ?? request.email?.notice_id ?? "").trim();
  const noticeCode = (request.email?.notice_code ?? "").trim();
  if (!contactName || !loanAccount || !noticeLink) {
    return {
      ok: false,
      error: "Email needs contact_name, loan_account, and notice_link. Nothing was sent.",
    };
  }

  // HTML letterhead body lives in email-notice.ts for previews/public pages.
  // Live MSG91 send uses the approved template variables only.
  // Unsubscribe footer and open tracking are domain settings in MSG91
  // (Email > Domain Settings > Domain Configuration). There is no send-API flag.
  // notice_id is the full HTTPS URL so the current template prints a clickable link.
  const payload: Record<string, unknown> = {
    recipients: [
      {
        to: [{ email: request.to, name: contactName }],
        variables: {
          contact_name: contactName,
          loan_account: loanAccount,
          notice_id: noticeLink,
          notice_link: noticeLink,
          notice_code: noticeCode || noticeLink,
        },
      },
    ],
    from: { email: from, name: "Being Vakil Associates" },
    domain,
    template_id: templateId,
  };
  // Optional. The template variables, including the clickable notice URL, stay as they are.
  if (request.attachments && request.attachments.length > 0) {
    payload.attachments = request.attachments.map((file) => ({
      fileName: file.fileName,
      file: file.file,
    }));
  }
  const result = await postMsg91(
    EMAIL_SEND_URL,
    authKey,
    payload,
    "MSG91 did not accept the email.",
  );
  return result.ok ? { ok: true, providerId: result.providerId } : result;
}

export function whatsappTemplatePayload(input: {
  integratedNumber: string;
  mobile: string;
  customerName: string;
  bankName: string;
  noticePath: string;
}) {
  return {
    integrated_number: input.integratedNumber,
    content_type: "template" as const,
    payload: {
      messaging_product: "whatsapp" as const,
      type: "template" as const,
      template: {
        name: WHATSAPP_TEMPLATE_NAME,
        language: { code: WHATSAPP_LANGUAGE, policy: "deterministic" as const },
        namespace: WHATSAPP_TEMPLATE_NAMESPACE,
        to_and_components: [
          {
            to: [input.mobile],
            // POSITIONAL vars from MSG91 get-template for legal_notice_link.
            // button_1 subtype url fills https://www.notice.beingvakil.in/{{1}}
            components: {
              body_1: { type: "text" as const, value: input.customerName },
              body_2: { type: "text" as const, value: input.bankName },
              button_1: { subtype: "url" as const, type: "text" as const, value: input.noticePath },
            },
          },
        ],
      },
    },
  };
}

async function deliverWhatsApp(authKey: string, request: DeliveryRequest): Promise<DeliveryResult> {
  const integratedNumber = envValue("MSG91_WHATSAPP_INTEGRATED_NUMBER");
  const mobile = toMsg91Mobile(request.to);
  const customerName = request.whatsapp?.customer_name.trim() ?? "";
  const bankName = request.whatsapp?.bank_name.trim() ?? "";
  const noticePath = request.whatsapp?.notice_path.trim() ?? "";
  if (!integratedNumber || !mobile) {
    return {
      ok: false,
      error: "Set MSG91_WHATSAPP_INTEGRATED_NUMBER before a live WhatsApp. Nothing was sent.",
    };
  }
  if (!customerName || !bankName || !noticePath) {
    return {
      ok: false,
      error: "WhatsApp needs the customer name, bank name, and notice path. Nothing was sent.",
    };
  }
  if (!/^notice-[A-Za-z0-9_-]+$/.test(noticePath)) {
    return {
      ok: false,
      error: "WhatsApp notice path must look like notice-<id>. Nothing was sent.",
    };
  }

  const result = await postMsg91(
    WHATSAPP_SEND_URL,
    authKey,
    whatsappTemplatePayload({
      integratedNumber,
      mobile,
      customerName,
      bankName,
      noticePath,
    }),
    "MSG91 did not accept the WhatsApp message.",
  );
  return result.ok ? { ok: true, providerId: result.providerId } : result;
}

function readProviderId(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const record = payload as Record<string, unknown>;
  for (const key of ["request_id", "requestId", "message_id"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim() && value.length <= 120) return value.trim();
  }
  return "";
}

async function postMsg91(
  url: string | URL,
  authKey: string,
  body: unknown,
  failure: string,
): Promise<{ ok: true; providerId: string } | { ok: false; error: string }> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        authkey: authKey,
        accept: "application/json",
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const payload = (await response.json().catch(() => null)) as {
      type?: string;
      message?: string | { message?: string };
    } | null;
    if (!response.ok || payload?.type === "error") {
      const detail =
        typeof payload?.message === "string"
          ? payload.message.trim()
          : typeof payload?.message === "object" &&
              payload?.message &&
              typeof payload.message.message === "string"
            ? payload.message.message.trim()
            : "";
      return { ok: false, error: detail ? failure + " " + detail : failure };
    }
    return { ok: true, providerId: readProviderId(payload) };
  } catch {
    return { ok: false, error: "MSG91 could not be reached. Nothing was sent." };
  }
}
