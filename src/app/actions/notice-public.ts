"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { clientIp, ODR_GRANT_HOURS, ODR_VERIFY_LIMIT, ODR_VERIFY_WINDOW_MS } from "@/lib/odr-access";
import { last4Challenge, last4Matches, newGrantToken } from "@/lib/odr-ref";
import { normalizeNoticeNumber, noticeCustomerMobile } from "@/lib/public-notice";
import { NOTICE_VERIFY_COOKIE } from "@/lib/notice-access";
import { noticePageHref } from "@/lib/notice-link";
import { tooManyAttempts } from "@/lib/rate-limit";

export type NoticeVerifyState = { error: string } | null;

export async function noticeGrantMatches(noticeNumber: string): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(NOTICE_VERIFY_COOKIE)?.value ?? "";
  if (!token) return false;
  const grant = await prisma.noticeVerifyGrant.findFirst({ where: { token, noticeNumber } });
  if (!grant) return false;
  return grant.expiresAt.getTime() > Date.now();
}

export async function verifyPublicNotice(
  _previous: NoticeVerifyState,
  formData: FormData,
): Promise<NoticeVerifyState> {
  const noticeNumber = normalizeNoticeNumber(String(formData.get("noticeNumber") ?? ""));
  if (!noticeNumber) return { error: "This notice link is not valid." };
  const notice = await prisma.publicNotice.findUnique({
    where: { noticeNumber },
    select: { loanNumber: true },
  });
  if (!notice) return { error: "This notice link is not valid." };
  const headerList = await headers();
  const ip = clientIp(headerList.get("x-forwarded-for"));
  const mobile = await noticeCustomerMobile(noticeNumber);
  const challenge = last4Challenge(notice.loanNumber, mobile);
  if (!challenge) {
    return { error: "This notice cannot be opened online. Please call Being Vakil Associates." };
  }
  if (tooManyAttempts(`notice-verify:${noticeNumber}:${ip.slice(0, 64)}`, ODR_VERIFY_LIMIT, ODR_VERIFY_WINDOW_MS)) {
    return { error: "Too many attempts. Wait a few minutes and try again." };
  }
  if (!last4Matches(challenge.value, String(formData.get("last4") ?? ""))) {
    return {
      error: challenge.source === "mobile"
        ? "Those digits do not match this notice. Check the mobile number and try again."
        : "Those digits do not match this notice. Check the account number and try again.",
    };
  }
  const grant = newGrantToken();
  await prisma.noticeVerifyGrant.create({
    data: {
      token: grant,
      noticeNumber,
      expiresAt: new Date(Date.now() + ODR_GRANT_HOURS * 60 * 60 * 1000),
    },
  });
  const cookieStore = await cookies();
  cookieStore.set(NOTICE_VERIFY_COOKIE, grant, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ODR_GRANT_HOURS * 60 * 60,
  });
  redirect(noticePageHref(noticeNumber));
}
