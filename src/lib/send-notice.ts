// One place to send a notice. Spreadsheet upload and the saved send stay in the database.
// The screen walks through them in order. Labels stay in plain English.

import { canChooseBank, canCreateLogins, isOwner } from "./roles";

export const SEND_NOTICE_HREF = "/send";
export const SEND_NOTICE_LABEL = "Send notice";
export const SETTINGS_HREF = "/settings";
export const SETTINGS_LABEL = "Settings";
export const PEOPLE_HREF = "/people";
export const PEOPLE_LABEL = "People";

export const SEND_STEPS = [
  {
    number: 1 as const,
    title: "Choose the spreadsheet of people",
    detail: "Use this bank’s Excel file. Match the columns if the file is new.",
  },
  {
    number: 2 as const,
    title: "Choose the approved notice wording",
    detail: "Approved wording is shared by the firm. Drafts are not listed.",
  },
  {
    number: 3 as const,
    title: "Review who will get it",
    detail: "Check the people on this bank’s spreadsheet before anything is sent.",
  },
  {
    number: 4 as const,
    title: "Send",
    detail: "Confirm only when the people look right.",
  },
] as const;

export type SendStepNumber = (typeof SEND_STEPS)[number]["number"];

export type NavLink = { href: string; label: string };

export function workspaceNav(role: string): NavLink[] {
  const links: NavLink[] = [
    { href: "/dashboard", label: "Home" },
    { href: SEND_NOTICE_HREF, label: SEND_NOTICE_LABEL },
    { href: "/templates", label: "Templates" },
    { href: "/deliveries", label: "Tracking" },
    { href: "/speed-post", label: "Speed Post" },
    { href: "/reports", label: "Reports" },
  ];
  if (canChooseBank(role)) links.push({ href: "/banks", label: "Banks" });
  if (canCreateLogins(role)) links.push({ href: PEOPLE_HREF, label: PEOPLE_LABEL });
  if (isOwner(role)) {
    links.push({ href: SETTINGS_HREF, label: SETTINGS_LABEL }, { href: "/audit", label: "Audit" });
  }
  return links;
}

export function isSendNoticePath(pathname: string): boolean {
  return (
    pathname === SEND_NOTICE_HREF ||
    pathname.startsWith(`${SEND_NOTICE_HREF}/`) ||
    pathname === "/uploads" ||
    pathname.startsWith("/uploads/") ||
    pathname === "/campaigns" ||
    pathname.startsWith("/campaigns/")
  );
}

export function sendNoticeIntro(bankName: string, canSend: boolean): string {
  const isolation = `The spreadsheet and the people stay on ${bankName}. Approved wording is shared by the firm.`;
  if (!canSend) {
    return `Notices for ${bankName}. You can look. You cannot upload a spreadsheet or send. ${isolation}`;
  }
  return `Send a notice for ${bankName}. Choose this bank’s spreadsheet of people, choose the approved notice wording, review who will get it, then send. ${isolation}`;
}

// Same switch the confirm button uses. Never hardcode that live send is off.
export function confirmWarning(input: { switchOn: boolean; authKeySet: boolean }): string {
  if (!input.switchOn) {
    return "Confirming records a dry run. Nothing is sent.";
  }
  if (!input.authKeySet) {
    return "Live send is on, but MSG91 is not set up, so a confirm cannot send yet.";
  }
  return "Confirming sends the notice for real. Messages go out.";
}

export function spreadsheetAction(
  batch: { id: string; saved: boolean },
  canSend: boolean,
): { href: string; label: string } {
  const id = safeId(batch.id);
  if (!id) return { href: SEND_NOTICE_HREF, label: "View" };
  if (!batch.saved || !canSend) {
    return { href: `/uploads/${id}`, label: canSend && !batch.saved ? "Match the columns" : "View" };
  }
  return {
    href: `${SEND_NOTICE_HREF}?batch=${encodeURIComponent(id)}`,
    label: "Choose the notice wording",
  };
}

export function wordingHref(batchId: string): string {
  const id = safeId(batchId);
  if (!id) return SEND_NOTICE_HREF;
  return `${SEND_NOTICE_HREF}?batch=${encodeURIComponent(id)}`;
}

export function legacySendEntry(pathname: string, search = ""): string | null {
  if (pathname === "/uploads" || pathname === "/campaigns") return SEND_NOTICE_HREF;
  if (pathname === "/campaigns/new") {
    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    const batch = safeId(params.get("batch") ?? "");
    if (!batch) return SEND_NOTICE_HREF;
    return `${SEND_NOTICE_HREF}?batch=${encodeURIComponent(batch)}`;
  }
  return null;
}

function safeId(value: string): string {
  const id = value.trim();
  if (!/^[A-Za-z0-9_-]+$/.test(id)) return "";
  return id;
}
