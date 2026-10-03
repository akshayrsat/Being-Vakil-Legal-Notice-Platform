// Who can sign in.
// Owner: one firm admin. Banks, the audit log, and the live-send switch.
// Legal coordinator: can send notices and add a bank user for one bank.
// Bank user: one bank, and only that bank.
// ADMIN and BANK_VIEWER are the earlier names for owner and bank user. They still sign in.

export const ROLE_OWNER = "OWNER";
export const ROLE_COORDINATOR = "LEGAL_COORDINATOR";
export const ROLE_BANK_USER = "BANK_USER";
export const ROLE_ADMIN = "ADMIN";
export const ROLE_BANK_VIEWER = "BANK_VIEWER";

export type AppRole =
  | typeof ROLE_OWNER
  | typeof ROLE_COORDINATOR
  | typeof ROLE_BANK_USER
  | typeof ROLE_ADMIN
  | typeof ROLE_BANK_VIEWER;

export function isAppRole(role: string): role is AppRole {
  return (
    role === ROLE_OWNER ||
    role === ROLE_COORDINATOR ||
    role === ROLE_BANK_USER ||
    role === ROLE_ADMIN ||
    role === ROLE_BANK_VIEWER
  );
}

export function isOwner(role: string): boolean {
  return role === ROLE_OWNER || role === ROLE_ADMIN;
}

export function isCoordinator(role: string): boolean {
  return role === ROLE_COORDINATOR;
}

export function isBankUser(role: string): boolean {
  return role === ROLE_BANK_USER || role === ROLE_BANK_VIEWER;
}

export function canSendNotices(role: string): boolean {
  return isOwner(role) || isCoordinator(role);
}

export function canChooseBank(role: string): boolean {
  return canSendNotices(role);
}

export function canManageFirm(role: string): boolean {
  return isOwner(role);
}

export function canCreateLogins(role: string): boolean {
  return isOwner(role) || isCoordinator(role);
}

export function usesAssignedBank(role: string): boolean {
  return isBankUser(role);
}

export function roleTitle(role: string): string {
  if (isOwner(role)) return "Owner";
  if (isCoordinator(role)) return "Legal coordinator";
  if (isBankUser(role)) return "Bank user";
  if (role === "webhook") return "Status update";
  return "Unknown role";
}

export function roleAudience(role: string): string {
  if (canSendNotices(role)) return "Firm";
  if (isBankUser(role)) return "One bank";
  return "Not recognised";
}

export function roleHeadline(role: string): string {
  const title = roleTitle(role);
  if (title === "Unknown role") return "You are signed in, but this account has no recognised role.";
  return `You are signed in as ${title}.`;
}

export function roleSummary(role: string): string {
  if (isOwner(role)) {
    return "You are the owner. You can send a notice, add a bank, add a login, read the audit log, and turn live send on or off. A spreadsheet, its people, and a send stay on the bank you are working on.";
  }
  if (isCoordinator(role)) {
    return "You can send a notice for the bank you are working on, and you can add a bank user for one bank. You cannot turn live send on or off, add a bank, or open the audit log.";
  }
  if (isBankUser(role)) {
    return "You can look at this one bank. You cannot see another bank, send a notice, add a login, or turn live send on or off.";
  }
  return "Ask the owner to check this account. It should be an owner, a legal coordinator, or a bank user.";
}

export function roleAccent(role: string): "admin" | "viewer" | "unknown" {
  if (canSendNotices(role)) return "admin";
  if (isBankUser(role)) return "viewer";
  return "unknown";
}
