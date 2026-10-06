// Hands one ODR message to MSG91. Notice sending is not used here.
// If ODR sending is off, this returns before any network call.

import { ODR_NOT_SENT_DETAIL } from "./odr-live";
import { smsSender, unconfiguredDetail, whatsAppFrom, ODR_WHATSAPP_LANGUAGE } from "./odr-templates";
import { msg91AuthKey } from "./msg91";
import type { OdrChannel } from "./odr-plan";

const SMS_FLOW_URL = "https://control.msg91.com/api/v5/flow/";
const EMAIL_SEND_URL = "https://control.msg91.com/api/v5/email/send";
const WHATSAPP_SEND_URL = "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/";

export type OdrDeliveryInput = {
  live: boolean;
  channel: OdrChannel;
  to: string;
  templateId: string;
  vars: {
    customer: string;
    bank: string;
    number: string;
    date: string;
    time: string;
    link: string;
    caseLink: string;
  };
};

export type OdrDeliveryResult =
  | { ok: true; providerId: string; detail: string }
  | { ok: false; skipped: boolean; detail: string };

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export async function deliverOdrChannel(
  input: OdrDeliveryInput,
  deps?: { fetchImpl?: FetchLike; env?: Record<string, string | undefined> },
): Promise<OdrDeliveryResult> {
  if (!input.templateId.trim()) {
    return { ok: false, skipped: true, detail: unconfiguredDetail(input.channel) };
  }
  if (!input.live) {
    return { ok: false, skipped: true, detail: ODR_NOT_SENT_DETAIL };
  }
  const env = deps?.env ?? process.env;
  const authKey = (env.MSG91_AUTH_KEY ?? "").trim() || msg91AuthKey();
  if (!authKey) {
    return { ok: false, skipped: false, detail: "ODR sending is on, but the message service is not set up. Nothing was sent." };
  }
  const fetchImpl = deps?.fetchImpl ?? fetch;
  if (input.channel === "SMS") return deliverSms(input, authKey, smsSender(env), fetchImpl);
  if (input.channel === "EMAIL") return deliverEmail(input, authKey, env, fetchImpl);
  return deliverWhatsApp(input, authKey, whatsAppFrom(env), env, fetchImpl);
}

async function deliverSms(
  input: OdrDeliveryInput,
  authKey: string,
  sender: string,
  fetchImpl: FetchLike,
): Promise<OdrDeliveryResult> {
  const result = await postJson(
    fetchImpl,
    SMS_FLOW_URL,
    authKey,
    {
      flow_id: input.templateId,
      sender,
      recipients: [
        {
          mobiles: input.to,
          customer: input.vars.customer,
          bank: input.vars.bank,
          number: input.vars.number,
          date: input.vars.date,
          time: input.vars.time,
          link: input.vars.link,
          case_link: input.vars.caseLink,
        },
      ],
    },
    "The SMS was not accepted.",
  );
  return result.ok ? { ok: true, providerId: result.providerId, detail: "Sent." } : { ok: false, skipped: false, detail: result.detail };
}

async function deliverEmail(
  input: OdrDeliveryInput,
  authKey: string,
  env: Record<string, string | undefined>,
  fetchImpl: FetchLike,
): Promise<OdrDeliveryResult> {
  const from = (env.MSG91_EMAIL_FROM ?? "").trim();
  const domain = (env.MSG91_EMAIL_DOMAIN ?? "").trim();
  if (!from || !domain) {
    return { ok: false, skipped: false, detail: "Email sender is not set up. Nothing was sent." };
  }
  const result = await postJson(
    fetchImpl,
    EMAIL_SEND_URL,
    authKey,
    {
      recipients: [
        {
          to: [{ email: input.to, name: input.vars.customer }],
          variables: {
            customer: input.vars.customer,
            bank: input.vars.bank,
            number: input.vars.number,
            date: input.vars.date,
            time: input.vars.time,
            link: input.vars.link,
            case: input.vars.caseLink,
          },
        },
      ],
      from: { email: from, name: "Being Vakil Associates" },
      domain,
      template_id: input.templateId,
    },
    "The email was not accepted.",
  );
  return result.ok ? { ok: true, providerId: result.providerId, detail: "Sent." } : { ok: false, skipped: false, detail: result.detail };
}

async function deliverWhatsApp(
  input: OdrDeliveryInput,
  authKey: string,
  from: string,
  env: Record<string, string | undefined>,
  fetchImpl: FetchLike,
): Promise<OdrDeliveryResult> {
  const namespace = (env.ODR_WHATSAPP_NAMESPACE ?? "").trim();
  const values = [
    input.vars.customer,
    input.vars.bank,
    input.vars.bank,
    input.vars.customer,
    input.vars.number,
    input.vars.date,
    input.vars.time,
    input.vars.link,
  ];
  const components: Record<string, { type: "text"; value: string }> = {};
  values.forEach((value, index) => {
    components[`body_${index + 1}`] = { type: "text", value };
  });
  const template: Record<string, unknown> = {
    name: input.templateId,
    language: { code: ODR_WHATSAPP_LANGUAGE, policy: "deterministic" },
    to_and_components: [{ to: [input.to], components }],
  };
  if (namespace) template.namespace = namespace;
  const result = await postJson(
    fetchImpl,
    WHATSAPP_SEND_URL,
    authKey,
    {
      integrated_number: from,
      content_type: "template",
      payload: {
        messaging_product: "whatsapp",
        type: "template",
        template,
      },
    },
    "The WhatsApp message was not accepted.",
  );
  return result.ok ? { ok: true, providerId: result.providerId, detail: "Sent." } : { ok: false, skipped: false, detail: result.detail };
}

async function postJson(
  fetchImpl: FetchLike,
  url: string,
  authKey: string,
  body: unknown,
  failure: string,
): Promise<{ ok: true; providerId: string } | { ok: false; detail: string }> {
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        authkey: authKey,
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const payload = (await response.json().catch(() => null)) as { type?: string; request_id?: string; message?: unknown } | null;
    if (!response.ok || payload?.type === "error") {
      return { ok: false, detail: failure };
    }
    const providerId = typeof payload?.request_id === "string" ? payload.request_id.slice(0, 120) : "";
    return { ok: true, providerId };
  } catch {
    return { ok: false, detail: "The message service could not be reached. Nothing was sent." };
  }
}
