// Checks the email and password, then signs the person in or out.
// A wrong email and a wrong password get the same message, so the site does not reveal which emails exist.

"use server";

import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { logDesk } from "@/lib/desk-log";
import { RESET_PASSWORD_HREF } from "@/lib/account-paths";
import { clearCoordinatorBankLinks } from "@/lib/coordinator-bank";
import { noticePublicBaseUrl } from "@/lib/notice-link";
import {
  destinationAfterSignIn,
  forgotPasswordReply,
  hashPassword,
  hashResetToken,
  newResetToken,
  passwordMatches,
  resetPasswordError,
  resetTokenState,
} from "@/lib/passwords";
import { sessionCookieOptions, sessionCookieSecure } from "@/lib/session-cookie";
import { tooManyAttempts } from "@/lib/rate-limit";
import { passwordResetMailReady, sendPasswordResetEmail } from "@/lib/system-email";
import {
  OTP_COOKIE,
  OTP_MAX_AGE_SECONDS,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  sessionExpiryDate,
} from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isOtpEnabled, sendLoginOtp, verifyLoginOtp } from "@/lib/msg91";
import { canSendNotices, isAppRole, isCoordinator, usesAssignedBank } from "@/lib/roles";
import { STAFF_GATE_COOKIE, staffGateCookieOptions } from "@/lib/staff-gate";
import { staffGateIsOpen } from "@/lib/staff-gate-session";

export type SignInState = { error: string } | null;

export type ForgotPasswordState = { error: string; message: string } | { error: null; message: string } | null;

export type ResetPasswordState = { error: string } | { done: true } | null;

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

  if (canSendNotices(user.role) && isOtpEnabled()) {
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
    cookieStore.set(
      OTP_COOKIE,
      token,
      sessionCookieOptions({
        secure: sessionCookieSecure({
          nodeEnv: process.env.NODE_ENV,
          publicBaseUrl: process.env.NOTICE_PUBLIC_BASE_URL,
        }),
        maxAge: OTP_MAX_AGE_SECONDS,
      }),
    );
    redirect("/login/otp");
  }

  const mustChange = await startSession(user.id);
  redirect(destinationAfterSignIn(mustChange));
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
  const mustChange = await startSession(challenge.userId);
  redirect(destinationAfterSignIn(mustChange));
}

export async function resendOtp(): Promise<void> {
  if (!(await staffGateIsOpen())) redirect("/?staff=1");
  const challenge = await currentChallenge();
  if (!challenge) redirect("/login");
  const sent = await sendLoginOtp();
  if (!sent.ok) redirect("/login/otp?resent=0");
  redirect("/login/otp?resent=1");
}

async function startSession(userId: string): Promise<boolean> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = sessionExpiryDate();

  await prisma.session.create({
    data: {
      token: hashResetToken(token),
      userId,
      expiresAt,
    },
  });

  const signedIn = await prisma.user.findUnique({
    where: { id: userId },
    include: { bank: true, selectedBank: true },
  });
  if (signedIn && isCoordinator(signedIn.role) && signedIn.bankId) {
    await clearCoordinatorBankLinks(prisma);
  }
  if (signedIn) {
    const bank = usesAssignedBank(signedIn.role) ? signedIn.bank : signedIn.selectedBank;
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
  const secure = sessionCookieSecure({
    nodeEnv: process.env.NODE_ENV,
    publicBaseUrl: process.env.NOTICE_PUBLIC_BASE_URL,
  });
  cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions({ secure, maxAge: SESSION_MAX_AGE_SECONDS }));
  return signedIn?.mustChangePassword === true;
}

export async function requestPasswordReset(
  _previous: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  if (!(await staffGateIsOpen())) redirect("/?staff=1");

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const headerList = await headers();
  const ip = (headerList.get("x-forwarded-for") ?? "local").split(",")[0]?.trim() || "local";
  const limited =
    tooManyAttempts(`reset:${ip}`, 5, 15 * 60 * 1000) ||
    tooManyAttempts(`reset:${email || "blank"}`, 5, 15 * 60 * 1000);
  const mailerReady = passwordResetMailReady();
  const reply = forgotPasswordReply({ limited, mailerReady });
  if (reply.error) return { error: reply.error, message: "" };

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 200;
  if (emailOk && mailerReady) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const created = newResetToken();
      await prisma.passwordReset.deleteMany({ where: { userId: user.id, usedAt: null } });
      await prisma.passwordReset.create({
        data: {
          userId: user.id,
          tokenHash: created.tokenHash,
          expiresAt: created.expiresAt,
        },
      });
      const link = `${noticePublicBaseUrl()}${RESET_PASSWORD_HREF}?token=${created.token}`;
      const sent = await sendPasswordResetEmail({ to: user.email, name: user.name, link });
      if (!sent.ok) logDesk("password.reset_mail_failed");
    }
  }

  return { error: null, message: reply.message };
}

export async function completePasswordReset(
  _previous: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const token = String(formData.get("token") ?? "").trim();
  const next = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const problem = resetPasswordError(next, confirm);
  if (problem) return { error: problem };
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return { error: "That reset link is not valid. Ask for a new one." };
  }

  const row = await prisma.passwordReset.findUnique({
    where: { tokenHash: hashResetToken(token) },
    include: { user: true },
  });
  const state = resetTokenState(row);
  if (state === "expired") return { error: "That reset link has expired. Ask for a new one." };
  if (state === "used") return { error: "That reset link was already used. Ask for a new one." };
  if (state !== "ready" || !row) return { error: "That reset link is not valid. Ask for a new one." };

  const claimed = await prisma.passwordReset.updateMany({
    where: { id: row.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (claimed.count !== 1) {
    return { error: "That reset link was already used. Ask for a new one." };
  }

  const passwordHash = await hashPassword(next);
  await prisma.user.update({
    where: { id: row.userId },
    data: { passwordHash, mustChangePassword: false },
  });
  await prisma.session.deleteMany({ where: { userId: row.userId } });

  const { recordAudit } = await import("@/lib/audit");
  await recordAudit({
    actorId: row.user.id,
    actorName: row.user.name,
    actorRole: row.user.role,
    action: "user.password",
    summary: "Reset their password from a link.",
  });
  return { done: true };
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
    await prisma.session.deleteMany({ where: { token: hashResetToken(token) } });
  }

  const sessionCookie = sessionCookieOptions({
    secure: sessionCookieSecure({
      nodeEnv: process.env.NODE_ENV,
      publicBaseUrl: process.env.NOTICE_PUBLIC_BASE_URL,
    }),
    maxAge: 0,
  });
  cookieStore.set(SESSION_COOKIE, "", sessionCookie);
  cookieStore.set(OTP_COOKIE, "", sessionCookie);
  // Production sets the staff door cookie with Secure. A delete that omits Secure
  // does not remove it, so /login would stay open after sign-out.
  cookieStore.set(STAFF_GATE_COOKIE, "", staffGateCookieOptions(0));
  redirect("/?staff=1");
}
