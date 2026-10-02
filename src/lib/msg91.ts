// MSG91 access. The auth key is read from the environment on the server.
// Never put it in a NEXT_PUBLIC_ variable, and never send it to the browser.

import type { SmsNoticeVars } from "./notice-link";
import { toMsg91Mobile } from "./phone";

const OTP_SEND_URL = "https://control.msg91.com/api/v5/otp";
const OTP_VERIFY_URL = "https://control.msg91.com/api/v5/otp/verify";
const SMS_FLOW_URL = "https://control.msg91.com/api/v5/flow/";
const EMAIL_SEND_URL = "https://control.msg91.com/api/v5/email/send";
const WHATSAPP_SEND_URL = "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/";

export type SendChannel = "SMS" | "EMAIL" | "WHATSAPP";

export type DeliveryRequest = {
  channel: SendChannel;
  to: string;
  body: string;
  dltTemplateId: string;
  sms?: SmsNoticeVars;
};

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

// A key by itself does not send notices. Live send also needs MSG91_LIVE_SEND=true.
export function isLiveSendEnabled(): boolean {
  return Boolean(msg91AuthKey() && envValue("MSG91_LIVE_SEND") === "true");
}

export function dryRunReason(): string {
  if (!msg91AuthKey()) {
    return "MSG91 is not set up on this computer, so this is a dry run. No message will be sent.";
  }
  if (!isLiveSendEnabled()) {
    return "An MSG91 key is set, but live send is turned off. This is a dry run. No message will be sent.";
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
export async function deliverNotice(request: DeliveryRequest): Promise<DeliveryResult> {
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
      error: "TODO: set MSG91_SMS_FLOW_ID and MSG91_SENDER_ID before a live SMS. Nothing was sent.",
    };
  }

  // Legal_Notice_12092026 reads customer_name, bank_name, and notice_number.
  // message is the same wording kept for a flow that still expects one body variable.
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

async function deliverEmail(authKey: string, request: DeliveryRequest): Promise<DeliveryResult> {
  const from = envValue("MSG91_EMAIL_FROM");
  const domain = envValue("MSG91_EMAIL_DOMAIN");
  const templateId = envValue("MSG91_EMAIL_TEMPLATE_ID");
  if (!from || !domain || !templateId) {
    // TODO: MSG91 email will not send a free-form body. It needs a verified domain
    // and a template whose variables match this payload. Do not call the API until those exist.
    return {
      ok: false,
      error: "TODO: set MSG91_EMAIL_FROM, MSG91_EMAIL_DOMAIN, and MSG91_EMAIL_TEMPLATE_ID. Nothing was sent.",
    };
  }

  const result = await postMsg91(
    EMAIL_SEND_URL,
    authKey,
    {
      recipients: [
        {
          to: [{ email: request.to, name: request.to }],
          variables: { message: request.body },
        },
      ],
      from: { email: from, name: "Notice Desk" },
      domain,
      template_id: templateId,
    },
    "MSG91 did not accept the email.",
  );
  return result.ok ? { ok: true, providerId: result.providerId } : result;
}

async function deliverWhatsApp(authKey: string, request: DeliveryRequest): Promise<DeliveryResult> {
  const integratedNumber = envValue("MSG91_WHATSAPP_INTEGRATED_NUMBER");
  const templateName = envValue("MSG91_WHATSAPP_TEMPLATE");
  const mobile = toMsg91Mobile(request.to);
  if (!integratedNumber || !templateName || !mobile) {
    // TODO: WhatsApp needs an integrated number and a template approved in MSG91.
    // The template must have one body variable for the notice text. Nothing is sent until those are set.
    return {
      ok: false,
      error:
        "TODO: set MSG91_WHATSAPP_INTEGRATED_NUMBER and MSG91_WHATSAPP_TEMPLATE. Nothing was sent.",
    };
  }

  const result = await postMsg91(
    WHATSAPP_SEND_URL,
    authKey,
    {
      integrated_number: integratedNumber,
      content_type: "template",
      payload: {
        messaging_product: "whatsapp",
        type: "template",
        template: {
          name: templateName,
          language: { code: "en", policy: "deterministic" },
          to_and_components: [
            {
              to: [mobile],
              components: {
                body_1: { type: "text", value: request.body },
              },
            },
          ],
        },
      },
    },
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
    const payload = (await response.json().catch(() => null)) as { type?: string } | null;
    if (!response.ok || payload?.type === "error") {
      return { ok: false, error: failure };
    }
    return { ok: true, providerId: readProviderId(payload) };
  } catch {
    return { ok: false, error: "MSG91 could not be reached. Nothing was sent." };
  }
}
