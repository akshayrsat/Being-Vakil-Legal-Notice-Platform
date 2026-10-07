import { isBankUser, isCoordinator, isOwner } from "./roles";

export function canReadPrivacyRequests(role: string): boolean {
  return isOwner(role) || isCoordinator(role) || isBankUser(role);
}

export function canEditPrivacyRequests(role: string): boolean {
  return isOwner(role) || isCoordinator(role);
}

export function canFindPerson(role: string): boolean {
  return canReadPrivacyRequests(role);
}

export function canCorrectOrErase(role: string): boolean {
  return isOwner(role) || isCoordinator(role);
}

export function canReadIncidents(role: string): boolean {
  return isOwner(role);
}

export function canEditPrivacyContact(role: string): boolean {
  return isOwner(role);
}

export const PRIVACY_REQUEST_KINDS = ["ACCESS", "CORRECTION", "ERASURE", "GRIEVANCE", "NOMINEE"] as const;
export type PrivacyRequestKind = (typeof PRIVACY_REQUEST_KINDS)[number];

export function privacyRequestKindLabel(kind: string): string {
  if (kind === "ACCESS") return "Access";
  if (kind === "CORRECTION") return "Correction";
  if (kind === "ERASURE") return "Erasure";
  if (kind === "GRIEVANCE") return "Grievance";
  if (kind === "NOMINEE") return "Nominee";
  return kind;
}

export function isPrivacyRequestKind(value: string): value is PrivacyRequestKind {
  return (PRIVACY_REQUEST_KINDS as readonly string[]).includes(value);
}

export const PRIVACY_REQUEST_STATUSES = ["OPEN", "IN_PROGRESS", "DONE"] as const;

export function privacyRequestStatusLabel(status: string): string {
  if (status === "OPEN") return "Open";
  if (status === "IN_PROGRESS") return "In progress";
  if (status === "DONE") return "Done";
  return status;
}

export function requestDueAt(createdAt: Date, dueDays: number): Date {
  const days = Number.isInteger(dueDays) && dueDays >= 1 && dueDays <= 365 ? dueDays : 30;
  return new Date(createdAt.getTime() + days * 24 * 60 * 60 * 1000);
}
