// What the customer can do on their private case page. No staff session is required.

"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  ODR_GRANT_HOURS,
  ODR_VERIFY_COOKIE,
  ODR_VERIFY_LIMIT,
  ODR_VERIFY_WINDOW_MS,
  clientIp,
  clipAgent,
  isPdf,
  safePdfName,
  verifyRateKey,
} from "@/lib/odr-access";
import { accountLast4, last4Matches, newGrantToken } from "@/lib/odr-ref";
import { CUSTOMER_DOCUMENT_KINDS } from "@/lib/odr-status";
import { withPartyAttendance } from "@/lib/odr-parties";
import { resolvePublicCase } from "@/lib/odr-public-case";
import { tooManyAttempts } from "@/lib/rate-limit";

export type PublicOdrState = { error: string } | null;

const MAX_BYTES = 5 * 1024 * 1024;

async function requestMeta() {
  const headerList = await headers();
  return {
    ip: clientIp(headerList.get("x-forwarded-for")),
    userAgent: clipAgent(headerList.get("user-agent")),
  };
}

async function caseByToken(token: string) {
  const found = await resolvePublicCase(token);
  if (!found) return null;
  return { ...found.item, viewer: found.viewer };
}

async function granted(caseId: string): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ODR_VERIFY_COOKIE)?.value ?? "";
  if (!token) return false;
  const grant = await prisma.odrVerifyGrant.findFirst({ where: { token, caseId } });
  if (!grant) return false;
  if (grant.expiresAt.getTime() <= Date.now()) return false;
  return true;
}

export async function verifyOdrCase(_previous: PublicOdrState, formData: FormData): Promise<PublicOdrState> {
  const token = String(formData.get("token") ?? "");
  const item = await caseByToken(token);
  if (!item) return { error: "This case link is not valid." };
  const meta = await requestMeta();
  if (!accountLast4(item.accountNumber)) {
    return { error: "This case cannot be opened online. Please call Being Vakil Associates." };
  }
  if (tooManyAttempts(verifyRateKey(token, meta.ip), ODR_VERIFY_LIMIT, ODR_VERIFY_WINDOW_MS)) {
    await prisma.odrAccessLog.create({
      data: { caseId: item.id, bankId: item.bankId, kind: "VERIFY_FAIL", ip: meta.ip, userAgent: meta.userAgent, detail: "Locked" },
    });
    return { error: "Too many attempts. Wait a few minutes and try again." };
  }
  const attempt = String(formData.get("last4") ?? "");
  if (!last4Matches(item.accountNumber, attempt)) {
    await prisma.odrAccessLog.create({
      data: { caseId: item.id, bankId: item.bankId, kind: "VERIFY_FAIL", ip: meta.ip, userAgent: meta.userAgent, detail: "Digits did not match" },
    });
    return { error: "Those digits do not match this case. Check the account number and try again." };
  }
  const grant = newGrantToken();
  await prisma.odrVerifyGrant.create({
    data: { token: grant, caseId: item.id, expiresAt: new Date(Date.now() + ODR_GRANT_HOURS * 60 * 60 * 1000) },
  });
  await prisma.odrAccessLog.create({
    data: { caseId: item.id, bankId: item.bankId, kind: "VERIFY_OK", ip: meta.ip, userAgent: meta.userAgent },
  });
  const cookieStore = await cookies();
  cookieStore.set(ODR_VERIFY_COOKIE, grant, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: `/odr/c/${token}`,
    maxAge: ODR_GRANT_HOURS * 60 * 60,
  });
  redirect(`/odr/c/${token}`);
}

export async function joinOdrHearing(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const hearingId = String(formData.get("hearingId") ?? "");
  const item = await caseByToken(token);
  if (!item || !(await granted(item.id))) redirect(`/odr/c/${token}`);
  const hearing = await prisma.odrHearing.findFirst({ where: { id: hearingId, caseId: item.id, bankId: item.bankId } });
  if (!hearing?.meetLink) redirect(`/odr/c/${token}`);
  const meta = await requestMeta();
  await prisma.odrAccessLog.create({
    data: {
      caseId: item.id,
      bankId: item.bankId,
      kind: "JOIN",
      ip: meta.ip,
      userAgent: meta.userAgent,
      detail: item.viewer ? `Hearing ${hearing.number} · ${item.viewer.name}` : `Hearing ${hearing.number}`,
    },
  });
  if (item.viewer) {
    await prisma.odrHearing.update({
      where: { id: hearing.id },
      data: { partyAttendance: withPartyAttendance(hearing.partyAttendance, item.viewer.id, "JOINED") },
    });
  }
  redirect(hearing.meetLink);
}

export async function saveCustomerAdvocate(_previous: PublicOdrState, formData: FormData): Promise<PublicOdrState> {
  const token = String(formData.get("token") ?? "");
  const item = await caseByToken(token);
  if (!item || !(await granted(item.id))) return { error: "Open the case again from your message." };
  const advocateName = String(formData.get("advocateName") ?? "").trim().slice(0, 120);
  const advocateBarNo = String(formData.get("advocateBarNo") ?? "").trim().slice(0, 80);
  if (advocateName.length < 3) return { error: "Enter the advocate’s name." };
  await prisma.odrCase.update({ where: { id: item.id }, data: { advocateName, advocateBarNo } });
  const meta = await requestMeta();
  await prisma.odrAccessLog.create({
    data: { caseId: item.id, bankId: item.bankId, kind: "ADVOCATE", ip: meta.ip, userAgent: meta.userAgent, detail: advocateName },
  });
  redirect(`/odr/c/${token}`);
}

export async function requestReschedule(_previous: PublicOdrState, formData: FormData): Promise<PublicOdrState> {
  const token = String(formData.get("token") ?? "");
  const item = await caseByToken(token);
  if (!item || !(await granted(item.id))) return { error: "Open the case again from your message." };
  if (item.rescheduleAt) return { error: "A request is already on file." };
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);
  const preferred = String(formData.get("preferred") ?? "").trim().slice(0, 40);
  if (note.length < 3) return { error: "Write a short reason." };
  await prisma.odrCase.update({
    where: { id: item.id },
    data: { rescheduleNote: note, reschedulePreferred: preferred, rescheduleAt: new Date() },
  });
  await prisma.odrAlert.create({
    data: { caseId: item.id, bankId: item.bankId, kind: "RESCHEDULE", summary: `${item.customerName} asked for another date on ${item.refNo}.` },
  });
  const meta = await requestMeta();
  await prisma.odrAccessLog.create({
    data: { caseId: item.id, bankId: item.bankId, kind: "RESCHEDULE", ip: meta.ip, userAgent: meta.userAgent, detail: note },
  });
  redirect(`/odr/c/${token}`);
}

export async function submitSettlement(_previous: PublicOdrState, formData: FormData): Promise<PublicOdrState> {
  const token = String(formData.get("token") ?? "");
  const item = await caseByToken(token);
  if (!item || !(await granted(item.id))) return { error: "Open the case again from your message." };
  const amount = String(formData.get("amount") ?? "").trim().slice(0, 40);
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);
  if (!amount) return { error: "Enter the amount you offer." };
  await prisma.odrCase.update({
    where: { id: item.id },
    data: { settlementAmount: amount, settlementNote: note, settlementAt: new Date() },
  });
  await prisma.odrAlert.create({
    data: {
      caseId: item.id,
      bankId: item.bankId,
      kind: "SETTLEMENT",
      summary: `${item.customerName} offered ${amount} on ${item.refNo}.`,
    },
  });
  const meta = await requestMeta();
  await prisma.odrAccessLog.create({
    data: { caseId: item.id, bankId: item.bankId, kind: "SETTLE", ip: meta.ip, userAgent: meta.userAgent, detail: amount },
  });
  redirect(`/odr/c/${token}`);
}

export async function uploadCustomerDocument(_previous: PublicOdrState, formData: FormData): Promise<PublicOdrState> {
  const token = String(formData.get("token") ?? "");
  const item = await caseByToken(token);
  if (!item || !(await granted(item.id))) return { error: "Open the case again from your message." };
  const kind = String(formData.get("kind") ?? "");
  if (!CUSTOMER_DOCUMENT_KINDS.some((row) => row.id === kind)) return { error: "Choose the kind of document." };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a PDF." };
  if (file.size > MAX_BYTES) return { error: "That PDF is larger than 5 MB." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isPdf(bytes)) return { error: "Upload a PDF file." };
  await prisma.odrDocument.create({
    data: {
      caseId: item.id,
      bankId: item.bankId,
      kind,
      fileName: safePdfName(file.name),
      content: Buffer.from(bytes),
      uploadedBy: "customer",
      uploaderName: item.customerName,
    },
  });
  await prisma.odrAlert.create({
    data: { caseId: item.id, bankId: item.bankId, kind: "UPLOAD", summary: `${item.customerName} uploaded a document on ${item.refNo}.` },
  });
  const meta = await requestMeta();
  await prisma.odrAccessLog.create({
    data: { caseId: item.id, bankId: item.bankId, kind: "UPLOAD", ip: meta.ip, userAgent: meta.userAgent, detail: kind },
  });
  redirect(`/odr/c/${token}`);
}

export async function customerGrantMatches(caseId: string): Promise<boolean> {
  return granted(caseId);
}
