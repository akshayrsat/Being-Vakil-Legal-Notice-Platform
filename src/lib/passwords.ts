// Password checks for sign-in, a temporary password, and a reset link.
// bcryptjs is imported only when a form is submitted. Loading it while /login
// renders used to hash a dummy password at module scope. That runs as soon as
// the sign-in form is drawn (after the staff entry code). On Cloud Run the
// hash throws when the crypto bridge is missing, and the error page opens
// instead of the email and password fields.
// Do not put a password or a reset token in an audit summary.

import { createHash, randomBytes } from "node:crypto";
import { PASSWORD_HREF } from "./account-paths";

// A valid bcrypt hash that does not match a real password. Comparing against
// it keeps unknown emails on the same code path as a real account.
const UNKNOWN_EMAIL_HASH = "$2b$10$1cwaOC/UPwZS19pub9F8X.9CyKuxJFQtnzg2IUagJy15Ky.zMVOQ6";

type BcryptApi = {
  compare: (password: string, hash: string) => Promise<boolean>;
};

async function bcryptApi(): Promise<BcryptApi> {
  const loaded = (await import("bcryptjs")) as {
    compare?: BcryptApi["compare"];
    default?: BcryptApi;
  };
  if (typeof loaded.compare === "function") return loaded as BcryptApi;
  if (loaded.default && typeof loaded.default.compare === "function") return loaded.default;
  throw new Error("bcryptjs did not load");
}

export async function passwordMatches(password: string, storedHash: string | null): Promise<boolean> {
  const api = await bcryptApi();
  return api.compare(password, storedHash ?? UNKNOWN_EMAIL_HASH);
}

type BcryptHash = {
  hash: (value: string, rounds: number) => Promise<string>;
};

export async function hashPassword(password: string): Promise<string> {
  const loaded = (await import("bcryptjs")) as {
    hash?: BcryptHash["hash"];
    default?: BcryptHash;
  };
  const hash = loaded.hash ?? loaded.default?.hash;
  if (!hash) throw new Error("bcryptjs did not load");
  return hash(password, 10);
}

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 200;
export const RESET_WINDOW_MS = 30 * 60 * 1000;

export const FORGOT_NEUTRAL =
  "If that email is a login, a reset link is on its way. The link works once and expires in 30 minutes.";
export const FORGOT_ADMIN_NOTE =
  "If you do not receive it, contact your admin for a temporary password.";
export const FORGOT_LIMIT = "Too many reset tries. Wait a few minutes and try again.";

export function passwordLengthError(password: string): string | null {
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    return "Use a password of at least 8 characters.";
  }
  return null;
}

export function temporaryPassword(): string {
  return randomBytes(18).toString("base64url");
}

export function destinationAfterSignIn(mustChangePassword: boolean): string {
  return mustChangePassword ? PASSWORD_HREF : "/dashboard";
}

export function changePasswordError(input: { current: string; next: string; confirm: string }): string | null {
  if (!input.current || !input.next || !input.confirm) {
    return "Enter your current password, a new password, and the same new password again.";
  }
  const length = passwordLengthError(input.next);
  if (length) return length;
  if (input.next !== input.confirm) return "Type the new password again so both match.";
  if (input.next === input.current) return "Choose a different password from the one you use now.";
  return null;
}

export function resetPasswordError(next: string, confirm: string): string | null {
  if (!next || !confirm) return "Enter a new password and type it again.";
  const length = passwordLengthError(next);
  if (length) return length;
  if (next !== confirm) return "Type the new password again so both match.";
  return null;
}

export function forgotPasswordReply(input: { limited: boolean; mailerReady: boolean }): {
  error: string | null;
  message: string;
} {
  if (input.limited) return { error: FORGOT_LIMIT, message: "" };
  return {
    error: null,
    message: input.mailerReady ? FORGOT_NEUTRAL : `${FORGOT_NEUTRAL} ${FORGOT_ADMIN_NOTE}`,
  };
}

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newResetToken(now = Date.now()): { token: string; tokenHash: string; expiresAt: Date } {
  const token = randomBytes(32).toString("hex");
  return {
    token,
    tokenHash: hashResetToken(token),
    expiresAt: new Date(now + RESET_WINDOW_MS),
  };
}

export type ResetTokenState = "missing" | "used" | "expired" | "ready";

export function resetTokenState(
  row: { expiresAt: Date; usedAt: Date | null } | null,
  now = Date.now(),
): ResetTokenState {
  if (!row) return "missing";
  if (row.usedAt) return "used";
  if (row.expiresAt.getTime() <= now) return "expired";
  return "ready";
}

export function otherSessionsWhere(
  userId: string,
  keepSessionId: string | null,
): { userId: string; id?: { not: string } } {
  if (!keepSessionId) return { userId };
  return { userId, id: { not: keepSessionId } };
}
