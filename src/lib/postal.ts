// Speed Post / India Post tracking.
// Live API credentials are optional. Without them, staff update status by hand or CSV.
// Do not invent an India Post key. The HTTP provider runs only when both env vars are set.

export const POSTAL_STATUSES = [
  "BOOKED",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "RETURNED",
] as const;

export type PostalStatus = (typeof POSTAL_STATUSES)[number];

export const POSTAL_STATUS_OPTIONS: Array<{ id: PostalStatus; label: string }> = [
  { id: "BOOKED", label: "Booked" },
  { id: "IN_TRANSIT", label: "In transit" },
  { id: "OUT_FOR_DELIVERY", label: "Out for delivery" },
  { id: "DELIVERED", label: "Delivered" },
  { id: "RETURNED", label: "Returned" },
];

export type PostalTrackEvent = {
  status: PostalStatus;
  note: string;
  occurredAt: Date;
};

export type PostalTrackSnapshot = {
  articleNumber: string;
  status: PostalStatus;
  events: PostalTrackEvent[];
};

export type PostalTrackResult =
  | { ok: true; snapshot: PostalTrackSnapshot }
  | { ok: false; error: string };

export interface PostalTrackingProvider {
  readonly id: "manual" | "india-post";
  readonly label: string;
  isConfigured(): boolean;
  track(articleNumber: string): Promise<PostalTrackResult>;
}

export function isPostalStatus(value: string): value is PostalStatus {
  return (POSTAL_STATUSES as readonly string[]).includes(value);
}

export function postalStatusLabel(status: string): string {
  return POSTAL_STATUS_OPTIONS.find((item) => item.id === status)?.label ?? status;
}

export function normalizeArticleNumber(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export function articleNumberError(raw: string): string {
  const article = normalizeArticleNumber(raw);
  if (!article) return "Enter the Speed Post article number.";
  if (!/^[A-Z0-9]{8,20}$/.test(article)) {
    return "An article number is 8 to 20 letters or numbers, such as EK123456789IN.";
  }
  return "";
}

const STATUS_ALIASES: Record<string, PostalStatus> = {
  BOOKED: "BOOKED",
  BOOKING: "BOOKED",
  BOOK: "BOOKED",
  ACCEPTED: "BOOKED",
  IN_TRANSIT: "IN_TRANSIT",
  INTRANSIT: "IN_TRANSIT",
  TRANSIT: "IN_TRANSIT",
  "IN TRANSIT": "IN_TRANSIT",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  OUTFORDELIVERY: "OUT_FOR_DELIVERY",
  OFD: "OUT_FOR_DELIVERY",
  "OUT FOR DELIVERY": "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
  DELIVERY: "DELIVERED",
  RETURNED: "RETURNED",
  RETURN: "RETURNED",
  RTO: "RETURNED",
};

export function parsePostalStatus(raw: string): PostalStatus | null {
  const key = raw.trim().toUpperCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (!key) return null;
  const compact = key.replace(/ /g, "_");
  return STATUS_ALIASES[key] ?? STATUS_ALIASES[compact] ?? (isPostalStatus(compact) ? compact : null);
}

export function parsePostalInstant(raw: string): Date | null {
  const text = raw.trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const date = new Date(`${text}T00:00:00.000+05:30`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

class ManualPostalProvider implements PostalTrackingProvider {
  readonly id = "manual" as const;
  readonly label = "Manual and CSV";

  isConfigured(): boolean {
    return true;
  }

  async track(): Promise<PostalTrackResult> {
    return {
      ok: false,
      error: "No live India Post API is configured. Update the status here, or import a CSV.",
    };
  }
}

/**
 * Optional adapter. It calls the bank's own tracking endpoint only when
 * INDIA_POST_API_BASE_URL and INDIA_POST_API_KEY are both set.
 * Expected JSON:
 * { "status": "IN_TRANSIT", "events": [{ "status": "BOOKED", "note": "", "occurredAt": "2026-10-01T10:00:00.000Z" }] }
 * A response that does not match is rejected. The consignment is left unchanged.
 */
class IndiaPostHttpProvider implements PostalTrackingProvider {
  readonly id = "india-post" as const;
  readonly label = "India Post API";

  isConfigured(): boolean {
    return Boolean(indiaPostBaseUrl() && indiaPostApiKey());
  }

  async track(articleNumber: string): Promise<PostalTrackResult> {
    const article = normalizeArticleNumber(articleNumber);
    const problem = articleNumberError(article);
    if (problem) return { ok: false, error: problem };
    const base = indiaPostBaseUrl();
    const key = indiaPostApiKey();
    if (!base || !key) {
      return { ok: false, error: "India Post API is not configured." };
    }

    const url = new URL(`track/${encodeURIComponent(article)}`, base.endsWith("/") ? base : `${base}/`);
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          accept: "application/json",
          authorization: `Bearer ${key}`,
        },
        signal: AbortSignal.timeout(15000),
      });
      const payload = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) {
        return { ok: false, error: "India Post did not return a tracking update." };
      }
      const snapshot = snapshotFromPayload(article, payload);
      if (!snapshot) {
        return { ok: false, error: "India Post returned a tracking file this desk does not recognise." };
      }
      return { ok: true, snapshot };
    } catch {
      return { ok: false, error: "India Post could not be reached. The saved status was left as it is." };
    }
  }
}

export function indiaPostConfigured(): boolean {
  return Boolean(indiaPostBaseUrl() && indiaPostApiKey());
}

export function activePostalProvider(): PostalTrackingProvider {
  const remote = new IndiaPostHttpProvider();
  if (remote.isConfigured()) return remote;
  return new ManualPostalProvider();
}

function indiaPostBaseUrl(): string {
  return (process.env["INDIA_POST_API_BASE_URL"] ?? "").trim();
}

function indiaPostApiKey(): string {
  return (process.env["INDIA_POST_API_KEY"] ?? "").trim();
}

function snapshotFromPayload(articleNumber: string, payload: unknown): PostalTrackSnapshot | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const status = parsePostalStatus(typeof record.status === "string" ? record.status : "");
  if (!status) return null;
  const events: PostalTrackEvent[] = [];
  if (Array.isArray(record.events)) {
    for (const item of record.events) {
      if (!item || typeof item !== "object") continue;
      const event = item as Record<string, unknown>;
      const eventStatus = parsePostalStatus(typeof event.status === "string" ? event.status : "");
      if (!eventStatus) continue;
      const occurredAt = parsePostalInstant(typeof event.occurredAt === "string" ? event.occurredAt : "");
      events.push({
        status: eventStatus,
        note: typeof event.note === "string" ? event.note.trim().slice(0, 300) : "",
        occurredAt: occurredAt ?? new Date(),
      });
    }
  }
  if (events.length === 0) {
    events.push({ status, note: "", occurredAt: new Date() });
  }
  return { articleNumber, status, events };
}
