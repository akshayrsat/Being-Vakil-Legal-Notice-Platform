// The owner admin is the only person who sees vendor names and template ids.
// They are an owner (Owner, or the earlier Admin role) whose email is on OWNER_ADMIN_EMAILS.
// A legal coordinator and a bank user see the template name and the channel, even if the email matches.

import { isOwner } from "./roles";

const DEFAULT_OWNER_ADMIN_EMAILS = ["akshayrsathe@gmail.com", "akshayrsat@gmail.com"];

export function ownerAdminEmails(envValue: string | undefined = process.env.OWNER_ADMIN_EMAILS): string[] {
  const raw = (envValue ?? "").trim();
  if (!raw) return [...DEFAULT_OWNER_ADMIN_EMAILS];
  const parsed = raw
    .split(/[,;\s]+/)
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.includes("@"));
  return parsed.length > 0 ? parsed : [...DEFAULT_OWNER_ADMIN_EMAILS];
}

export function isOwnerAdmin(
  user: { role: string; email: string } | null | undefined,
  envValue?: string,
): boolean {
  if (!user || !isOwner(user.role)) return false;
  const email = user.email.trim().toLowerCase();
  if (!email) return false;
  return ownerAdminEmails(envValue).includes(email);
}
