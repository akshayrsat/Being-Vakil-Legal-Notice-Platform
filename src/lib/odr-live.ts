// The ODR send switch. It is separate from notice live send.
// Real ODR SMS, email, and WhatsApp go out only when both are true:
// the owner has saved this switch on, and ODR_LIVE_SEND is exactly true.
// A missing row stays off. MSG91_LIVE_SEND is not read here.

export const ODR_LIVE_SEND_SETTING_ID = "odr-live-send";
export const ODR_NOT_SENT_DETAIL = "not sent (ODR sending off)";

export function odrEnvLive(value: string | undefined = process.env.ODR_LIVE_SEND): boolean {
  return (value ?? "").trim() === "true";
}

export function effectiveOdrLiveSend(
  stored: boolean | null | undefined,
  envValue: string | undefined = process.env.ODR_LIVE_SEND,
): boolean {
  return stored === true && odrEnvLive(envValue);
}

export const ODR_SERVER_DISABLED_NOTE = "ODR sending is disabled on the server";

export function odrServerDisabledNote(envOn: boolean): string {
  return envOn ? "" : ODR_SERVER_DISABLED_NOTE;
}

export function odrMessagesWarning(input: { switchOn: boolean; envOn: boolean; technical?: boolean }): string {
  const technical = input.technical !== false;
  if (!input.switchOn) {
    return technical
      ? "Confirming records a dry run. Nothing is sent."
      : "Confirming records the message. Nothing is sent.";
  }
  if (!input.envOn) {
    return technical
      ? "ODR messages are turned on, but the server has sending disabled, so a confirm cannot send."
      : "ODR messages are turned on, but sending is not ready yet, so a confirm cannot send.";
  }
  return technical
    ? "Confirming sends the ODR message for real. Messages go out."
    : "Confirming sends the ODR message for real by SMS, email, or WhatsApp.";
}

export function odrLiveWarning(input: { storedOn: boolean; envOn: boolean }): string {
  if (input.storedOn && input.envOn) {
    return "ODR sending is on. Confirming a hearing sends SMS, email, and WhatsApp where a template is set.";
  }
  if (input.storedOn && !input.envOn) {
    return "The ODR switch is on, but ODR_LIVE_SEND is not true, so messages are recorded as not sent (ODR sending off).";
  }
  return "ODR sending is off. Hearings are recorded, and messages are marked not sent (ODR sending off). Notice sending is unchanged.";
}
