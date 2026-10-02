// Short operational logs. Never pass passwords, MSG91 keys, entry codes, or notice text.

const SECRET_KEY = /key|secret|password|token|auth|cookie|entry/i;

export function logDesk(
  event: string,
  fields: Record<string, string | number | boolean | null | undefined> = {},
): void {
  const safe: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    if (SECRET_KEY.test(key)) continue;
    safe[key] = value;
  }
  console.info(
    JSON.stringify({
      app: "notice-desk",
      event,
      ...safe,
      at: new Date().toISOString(),
    }),
  );
}
