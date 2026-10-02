export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { describeRuntimeGates, logRuntimeGates } = await import("./lib/env");
  const { msg91AuthKey } = await import("./lib/msg91");
  const { isWebhookConfigured } = await import("./lib/msg91-webhook");
  logRuntimeGates(
    describeRuntimeGates({
      authKeySet: Boolean(msg91AuthKey()),
      webhookConfigured: isWebhookConfigured(),
    }),
  );
}
