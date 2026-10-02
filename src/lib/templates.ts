// Notice templates are stored per bank. Approved ones can be filled in. Drafts cannot.

export const TEMPLATE_DRAFT = "DRAFT";
export const TEMPLATE_APPROVED = "APPROVED";

export const TEMPLATE_CHANNELS = [
  { id: "SMS", label: "SMS" },
  { id: "EMAIL", label: "Email" },
  { id: "WHATSAPP", label: "WhatsApp" },
] as const;

export type TemplateChannel = (typeof TEMPLATE_CHANNELS)[number]["id"];
export type TemplateStatusValue = typeof TEMPLATE_DRAFT | typeof TEMPLATE_APPROVED;

const CHANNEL_IDS = new Set<string>(TEMPLATE_CHANNELS.map((channel) => channel.id));

export function templateStatusLabel(status: string): string {
  if (status === TEMPLATE_APPROVED) return "Approved";
  if (status === TEMPLATE_DRAFT) return "Draft";
  return "Draft";
}

export function parseChannels(raw: string | null | undefined): TemplateChannel[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is TemplateChannel => typeof item === "string" && CHANNEL_IDS.has(item));
  } catch {
    return [];
  }
}

export function channelsFromForm(formData: FormData): TemplateChannel[] {
  const picked = formData
    .getAll("channel")
    .map((value) => String(value).trim().toUpperCase())
    .filter((value): value is TemplateChannel => CHANNEL_IDS.has(value));
  return TEMPLATE_CHANNELS.map((channel) => channel.id).filter((id) => picked.includes(id));
}

export function channelLabels(channels: TemplateChannel[]): string {
  const labels = TEMPLATE_CHANNELS.filter((channel) => channels.includes(channel.id)).map(
    (channel) => channel.label,
  );
  return labels.join(", ");
}

export function statusFromForm(formData: FormData): TemplateStatusValue {
  return String(formData.get("status") ?? "") === TEMPLATE_APPROVED
    ? TEMPLATE_APPROVED
    : TEMPLATE_DRAFT;
}
