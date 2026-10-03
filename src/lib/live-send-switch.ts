// The on/off choice for live send, without reading the database.
// A saved choice overrides MSG91_LIVE_SEND. No saved choice starts on.

import { isOwner } from "./roles";

export const LIVE_SEND_SETTING_ID = "live-send";

export function canFlipLiveSend(role: string): boolean {
  return isOwner(role);
}

// Missing means nobody has saved a choice yet. Production sending is on,
// so the switch starts on. An env value baked at build time cannot turn it off.
export function effectiveLiveSend(stored: boolean | null | undefined): boolean {
  if (stored === true || stored === false) return stored;
  return true;
}

// Off never sends. On sends only when this notice was prepared as live and MSG91 has a key.
export function confirmSendsForReal(input: {
  switchOn: boolean;
  preparedLive: boolean;
  authKeySet: boolean;
}): boolean {
  return input.switchOn && input.preparedLive && input.authKeySet;
}
