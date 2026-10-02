// The two kinds of people who can sign in, and the words we show for each.
// ADMIN is firm staff. BANK_VIEWER is someone on the bank side.

export const ROLE_ADMIN = "ADMIN";
export const ROLE_BANK_VIEWER = "BANK_VIEWER";

export type AppRole = typeof ROLE_ADMIN | typeof ROLE_BANK_VIEWER;

export function isAppRole(role: string): role is AppRole {
  return role === ROLE_ADMIN || role === ROLE_BANK_VIEWER;
}

export function roleTitle(role: string): string {
  if (role === ROLE_ADMIN) return "Admin";
  if (role === ROLE_BANK_VIEWER) return "Bank Viewer";
  return "Unknown role";
}

export function roleAudience(role: string): string {
  if (role === ROLE_ADMIN) return "Firm staff";
  if (role === ROLE_BANK_VIEWER) return "Bank side";
  return "Not recognised";
}

export function roleHeadline(role: string): string {
  if (role === ROLE_ADMIN) return "You are signed in as Admin.";
  if (role === ROLE_BANK_VIEWER) return "You are signed in as Bank Viewer.";
  return "You are signed in, but this account has no recognised role.";
}

export function roleSummary(role: string): string {
  if (role === ROLE_ADMIN) {
    return "You work for the law firm. Choose a bank, upload that bank’s spreadsheet, and prepare a send. Approved notice wording can be selected for any bank. A spreadsheet, its people, and a send stay on the bank you are working on. Without MSG91, a send is only a dry run. The audit log shows who did what.";
  }
  if (role === ROLE_BANK_VIEWER) {
    return "You are on the bank side. This login is tied to one bank. You can look at spreadsheets, templates, campaigns, and delivery status for that bank. You cannot upload, edit, or send.";
  }
  return "Ask the firm administrator to check this account. It should be either Admin or Bank Viewer.";
}

export function roleAccent(role: string): "admin" | "viewer" | "unknown" {
  if (role === ROLE_ADMIN) return "admin";
  if (role === ROLE_BANK_VIEWER) return "viewer";
  return "unknown";
}
