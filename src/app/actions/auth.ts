// Checks the email and password, then signs the person in or out.
// A wrong email and a wrong password get the same message, so the site does not reveal which emails exist.

"use server";

import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { logDesk } from "@/lib/desk-log";
import { passwordMatches } from "@/lib/passwords";
import { tooManyAttempts } from "@/lib/rate-limit";
import {
  OTP_COOKIE,
  OTP_MAX_AGE_SECONDS,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  sessionExpiryDate,
} from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isOtpEnabled, sendLoginOtp, verifyLoginOtp } from "@/lib/msg91";
import { isAppRole, ROLE_ADMIN } from "@/lib/roles";
import { STAFF_GATE_COOKIE, staffGateCookieOptions } from "@/lib/staff-gate";
import { staffGateIsOpen } from "@/lib/staff-gate-session";

export type SignInState = { error: string } | null;

const SIGN_IN_UNAVAILABLE = "Sign-in is unavailable right now. Try again in a moment.";

export async function signIn(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  try {
    return await signInWithPassword(formData);
  } catch (error) {
    unstable_rethrow(error);
    logDesk("signin.failed");
    return { error: SIGN_IN_UNAVAILABLE };
  }
}

async function signInWithPassword(formData: FormData): Promise<SignInState> {
  if (!(await staffGateIsOpen())) redirect("/?staff=1");

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  const headerList = await headers();
  const ip = (headerList.get("x-forwarded-for") ?? "local").split(",")[0]?.trim() || "local";
  if (tooManyAttempts(`signin:${ip}`, 20, 15 * 60 * 1000)) {
    return { error: "Too many sign-in tries. Wait a few minutes and try again." };
  }

  if (!email || !password) {
    return { error: "Enter both the email and the password." };
  }

  if (email.length > 200 || password.length > 200) {
    return { error: "That email or password is not correct." };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const passwordOk = await passwordMatches(password, user?.passwordHash ?? null);

  if (!user || !passwordOk) {
    logDesk("signin.rejected");
    return { error: "That email or password is not correct." };
  }

  if (!isAppRole(user.role)) {
    return {
      error:
        "This account does not have a role the site understands. Ask the firm administrator.",
    };
  }

  if (user.role === ROLE_ADMIN && isOtpEnabled()) {
    const sent = await sendLoginOtp();
    if (!sent.ok) return { error: sent.error };

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + OTP_MAX_AGE_SECONDS * 1000);
    await prisma.loginChallenge.deleteMany({ where: { userId: user.id } });
    await prisma.loginChallenge.create({
      data: {
        token,
        userId: user.id,
        mobile: "configured",
        expiresAt,
      },
    });

    const cookieStore = await cookies();
    cookieStore.set(OTP_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: OTP_MAX_AGE_SECONDS,
    });
    redirect("/login/otp");
  }

  await startSession(user.id);
  redirect("/dashboard");
}

export async function verifyOtp(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  if (!(await staffGateIsOpen())) redirect("/?staff=1");

  const code = String(formData.get("otp") ?? "").replace(/\D/g, "");
  if (code.length < 4 || code.length > 8) {
    return { error: "Enter the one-time code from the text message." };
  }

  const challenge = await currentChallenge();
  if (!challenge) {
    return { error: "That code has expired. Sign in with your email and password again." };
  }
  if (challenge.attempts >= 5) {
    await prisma.loginChallenge.delete({ where: { id: challenge.id } });
    return { error: "Too many tries. Sign in with your email and password again." };
  }

  const checked = await verifyLoginOtp(code);
  if (!checked.ok) {
    await prisma.loginChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    return { error: checked.error };
  }

  await prisma.loginChallenge.delete({ where: { id: challenge.id } });
  const cookieStore = await cookies();
  cookieStore.delete(OTP_COOKIE);
  await startSession(challenge.userId);
  redirect("/dashboard");
}

export async function resendOtp(): Promise<void> {
  if (!(await staffGateIsOpen())) redirect("/?staff=1");
  const challenge = await currentChallenge();
  if (!challenge) redirect("/login");
  const sent = await sendLoginOtp();
  if (!sent.ok) redirect("/login/otp?resent=0");
  redirect("/login/otp?resent=1");
}

async function startSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = sessionExpiryDate();

  await prisma.session.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  const signedIn = await prisma.user.findUnique({
    where: { id: userId },
    include: { bank: true, selectedBank: true },
  });
  if (signedIn) {
    const bank = signedIn.role === ROLE_ADMIN ? signedIn.selectedBank : signedIn.bank;
    const { recordAudit } = await import("@/lib/audit");
    await recordAudit({
      actorId: signedIn.id,
      actorName: signedIn.name,
      actorRole: signedIn.role,
      action: "login",
      summary: "Signed in.",
      bankId: bank?.id ?? null,
      bankName: bank?.name ?? "",
    });
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // This practice site runs on http on your computer. Turn secure on when it is served over https.
    secure: false,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

async function currentChallenge() {
  const cookieStore = await cookies();
  const token = cookieStore.get(OTP_COOKIE)?.value;
  if (!token) return null;
  const challenge = await prisma.loginChallenge.findUnique({ where: { token } });
  if (!challenge) return null;
  if (challenge.expiresAt.getTime() <= Date.now()) {
    await prisma.loginChallenge.delete({ where: { id: challenge.id } }).catch(() => undefined);
    return null;
  }
  return challenge;
}

export async function signOut(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }

  // Session and OTP cookies are set with secure:false. Clear them the same way.
  const sessionCookie = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: false,
    path: "/",
    maxAge: 0,
  };
  cookieStore.set(SESSION_COOKIE, "", sessionCookie);
  cookieStore.set(OTP_COOKIE, "", sessionCookie);
  // Production sets the staff door cookie with Secure. A delete that omits Secure
  // does not remove it, so /login would stay open after sign-out.
  cookieStore.set(STAFF_GATE_COOKIE, "", staffGateCookieOptions(0));
  redirect("/?staff=1");
}
