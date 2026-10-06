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
import { last4Challenge, last4Matches, newGrantToken } from "@/lib/odr-ref";
import { CUSTOMER_DOCUMENT_KINDS } from "@/lib/odr-status";
import { withPartyAttendance } from "@/lib/odr-parties";
import { resolvePublicCase } from "@/lib/odr-public-case";
import { tooManyAttempts } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/auth";
import { consentCertificateDocx } from "@/lib/odr-consent-docx";
import { neutralContactError } from "@/lib/odr-neutral";
import {
  certificateLines,
  consentChoiceError,
  consentShownText,
  istStamp,
  slotsOnArbitratorTrack,
  type ConsentChoice,
  type PanelName,
} from "@/lib/odr-consent";
import { loadAppointmentConsent } from "@/lib/odr-consent-store";
import { CONCILIATION_REPLY_DAYS, conciliationState, resolveLegalRoute, sameNeutralBar } from "@/lib/odr-route";
import { panelJson } from "@/lib/odr-panel";
import { busyByNeutral, scheduleFromBatch } from "@/lib/odr-slot-store";
import { rulesFromSchedule, type HearingRules } from "@/lib/odr-slots";

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
  const challenge = last4Challenge(item.accountNumber, item.viewer ? item.viewer.mobile : item.mobile);
  if (!challenge) {
    return { error: "This case cannot be opened online. Please call Being Vakil Associates." };
  }
  if (tooManyAttempts(verifyRateKey(token, meta.ip), ODR_VERIFY_LIMIT, ODR_VERIFY_WINDOW_MS)) {
    await prisma.odrAccessLog.create({
      data: { caseId: item.id, bankId: item.bankId, kind: "VERIFY_FAIL", ip: meta.ip, userAgent: meta.userAgent, detail: "Locked" },
    });
    return { error: "Too many attempts. Wait a few minutes and try again." };
  }
  const attempt = String(formData.get("last4") ?? "");
  if (!last4Matches(challenge.value, attempt)) {
    await prisma.odrAccessLog.create({
      data: { caseId: item.id, bankId: item.bankId, kind: "VERIFY_FAIL", ip: meta.ip, userAgent: meta.userAgent, detail: "Digits did not match" },
    });
    return {
      error: challenge.source === "mobile"
        ? "Those digits do not match this case. Check the mobile number and try again."
        : "Those digits do not match this case. Check the account number and try again.",
    };
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
  if (!(await getCurrentUser())) {
    const consent = await loadAppointmentConsent(item);
    if (!consent.hearingBookingOpen) redirect(`/odr/c/${token}`);
  }
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
  const consent = await loadAppointmentConsent(item);
  if (!consent.hearingBookingOpen) return { error: consent.warning || "Record your choice of arbitrator before asking for another date." };
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

export async function recordArbitratorConsent(_previous: PublicOdrState, formData: FormData): Promise<PublicOdrState> {
  const token = String(formData.get("token") ?? "");
  const found = await caseByToken(token);
  if (!found || !(await granted(found.id))) return { error: "Open the case again from your message." };
  if (found.matterType !== "ARBITRATION") return { error: "This step is for an arbitration case." };
  const respondentId = found.viewer?.id ?? "";
  const existing = await prisma.odrConsent.findFirst({ where: { caseId: found.id, respondentId } });
  if (existing) return { error: "Your choice is already recorded." };

  const seats = await prisma.odrBankPanel.findMany({
    where: { bankId: found.bankId },
    orderBy: { sortOrder: "asc" },
    include: { neutral: true },
  });
  const panel: PanelName[] = seats.flatMap((seat) => seat.neutral.active ? [{
    id: seat.neutral.id,
    name: seat.neutral.name,
    qualification: seat.neutral.qualification,
    enrolment: seat.neutral.enrolmentNo,
  }] : []);
  const bank = await prisma.bank.findUnique({ where: { id: found.bankId }, select: { name: true } });
  const expectedName = found.viewer?.name || found.customerName;
  const choice = String(formData.get("choice") ?? "");
  const panelNeutralId = String(formData.get("panelNeutralId") ?? "").trim();
  const objection = String(formData.get("objection") ?? "").trim().slice(0, 1000);
  const typedName = String(formData.get("typedName") ?? "").trim().slice(0, 160);
  const problem = consentChoiceError({
    choice,
    waive: formData.get("waive") === "yes",
    typedName,
    expectedName,
    panelNeutralId,
    panel,
    objection,
  });
  if (problem) return { error: problem };
  const picked = choice as ConsentChoice;
  const chosen = panel.find((member) => member.id === panelNeutralId) ?? null;
  const chosenRow = seats.find((seat) => seat.neutral.id === chosen?.id)?.neutral;
  if (picked === "PANEL" && chosenRow && neutralContactError(chosenRow)) {
    return { error: "That name cannot be chosen yet. The firm has not saved an email and mobile for them." };
  }
  const appointId = picked === "PANEL" ? chosen?.id ?? "" : found.neutralId ?? "";
  if (appointId) {
    const prior = await prisma.odrNeutralService.findMany({ where: { caseId: found.id, neutralId: appointId }, select: { role: true } });
    const barred = sameNeutralBar({ nextRole: "ARBITRATOR", priorRoles: prior.map((row) => row.role) });
    if (barred) return { error: barred };
  }
  const others = await prisma.odrConsent.findMany({ where: { caseId: found.id, NOT: { respondentId } } });
  const mineId = picked === "PANEL" ? chosen?.id ?? "" : picked === "ACCEPT" ? (found.nominatedNeutralId || found.neutralId || "") : "";
  const clash = others.some((row) => {
    const theirId = row.choice === "PANEL" ? row.chosenNeutralId : row.choice === "ACCEPT" ? (found.nominatedNeutralId || found.neutralId || "") : "";
    return Boolean(mineId && theirId && mineId !== theirId);
  });
  if (clash) return { error: "Another respondent has already chosen a different arbitrator." };
  const shownText = consentShownText({
    customer: expectedName,
    bank: bank?.name ?? "",
    arbitrator: found.neutralName,
    qualification: found.neutralQualification,
    enrolment: found.neutralEnrolment,
    panel,
  });
  const recordedAt = new Date();
  const recordedAtIst = istStamp(recordedAt);
  const meta = await requestMeta();

  let moved: Array<{ id: string; start: Date }> = [];
  let nextNeutral: PanelName | null = null;
  if (picked === "PANEL" && chosen && chosen.id !== (found.neutralId ?? "")) {
    const hearings = await prisma.odrHearing.findMany({ where: { caseId: found.id }, orderBy: { number: "asc" } });
    if (hearings.length > 0) {
      const batch = await prisma.odrBatch.findFirst({ where: { id: found.batchId } });
      const schedule = batch
        ? scheduleFromBatch(batch)
        : {
            start: hearings[0]!.scheduledAt,
            durationMinutes: hearings[0]!.durationMinutes,
            windowStart: "10:00",
            windowEnd: "18:00",
            gapMinutes: 15,
            skipSundays: true,
            holidays: [] as string[],
            breakStart: "13:30",
            breakEnd: "14:30",
          };
      const rules = rulesFromSchedule(schedule);
      if (!rules) return { error: "The hearing window on this case could not be read." };
      const trackRules: HearingRules = { ...rules, start: hearings[0]!.scheduledAt };
      const busyMap = await busyByNeutral([chosen.id], trackRules.start);
      const own = new Set(hearings.map((hearing) => `${hearing.scheduledAt.getTime()}:${hearing.durationMinutes}`));
      const busy = (busyMap.get(chosen.id) ?? []).filter((interval) => {
        const minutes = Math.round((interval.end.getTime() - interval.start.getTime()) / 60000);
        return !own.has(`${interval.start.getTime()}:${minutes}`);
      });
      const notBefore = hearings[0]!.scheduledAt.getTime() > recordedAt.getTime() ? hearings[0]!.scheduledAt : recordedAt;
      const placed = slotsOnArbitratorTrack(trackRules, busy, hearings.length, notBefore);
      if (!placed.ok) return { error: placed.error };
      moved = hearings.map((hearing, index) => ({ id: hearing.id, start: placed.slots[index]!.start }));
    }
    nextNeutral = chosen;
  }

  const lines = certificateLines({
    refNo: found.refNo,
    bank: bank?.name ?? "",
    customer: expectedName,
    choice: picked,
    typedName,
    arbitratorName: found.neutralName,
    chosenName: chosen?.name ?? "",
    objection,
    shownText,
    recordedAtIst,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  const docx = await consentCertificateDocx(lines);
  await prisma.$transaction(async (tx) => {
    const document = await tx.odrDocument.create({
      data: {
        caseId: found.id,
        bankId: found.bankId,
        kind: "CONSENT_CERTIFICATE",
        fileName: `Arbitrator_consent_${found.refNo}.docx`,
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        content: Uint8Array.from(docx),
        uploadedBy: "customer",
        uploaderName: typedName,
        note: "Recorded from the case page. Not edited after saving.",
      },
    });
    await tx.odrConsent.create({
      data: {
        caseId: found.id,
        bankId: found.bankId,
        choice: picked,
        typedName,
        chosenNeutralId: picked === "PANEL" ? chosen?.id ?? "" : "",
        chosenNeutralName: picked === "PANEL" ? chosen?.name ?? "" : "",
        objection: picked === "OBJECT" ? objection : "",
        shownText,
        recordedAt,
        recordedAtIst,
        ip: meta.ip,
        userAgent: meta.userAgent,
        documentId: document.id,
        respondentId,
        respondentName: expectedName,
      },
    });
    if (appointId) {
      await tx.odrNeutralService.upsert({
        where: { caseId_neutralId_role: { caseId: found.id, neutralId: appointId, role: "ARBITRATOR" } },
        create: { caseId: found.id, neutralId: appointId, role: "ARBITRATOR" },
        update: {},
      });
    }
    if (nextNeutral) {
      await tx.odrCase.update({
        where: { id: found.id },
        data: {
          neutralId: nextNeutral.id,
          neutralName: nextNeutral.name,
          neutralQualification: nextNeutral.qualification,
          neutralEnrolment: nextNeutral.enrolment,
          panelJson: panelJson([nextNeutral]),
        },
      });
      for (const hearing of moved) {
        await tx.odrHearing.update({ where: { id: hearing.id }, data: { scheduledAt: hearing.start } });
      }
      await tx.odrAlert.create({
        data: {
          caseId: found.id,
          bankId: found.bankId,
          kind: "CONSENT_PANEL",
          summary: `${expectedName} chose ${nextNeutral.name} on ${found.refNo}. The hearing time is on that arbitrator’s list.`,
        },
      });
    }
    await tx.odrAccessLog.create({
      data: {
        caseId: found.id,
        bankId: found.bankId,
        kind: "CONSENT",
        ip: meta.ip,
        userAgent: meta.userAgent,
        detail: picked,
      },
    });
  });
  if (nextNeutral) {
    const { syncCaseCalendarGuests } = await import("@/lib/odr-runner");
    await syncCaseCalendarGuests(prisma, found.id);
  }
  redirect(`/odr/c/${token}`);
}

export async function recordConciliationReply(_previous: PublicOdrState, formData: FormData): Promise<PublicOdrState> {
  const token = String(formData.get("token") ?? "");
  const found = await caseByToken(token);
  if (!found || !(await granted(found.id))) return { error: "Open the case again from your message." };
  if (resolveLegalRoute(found.legalRoute, found.matterType) !== "CONCILIATION") {
    return { error: "This invitation is for a conciliation case." };
  }
  const choice = String(formData.get("choice") ?? "");
  if (choice !== "ACCEPT" && choice !== "DECLINE") return { error: "Accept or decline the invitation." };
  const respondentId = found.viewer?.id ?? "";
  const existing = await prisma.odrRouteReply.findFirst({ where: { caseId: found.id, respondentId } });
  if (existing) return { error: "Your reply is already recorded." };
  const respondents = await prisma.odrRespondent.findMany({ where: { caseId: found.id }, select: { id: true, name: true } });
  const state = conciliationState({
    route: "CONCILIATION",
    now: new Date(),
    invitedAt: found.firstNoticeAt,
    parties: [
      { id: "", name: found.customerName, reply: null },
      ...respondents.map((party) => ({ id: party.id, name: party.name, reply: null })),
    ],
  });
  const due = found.firstNoticeAt ? new Date(found.firstNoticeAt.getTime() + CONCILIATION_REPLY_DAYS * 86400000) : null;
  if (due && Date.now() > due.getTime()) return { error: state.note || "The invitation has already been declined." };
  const recordedAt = new Date();
  await prisma.odrRouteReply.create({
    data: {
      caseId: found.id,
      bankId: found.bankId,
      respondentId,
      respondentName: found.viewer?.name || found.customerName,
      choice,
      recordedAt,
      recordedAtIst: istStamp(recordedAt),
    },
  });
  redirect(`/odr/c/${token}`);
}

export async function customerGrantMatches(caseId: string): Promise<boolean> {
  return granted(caseId);
}
