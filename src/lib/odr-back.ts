// Where the ODR Back link goes. A page address only. It does not change a case.

export type OdrBackTarget =
  | { kind: "link"; href: string; label: string }
  | { kind: "history"; label: string; fallbackHref: string };

const TRACKING_FALLBACK = "/deliveries?view=odr";

export function backToDesk(): OdrBackTarget {
  return { kind: "link", href: "/dashboard", label: "Back" };
}

export function backToOdr(): OdrBackTarget {
  return { kind: "link", href: "/odr", label: "Back to ODR" };
}

export function backToCases(): OdrBackTarget {
  return { kind: "link", href: "/odr/cases", label: "Back to cases" };
}

export function backToCase(caseId: string): OdrBackTarget {
  return { kind: "link", href: `/odr/cases/${caseId}`, label: "Back to case" };
}

export function odrListBack(bankUser: boolean): OdrBackTarget {
  if (bankUser) return { kind: "history", label: "Back", fallbackHref: TRACKING_FALLBACK };
  return backToOdr();
}

export function safeStaffReturn(raw: string | undefined): string {
  const value = (raw ?? "").trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("://")) return "";
  let url: URL;
  try {
    url = new URL(value, "https://notice.desk");
  } catch {
    return "";
  }
  if (url.origin !== "https://notice.desk") return "";
  if (url.pathname !== "/deliveries" && url.pathname !== "/reports") return "";
  return `${url.pathname}${url.search}`;
}

export function odrCaseBack(input: { bankUser: boolean; from?: string }): OdrBackTarget {
  if (!input.bankUser) return backToCases();
  const back = safeStaffReturn(input.from);
  if (!back) return { kind: "history", label: "Back", fallbackHref: TRACKING_FALLBACK };
  return {
    kind: "link",
    href: back,
    label: back.startsWith("/reports") ? "Back to reports" : "Back to tracking",
  };
}
