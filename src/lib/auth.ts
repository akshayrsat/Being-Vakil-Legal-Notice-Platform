// Remembers who is signed in.
// The browser only keeps a random code. The name, email, role, and bank stay in the database.
// For a Bank Viewer, bank is the one bank on their login.
// For an Admin, bank is the client they have chosen to work on, or nothing yet.

import { cookies } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { toBankSnapshot, type BankSnapshot } from "./banks";
import { prisma } from "./db";
import { ROLE_BANK_VIEWER } from "./roles";

export const SESSION_COOKIE = "noticedesk_session";
export const OTP_COOKIE = "noticedesk_otp";
export const OTP_MAX_AGE_SECONDS = 10 * 60;

const SESSION_DAYS = 7;

export type SignedInUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  bank: BankSnapshot | null;
};

export type SessionContext = {
  sessionId: string;
  user: SignedInUser;
};

export function sessionExpiryDate(): Date {
  const expires = new Date();
  expires.setDate(expires.getDate() + SESSION_DAYS);
  return expires;
}

export const SESSION_MAX_AGE_SECONDS = SESSION_DAYS * 24 * 60 * 60;

export async function getSessionContext(): Promise<SessionContext | null> {
  try {
    return await readSessionContext();
  } catch (error) {
    // A database failure must not replace /login with the crash page.
    // Redirects and dynamic rendering still propagate.
    unstable_rethrow(error);
    console.error(JSON.stringify({ app: "notice-desk", event: "session.lookup_failed" }));
    return null;
  }
}

async function readSessionContext(): Promise<SessionContext | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      user: {
        include: {
          bank: true,
          selectedBank: true,
        },
      },
    },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  const bankRecord =
    session.user.role === ROLE_BANK_VIEWER ? session.user.bank : session.user.selectedBank;

  return {
    sessionId: session.id,
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role,
      bank: toBankSnapshot(bankRecord),
    },
  };
}

export async function getCurrentUser(): Promise<SignedInUser | null> {
  const current = await getSessionContext();
  return current?.user ?? null;
}
