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

export function odrLiveWarning(input: { storedOn: boolean; envOn: boolean }): string {
  if (input.storedOn && input.envOn) {
    return "ODR sending is on. Confirming a hearing sends SMS, email, and WhatsApp where a template is set.";
  }
  if (input.storedOn && !input.envOn) {
    return "The ODR switch is on, but ODR_LIVE_SEND is not true, so messages are recorded as not sent (ODR sending off).";
  }
  return "ODR sending is off. Hearings are recorded, and messages are marked not sent (ODR sending off). Notice sending is unchanged.";
}
