// Rules for adding a login. No email is sent. There is no public signup.

import { passwordLengthError } from "./passwords";
import { isAppRole, isBankUser, isCoordinator, isOwner, ROLE_BANK_USER, ROLE_COORDINATOR, roleTitle } from "./roles";

export type NewLoginRole = typeof ROLE_COORDINATOR | typeof ROLE_BANK_USER;

export function rolesThisPersonCanCreate(actorRole: string): NewLoginRole[] {
  if (isOwner(actorRole)) return [ROLE_COORDINATOR, ROLE_BANK_USER];
  if (isCoordinator(actorRole)) return [ROLE_BANK_USER];
  return [];
}

export function canCreateRole(actorRole: string, role: string): boolean {
  return rolesThisPersonCanCreate(actorRole).some((item) => item === role);
}

export type LoginDraft =
  | {
      ok: true;
      name: string;
      email: string;
      password: string;
      role: NewLoginRole;
      bankId: string | null;
    }
  | { ok: false; error: string };

export function draftLogin(input: {
  actorRole: string;
  name: string;
  email: string;
  password: string;
  role: string;
  bankId: string;
}): LoginDraft {
  if (!canCreateRole(input.actorRole, input.role)) {
    return { ok: false, error: "You cannot create that kind of login." };
  }
  const role = input.role as NewLoginRole;
  const name = input.name.trim().replace(/\s+/g, " ").slice(0, 80);
  if (name.length < 2) return { ok: false, error: "Enter the person’s name." };
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
    return { ok: false, error: "Enter an email address." };
  }
  const passwordError = passwordLengthError(input.password);
  if (passwordError) return { ok: false, error: passwordError };
  if (role === ROLE_BANK_USER) {
    const bankId = input.bankId.trim();
    if (!/^[A-Za-z0-9_-]+$/.test(bankId)) {
      return { ok: false, error: "Choose the one bank this person can see." };
    }
    return { ok: true, name, email, password: input.password, role, bankId };
  }
  return { ok: true, name, email, password: input.password, role, bankId: null };
}

export function loginRoleLabel(role: string): string {
  return roleTitle(role);
}

export function canSetTemporaryPassword(actorRole: string, targetRole: string, samePerson: boolean): boolean {
  if (samePerson) return false;
  if (isOwner(actorRole)) return isAppRole(targetRole);
  if (isCoordinator(actorRole)) return isCoordinator(targetRole) || isBankUser(targetRole);
  return false;
}

export type PersonRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  bankName: string | null;
};

export function peopleGroups(people: PersonRow[]): { staff: PersonRow[]; bankUsers: PersonRow[] } {
  const staff: PersonRow[] = [];
  const bankUsers: PersonRow[] = [];
  for (const person of people) {
    if (isBankUser(person.role)) {
      bankUsers.push(person);
      continue;
    }
    if (isOwner(person.role) || isCoordinator(person.role)) {
      staff.push({ ...person, bankName: null });
    }
  }
  return { staff, bankUsers };
}
