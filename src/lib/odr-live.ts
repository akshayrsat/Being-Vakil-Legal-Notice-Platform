// The ODR send switch. It is separate from notice live send.
// SMS, email, and WhatsApp go out only when the owner has saved this switch on.
// ODR_LIVE_SEND is an emergency kill switch: the exact value "kill" blocks sending
// even when the switch is on. false, true, off, and an unset value do not block.
// A missing row stays off. MSG91_LIVE_SEND is not read here.

export const ODR_LIVE_SEND_SETTING_ID = "odr-live-send";
export const ODR_LIVE_KILL = "kill";
export const ODR_NOT_SENT_DETAIL = "not sent (ODR sending off)";
export const ODR_SERVER_BLOCKED_NOTE = "Sending is blocked by the server.";

export function odrKillSwitch(value: string | undefined = process.env.ODR_LIVE_SEND): boolean {
  return (value ?? "").trim().toLowerCase() === ODR_LIVE_KILL;
}

export function effectiveOdrLiveSend(
  stored: boolean | null | undefined,
  envValue: string | undefined = process.env.ODR_LIVE_SEND,
): boolean {
  if (odrKillSwitch(envValue)) return false;
  return stored === true;
}

export function odrServerBlockedNote(killed: boolean): string {
  return killed ? ODR_SERVER_BLOCKED_NOTE : "";
}

export function odrMessagesWarning(input: { switchOn: boolean; killed: boolean; technical?: boolean }): string {
  if (input.killed) {
    const how = input.technical ? " ODR_LIVE_SEND is set to kill." : "";
    return `Sending is blocked by the server.${how} Confirming records the message. Nothing is sent.`;
  }
  if (!input.switchOn) return "Off. Confirming records the message. Nothing is sent.";
  return "On. Confirming sends ODR messages by SMS, email, or WhatsApp, only on channels with an approved template.";
}

export function odrLiveWarning(input: { storedOn: boolean; killed: boolean }): string {
  if (input.killed) {
    return "Sending is blocked by the server. Hearings are recorded, and messages are marked not sent (ODR sending off). Notice sending is unchanged.";
  }
  if (input.storedOn) {
    return "ODR messages are on. Confirming sends by SMS, email, or WhatsApp, only on channels with an approved template. Notice sending is unchanged.";
  }
  return "ODR messages are off. Confirming records the message. Nothing is sent. Notice sending is unchanged.";
}
