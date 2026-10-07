// A system email, such as a password reset. This is not a notice and not an ODR message.
// It uses the MSG91 email HTTP API when from, domain, the auth key, and a reset template are set.
// It does not read ODR settings or the notice sending switch.
// If those values are missing, the caller still shows a neutral message and asks the person
// to contact an admin for a temporary password.

const EMAIL_SEND_URL = "https://control.msg91.com/api/v5/email/send";

export type MailEnv = {
  MSG91_AUTH_KEY?: string;
  MSG91_EMAIL_FROM?: string;
  MSG91_EMAIL_DOMAIN?: string;
  MSG91_PASSWORD_RESET_TEMPLATE_ID?: string;
  [key: string]: string | undefined;
};

export function passwordResetMailReady(env: MailEnv = process.env): boolean {
  return Boolean(
    env.MSG91_AUTH_KEY?.trim() &&
      env.MSG91_EMAIL_FROM?.trim() &&
      env.MSG91_EMAIL_DOMAIN?.trim() &&
      env.MSG91_PASSWORD_RESET_TEMPLATE_ID?.trim(),
  );
}

export function passwordResetPayload(input: {
  to: string;
  name: string;
  link: string;
  from: string;
  domain: string;
  templateId: string;
}): Record<string, unknown> {
  return {
    recipients: [
      {
        to: [{ email: input.to, name: input.name }],
        variables: {
          name: input.name,
          reset_link: input.link,
        },
      },
    ],
    from: { email: input.from, name: "Being Vakil Associates" },
    domain: input.domain,
    template_id: input.templateId,
  };
}

export async function sendPasswordResetEmail(
  input: { to: string; name: string; link: string },
  deps?: { fetchImpl?: typeof fetch; env?: MailEnv },
): Promise<{ ok: true } | { ok: false; reason: "unconfigured" | "rejected" }> {
  const env = deps?.env ?? process.env;
  const authKey = env.MSG91_AUTH_KEY?.trim() ?? "";
  const from = env.MSG91_EMAIL_FROM?.trim() ?? "";
  const domain = env.MSG91_EMAIL_DOMAIN?.trim() ?? "";
  const templateId = env.MSG91_PASSWORD_RESET_TEMPLATE_ID?.trim() ?? "";
  if (!authKey || !from || !domain || !templateId) return { ok: false, reason: "unconfigured" };

  const fetchImpl = deps?.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(EMAIL_SEND_URL, {
      method: "POST",
      headers: {
        authkey: authKey,
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(passwordResetPayload({ ...input, from, domain, templateId })),
      signal: AbortSignal.timeout(15000),
    });
    const payload = (await response.json().catch(() => null)) as { type?: string } | null;
    if (!response.ok || payload?.type === "error") return { ok: false, reason: "rejected" };
    return { ok: true };
  } catch {
    return { ok: false, reason: "rejected" };
  }
}
