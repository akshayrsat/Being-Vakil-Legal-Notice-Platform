// Safe reads of send gates. Values of keys and entry codes are never returned or logged.

import { entryCode, entryGateEnabled } from "./entry-gate";
import { indiaPostConfigured } from "./postal";

export type RuntimeGates = {
  liveSend: boolean;
  liveFlag: "unset" | "true" | "other";
  authKeySet: boolean;
  webhookConfigured: boolean;
  indiaPostConfigured: boolean;
  entryGate: boolean;
  entryCodeShort: boolean;
};

export function liveSendFlag(): "unset" | "true" | "other" {
  const raw = (process.env["MSG91_LIVE_SEND"] ?? "").trim();
  if (!raw) return "unset";
  return raw === "true" ? "true" : "other";
}

export function describeRuntimeGates(input: {
  authKeySet: boolean;
  webhookConfigured: boolean;
}): RuntimeGates {
  const code = entryCode();
  return {
    liveSend: input.authKeySet && liveSendFlag() === "true",
    liveFlag: liveSendFlag(),
    authKeySet: input.authKeySet,
    webhookConfigured: input.webhookConfigured,
    indiaPostConfigured: indiaPostConfigured(),
    entryGate: entryGateEnabled(),
    entryCodeShort: code.length > 0 && code.length < 8,
  };
}

export function logRuntimeGates(gates: RuntimeGates): void {
  const live =
    gates.liveSend
      ? "on"
      : gates.liveFlag === "other"
        ? "off because MSG91_LIVE_SEND is not the exact value true"
        : "off";
  console.info(
    JSON.stringify({
      app: "notice-desk",
      event: "runtime.gates",
      liveSend: live,
      authKeySet: gates.authKeySet,
      webhookConfigured: gates.webhookConfigured,
      indiaPostConfigured: gates.indiaPostConfigured,
      entryGate: gates.entryGate,
      entryCodeShort: gates.entryCodeShort,
      at: new Date().toISOString(),
    }),
  );
}
