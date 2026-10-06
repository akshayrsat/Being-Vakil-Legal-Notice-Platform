// Where a Back link goes. It is only a page address. It does not change the bank or delete saved work.

function safeId(value: string | null | undefined): string {
  const id = (value ?? "").trim();
  if (!/^[A-Za-z0-9_-]+$/.test(id)) return "";
  return id;
}

export type BackTarget = { href: string; label: string };

export function backToTemplates(): BackTarget {
  return { href: "/templates", label: "Back to templates" };
}

export function backToOdrTemplates(): BackTarget {
  return { href: "/odr/templates", label: "Back to ODR templates" };
}

export function backToSendNotice(): BackTarget {
  return { href: "/send", label: "Back to send notice" };
}

export function backToUploads(): BackTarget {
  return backToSendNotice();
}

export function backToCampaigns(): BackTarget {
  return backToSendNotice();
}

export function backToSpreadsheet(batchId: string): BackTarget {
  return { href: `/uploads/${safeId(batchId)}`, label: "Back to spreadsheet" };
}

export function prepareSendBack(batchId: string | null | undefined): BackTarget[] {
  const id = safeId(batchId);
  if (!id) return [backToCampaigns()];
  return [backToSpreadsheet(id), backToCampaigns()];
}

export function backToSend(campaignId: string, bankId: string): BackTarget {
  const id = safeId(campaignId);
  const bank = safeId(bankId);
  const href = bank ? `/campaigns/${id}?bank=${encodeURIComponent(bank)}` : `/campaigns/${id}`;
  return { href, label: "Back to this send" };
}

export function backToSpeedPost(bankId: string): BackTarget {
  const bank = safeId(bankId);
  return {
    href: bank ? `/speed-post?bank=${encodeURIComponent(bank)}` : "/speed-post",
    label: "Back to Speed Post",
  };
}

export function backToSearch(bankId: string): BackTarget {
  const bank = safeId(bankId);
  return {
    href: bank ? `/deliveries?bank=${encodeURIComponent(bank)}` : "/deliveries",
    label: "Back to search",
  };
}
