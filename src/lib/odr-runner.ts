// Queued ODR work: Meet links, then messages, a few people at a time.
// Attendance, reminders, and optional auto-reschedule run from the same helpers.

import type { PrismaClient } from "@prisma/client";
import { prisma } from "./db";
import { noticePublicBaseUrl } from "./notice-link";
import { deliverOdrChannel, type OdrDeliveryResult } from "./odr-dispatch";
import { ODR_NOT_SENT_DETAIL } from "./odr-live";
import {
  createHearingMeet,
  fetchMeetParticipants,
  guestVisitsFromParticipants,
  impersonatedAccessToken,
  readMeetConfig,
  attendanceFromParticipants,
  updateHearingMeetGuests,
  type MeetLinkResult,
} from "./odr-meet";
import { autoSendAllowed, nextNoShowState, planOdrChannels, type ChannelPlan } from "./odr-plan";
import {
  formatHearingDate,
  formatHearingTime,
  hearingOrdinal,
  hearingTitle,
  newPublicToken,
} from "./odr-ref";
import { addIndiaDays } from "./odr-ref";
import {
  autoRescheduleAt,
  dueReminderKeys,
  hearingHasEnded,
  parseReminderKeys,
} from "./odr-schedule";
import { readOdrRules, sendWindowFromRules, type OdrRules } from "./odr-store";
import { parsePanel } from "./odr-panel";
import { hearingMessageText, templatesFor, type OdrTemplateKind } from "./odr-templates";
import { arbitrationNoticeError, arbitrationNoticeGaps } from "./odr-notice-gate";
import { releaseHeldNoticeSends } from "./notice-release";
import { canQueueReminder, dayHold, istDayBounds, pickReminderChannel, windowHold, type SendWindow } from "./send-window";
import { CLOSED_CASE_BLANK, EMPTY_SHEET, closedCaseExpired, sheetExpired } from "./data-min";
import { grievanceFooter, grievanceFromBank, withGrievanceFooter } from "./grievance";
import { noticeRecipients } from "./odr-parties";
import { terminalOdrStatus } from "./odr-status";
import {
  INVITES_NOT_SENT,
  neutralHearsCase,
  parseInvitedGuests,
  scheduleDigestDue,
  scheduleDigestPlan,
  scheduleEmailBody,
  selectHearingGuests,
  validGuestEmail,
} from "./odr-guests";
import { contactsForHearing, indianMobileDigits } from "./odr-neutral";

const CLAIM = "CREATING";
const STALE_MS = 2 * 60 * 1000;

export type OdrProgress = {
  done: boolean;
  pending: number;
  ready: number;
  skipped: number;
  failed: number;
  note: string;
};

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export type OdrDeps = {
  now: Date;
  live: boolean;
  rules: OdrRules;
  fetchImpl?: FetchLike;
  createMeet: (input: Parameters<typeof createHearingMeet>[0]) => Promise<MeetLinkResult>;
  deliver: (input: Parameters<typeof deliverOdrChannel>[0]) => Promise<OdrDeliveryResult>;
};

export function casePageUrl(token: string): string {
  return `${noticePublicBaseUrl()}/odr/c/${token}`;
}

export function staffCaseUrl(caseId: string): string {
  return `${noticePublicBaseUrl()}/odr/cases/${caseId}`;
}

export async function defaultDeps(db: PrismaClient, now = new Date()): Promise<OdrDeps> {
  const rules = await readOdrRules(db);
  const config = readMeetConfig();
  return {
    now,
    live: rules.live,
    rules,
    createMeet: (input) => createHearingMeet({ ...input, config, fetchImpl: fetch }),
    deliver: (input) => deliverOdrChannel({ ...input, live: rules.live }),
  };
}

export async function processOdrWork(
  db: PrismaClient = prisma,
  options?: { bankId?: string; batchId?: string; limit?: number; deps?: OdrDeps },
): Promise<OdrProgress> {
  const deps = options?.deps ?? (await defaultDeps(db));
  const limit = options?.limit ?? 4;
  const bankId = options?.bankId?.trim() || "";
  const batchId = options?.batchId?.trim() || "";
  await releaseStaleClaims(db, deps.now, bankId);

  const hearings = await db.odrHearing.findMany({
    where: {
      meetLink: "",
      meetError: "",
      ...(bankId ? { bankId } : {}),
      ...(batchId ? { case: { batchId } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: { case: true },
  });

  for (const hearing of hearings) {
    const claim = await db.odrHearing.updateMany({
      where: { id: hearing.id, meetLink: "", meetError: "" },
      data: { meetError: CLAIM },
    });
    if (claim.count !== 1) continue;
    const selection = await loadHearingGuests(db, hearing.case, deps.live);
    const meet = await deps.createMeet({
      config: readMeetConfig(),
      title: hearingTitle({
        bank: await bankName(db, hearing.bankId),
        customer: hearing.case.customerName,
        refNo: hearing.case.refNo,
        number: hearing.number,
      }),
      description: `Case page: ${casePageUrl(hearing.case.publicToken)}`,
      start: hearing.scheduledAt,
      durationMinutes: hearing.durationMinutes,
      requestId: `${hearing.id}-${hearing.number}`,
      guests: selection.guests,
      invitesLive: deps.live,
    });
    if (!meet.ok) {
      await db.odrHearing.update({ where: { id: hearing.id }, data: { meetError: meet.error } });
      continue;
    }
    await db.odrHearing.update({
      where: { id: hearing.id },
      data: {
        meetLink: meet.link,
        meetFake: meet.fake,
        meetError: "",
        calendarEventId: meet.eventId,
        meetingCode: meet.meetingCode,
        guestInviteNote: hearingInviteNote(deps.live, meet.fake, selection.inviteNote, meet.inviteNote),
        spaceName: meet.spaceName,
        invitedGuests: JSON.stringify(deps.live ? selection.guests : []),
      },
    });
  }

  const sendWindow = sendWindowFromRules(deps.rules);
  const queued = await db.odrMessage.findMany({
    where: {
      status: "QUEUED",
      AND: [{ OR: [{ notBefore: null }, { notBefore: { lte: deps.now } }] }],
      ...(bankId ? { bankId } : {}),
      ...(batchId ? { case: { batchId } } : {}),
      hearing: { meetLink: { not: "" } },
    },
    orderBy: { createdAt: "asc" },
    take: limit * 3,
    include: { hearing: true, case: { include: { bank: true, documents: { select: { kind: true } } } } },
  });

  let ready = 0;
  let skipped = 0;
  let failed = 0;
  for (const message of queued) {
    const claim = await db.odrMessage.updateMany({
      where: { id: message.id, status: "QUEUED" },
      data: { status: "SENDING" },
    });
    if (claim.count !== 1 || !message.hearing) continue;
    const held = await messageHold(db, {
      now: deps.now,
      window: sendWindow,
      caseId: message.caseId,
      messageId: message.id,
      maxPerDay: deps.rules.maxMessagesPerDay,
      toAddress: message.toAddress,
    });
    if (held) {
      await db.odrMessage.update({
        where: { id: message.id },
        data: { status: "QUEUED", notBefore: held.notBefore, detail: held.detail },
      });
      continue;
    }
    const noticeGaps = arbitrationNoticeGaps(message.case.matterType, message.case.documents.map((doc) => doc.kind));
    if (noticeGaps.length > 0) {
      await db.odrMessage.update({
        where: { id: message.id },
        data: { status: "QUEUED", detail: arbitrationNoticeError(noticeGaps) },
      });
      continue;
    }
    const kind = message.kind === "NEXT" || message.kind === "REMINDER" ? message.kind.toLowerCase() as OdrTemplateKind : "first";
    const panel = parsePanel(message.case.panelJson);
    const text = hearingMessageText({
      customer: message.case.customerName,
      bank: message.case.bank.name,
      number: message.case.refNo,
      date: formatHearingDate(message.hearing.scheduledAt),
      time: formatHearingTime(message.hearing.scheduledAt),
      meetLink: message.hearing.meetLink,
      caseLink: casePageUrl(message.case.publicToken),
      ordinal: message.kind === "FIRST" ? "first" : hearingOrdinal(message.hearing.number),
      matterType: message.case.matterType,
      legalRoute: message.case.legalRoute,
      kind,
      panelCount: panel.length,
      arbitratorName: panel.length > 0 ? panel.map((member) => member.name).join(", ") : message.case.neutralName,
      claimReference: message.case.claimReference,
      defenceDeadline: message.case.defenceDeadline,
    });
    const party = message.respondentId
      ? await db.odrRespondent.findFirst({ where: { id: message.respondentId, caseId: message.caseId } })
      : null;
    const partyText = party
      ? hearingMessageText({
          customer: party.name,
          bank: message.case.bank.name,
          number: message.case.refNo,
          date: formatHearingDate(message.hearing.scheduledAt),
          time: formatHearingTime(message.hearing.scheduledAt),
          meetLink: message.hearing.meetLink,
          caseLink: casePageUrl(party.publicToken),
          ordinal: message.kind === "FIRST" ? "first" : hearingOrdinal(message.hearing.number),
          matterType: message.case.matterType,
          legalRoute: message.case.legalRoute,
          kind,
          panelCount: panel.length,
          arbitratorName: panel.length > 0 ? panel.map((member) => member.name).join(", ") : message.case.neutralName,
          claimReference: message.case.claimReference,
          defenceDeadline: message.case.defenceDeadline,
        })
      : text;
    const noticeText = withGrievanceFooter(party ? partyText : text, grievanceFromBank(message.case.bank));
    const templates = templatesFor(deps.rules.templates, message.case.matterType, kind);
    const templateId =
      message.channel === "SMS"
        ? templates.smsFlowId
        : message.channel === "EMAIL"
          ? templates.emailTemplateId
          : templates.whatsappTemplate;
    let result: OdrDeliveryResult;
    try {
      result = await deps.deliver({
        live: deps.live,
        channel: message.channel as "SMS" | "EMAIL" | "WHATSAPP",
        to: message.toAddress,
        templateId,
        vars: {
          customer: message.case.customerName,
          bank: message.case.bank.name,
          number: message.case.refNo,
          date: formatHearingDate(message.hearing.scheduledAt),
          time: formatHearingTime(message.hearing.scheduledAt),
          link: message.hearing.meetLink,
          caseLink: party ? casePageUrl(party.publicToken) : casePageUrl(message.case.publicToken),
          grievance: grievanceFooter(grievanceFromBank(message.case.bank)),
        },
      });
    } catch {
      result = { ok: false, skipped: false, detail: "The send stopped before it was accepted." };
    }
    if (result.ok) {
      ready += 1;
      await db.odrMessage.update({
        where: { id: message.id },
        data: { status: "SENT", detail: result.detail, providerId: result.providerId, messageText: noticeText },
      });
    } else if (result.skipped) {
      skipped += 1;
      await db.odrMessage.update({
        where: { id: message.id },
        data: { status: "SKIPPED", detail: result.detail, messageText: noticeText },
      });
    } else {
      failed += 1;
      await db.odrMessage.update({
        where: { id: message.id },
        data: { status: "FAILED", detail: result.detail, messageText: noticeText },
      });
    }
  }

  const pending = await countPending(db, bankId, batchId);
  if (batchId && pending === 0) {
    await db.odrBatch.updateMany({ where: { id: batchId, status: "SENDING" }, data: { status: "COMPLETED" } });
  }
  return {
    done: pending === 0,
    pending,
    ready,
    skipped,
    failed,
    note: pending === 0 ? "Finished." : "Working through the list.",
  };
}

async function bankName(db: PrismaClient, bankId: string): Promise<string> {
  const bank = await db.bank.findUnique({ where: { id: bankId }, select: { name: true } });
  return bank?.name ?? "Bank";
}

async function loadHearingGuests(
  db: PrismaClient,
  item: { bankId: string; neutralId: string | null; neutralName: string; panelJson: string },
  live: boolean,
) {
  const panel = parsePanel(item.panelJson);
  const ids = [...new Set([item.neutralId ?? "", ...panel.map((member) => member.id)].filter(Boolean))];
  const neutrals = ids.length
    ? await db.odrNeutral.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } })
    : [];
  const byId = new Map(neutrals.map((neutral) => [neutral.id, neutral]));
  const reps = await db.bankRepresentative.findMany({
    where: { bankId: item.bankId },
    orderBy: { sortOrder: "asc" },
    select: { name: true, email: true },
  });
  const assignedRow = item.neutralId ? byId.get(item.neutralId) : undefined;
  return selectHearingGuests({
    live,
    panel: panel.map((member) => {
      const row = byId.get(member.id);
      return { id: member.id, name: row?.name || member.name, email: row?.email ?? "" };
    }),
    assigned: { name: assignedRow?.name || item.neutralName, email: assignedRow?.email ?? "" },
    representatives: reps,
  });
}

export async function syncCaseCalendarGuests(db: PrismaClient, caseId: string): Promise<void> {
  const item = await db.odrCase.findUnique({ where: { id: caseId }, include: { hearings: true } });
  if (!item) return;
  const rules = await readOdrRules(db);
  const selection = await loadHearingGuests(db, item, rules.live);
  const config = readMeetConfig();
  for (const hearing of item.hearings) {
    if (!hearing.calendarEventId) {
      if (!rules.live) {
        await db.odrHearing.update({
          where: { id: hearing.id },
          data: { guestInviteNote: INVITES_NOT_SENT, invitedGuests: "[]" },
        });
      }
      continue;
    }
    const result = await updateHearingMeetGuests({
      config,
      eventId: hearing.calendarEventId,
      meetingCode: hearing.meetingCode,
      start: hearing.scheduledAt,
      durationMinutes: hearing.durationMinutes,
      guests: selection.guests,
      invitesLive: rules.live,
    });
    await db.odrHearing.update({
      where: { id: hearing.id },
      data: {
        guestInviteNote: result.ok ? result.inviteNote : result.error,
        spaceName: result.ok && result.spaceName ? result.spaceName : hearing.spaceName,
        invitedGuests: JSON.stringify(rules.live ? selection.guests : []),
      },
    });
  }
}

export async function syncBankCalendarGuests(db: PrismaClient, bankId: string): Promise<void> {
  const hearings = await db.odrHearing.findMany({
    where: { bankId, calendarEventId: { not: "" }, scheduledAt: { gt: new Date() } },
    select: { caseId: true },
  });
  for (const caseId of [...new Set(hearings.map((hearing) => hearing.caseId))]) {
    await syncCaseCalendarGuests(db, caseId);
  }
}

export async function syncNeutralCalendarGuests(db: PrismaClient, neutralId: string): Promise<void> {
  const hearings = await db.odrHearing.findMany({
    where: { calendarEventId: { not: "" }, scheduledAt: { gt: new Date() } },
    select: { caseId: true, case: { select: { neutralId: true, panelJson: true } } },
  });
  const caseIds = new Set<string>();
  for (const hearing of hearings) {
    const panelIds = parsePanel(hearing.case.panelJson).map((member) => member.id);
    if (neutralHearsCase(neutralId, panelIds, hearing.case.neutralId ?? "")) caseIds.add(hearing.caseId);
  }
  for (const caseId of caseIds) await syncCaseCalendarGuests(db, caseId);
}

function hearingInviteNote(live: boolean, fake: boolean, selectionNote: string, meetNote: string): string {
  if (!live) return INVITES_NOT_SENT;
  if (fake) return meetNote;
  if (!meetNote || meetNote === selectionNote) return selectionNote;
  return `${selectionNote} ${meetNote}`.replace(/\s+/g, " ").trim();
}

async function sendArbitratorDigests(db: PrismaClient, deps: OdrDeps): Promise<number> {
  if (!scheduleDigestDue(deps.now)) return 0;
  const { start, end } = istDayBounds(deps.now);
  const hearings = await db.odrHearing.findMany({
    where: { scheduledAt: { gte: start, lt: end } },
    include: { case: { include: { bank: true } } },
    orderBy: { scheduledAt: "asc" },
    take: 200,
  });
  const neutrals = await db.odrNeutral.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  const templateId = (process.env.ODR_SCHEDULE_EMAIL_TEMPLATE_ID ?? "").trim();
  const plan = scheduleDigestPlan({ live: deps.live, templateId });
  let recorded = 0;
  for (const neutral of neutrals) {
    if (!neutral.email.includes("@")) continue;
    const rows = hearings.filter((hearing) => neutralHearsCase(
      neutral.id,
      parsePanel(hearing.case.panelJson).map((member) => member.id),
      hearing.case.neutralId ?? "",
    ));
    if (rows.length === 0) continue;
    const already = await db.odrMessage.findFirst({
      where: { kind: "SCHEDULE", channel: "EMAIL", toAddress: neutral.email, createdAt: { gte: start, lt: end } },
      select: { id: true },
    });
    if (already) continue;
    const first = rows[0]!;
    const body = scheduleEmailBody({
      arbitratorName: neutral.name,
      day: formatHearingDate(deps.now),
      rows: rows.map((hearing) => ({
        customerName: hearing.case.customerName,
        refNo: hearing.case.refNo,
        time: formatHearingTime(hearing.scheduledAt),
        meetLink: hearing.meetLink,
        caseUrl: staffCaseUrl(hearing.caseId),
      })),
    });
    let status = "SKIPPED";
    let detail = plan.detail;
    if (plan.send) {
      const result = await deps.deliver({
        live: true,
        channel: "EMAIL",
        to: neutral.email,
        templateId,
        vars: {
          customer: neutral.name,
          bank: first.case.bank.name,
          number: first.case.refNo,
          date: formatHearingDate(first.scheduledAt),
          time: formatHearingTime(first.scheduledAt),
          link: first.meetLink || "Meet link not ready",
          caseLink: staffCaseUrl(first.caseId),
          schedule: body,
        },
      });
      status = result.ok ? "SENT" : "FAILED";
      detail = result.detail;
    }
    await db.odrMessage.create({
      data: {
        caseId: first.caseId,
        hearingId: first.id,
        bankId: first.bankId,
        channel: "EMAIL",
        kind: "SCHEDULE",
        toAddress: neutral.email,
        status,
        detail,
        messageText: body,
      },
    });
    recorded += 1;
  }
  return recorded;
}

async function countPending(db: PrismaClient, bankId: string, batchId: string): Promise<number> {
  const hearingWhere = {
    meetLink: "",
    meetError: "",
    ...(bankId ? { bankId } : {}),
    ...(batchId ? { case: { batchId } } : {}),
  };
  const messageWhere = {
    status: { in: ["QUEUED", "SENDING"] },
    ...(bankId ? { bankId } : {}),
    ...(batchId ? { case: { batchId } } : {}),
  };
  const [hearings, messages] = await Promise.all([
    db.odrHearing.count({ where: hearingWhere }),
    db.odrMessage.count({ where: messageWhere }),
  ]);
  return hearings + messages;
}

async function releaseStaleClaims(db: PrismaClient, now: Date, bankId: string): Promise<void> {
  const staleBefore = new Date(now.getTime() - STALE_MS);
  await db.odrHearing.updateMany({
    where: { meetError: CLAIM, updatedAt: { lt: staleBefore }, ...(bankId ? { bankId } : {}) },
    data: { meetError: "" },
  });
  await db.odrMessage.updateMany({
    where: { status: "SENDING", updatedAt: { lt: staleBefore }, ...(bankId ? { bankId } : {}) },
    data: { status: "QUEUED", detail: "" },
  });
}

export async function retryMeetLink(db: PrismaClient, hearingId: string, bankId: string): Promise<boolean> {
  const updated = await db.odrHearing.updateMany({
    where: { id: hearingId, bankId, meetLink: "" },
    data: { meetError: "" },
  });
  return updated.count === 1;
}

export async function refreshCaseAttendance(
  db: PrismaClient,
  input: { bankId: string; caseId: string; deps?: OdrDeps },
): Promise<{ updated: number; note: string }> {
  const deps = input.deps ?? (await defaultDeps(db));
  const hearings = await db.odrHearing.findMany({
    where: { caseId: input.caseId, bankId: input.bankId, attendanceSource: { not: "staff" } },
    include: { case: true },
  });
  let updated = 0;
  let note = "Attendance is unchanged.";
  for (const hearing of hearings) {
    if (!hearingHasEnded(hearing.scheduledAt, hearing.durationMinutes, deps.now)) continue;
    if (hearing.meetFake || !hearing.meetingCode) {
      note = "This hearing uses a practice Meet link. Mark Joined or No-show yourself.";
      continue;
    }
    const config = readMeetConfig();
    const access = await impersonatedAccessToken({ config, fetchImpl: deps.fetchImpl ?? fetch });
    if (!access) {
      note = "Google Meet could not be authorised, so attendance was not changed.";
      continue;
    }
    const participants = await fetchMeetParticipants({
      meetingCode: hearing.meetingCode,
      accessToken: access,
      fetchImpl: deps.fetchImpl,
    });
    if (!participants.ok) {
      note = participants.error;
      continue;
    }
    const attendance = attendanceFromParticipants({
      customerName: hearing.case.customerName,
      customerEmail: hearing.case.email,
      participants: participants.participants,
    });
    const visits = guestVisitsFromParticipants({
      guests: parseInvitedGuests(hearing.invitedGuests),
      participants: participants.participants,
    });
    await db.odrHearing.update({ where: { id: hearing.id }, data: { guestAttendance: JSON.stringify(visits) } });
    const applied = await applyAttendance(db, hearing, attendance, "auto", deps.rules.maxNoShow);
    if (applied) updated += 1;
    note = attendance === "JOINED" ? "Marked Joined from Meet." : "Marked No-show from Meet.";
  }
  return { updated, note };
}

export async function applyAttendance(
  db: PrismaClient,
  hearing: { id: string; caseId: string; bankId: string; attendance: string },
  attendance: "JOINED" | "NO_SHOW",
  source: "auto" | "staff",
  maxNoShow: number,
): Promise<boolean> {
  if (hearing.attendance === attendance && source === "auto") return false;
  await db.odrHearing.update({
    where: { id: hearing.id },
    data: { attendance, attendanceSource: source },
  });
  const current = await db.odrCase.findFirst({ where: { id: hearing.caseId, bankId: hearing.bankId } });
  if (!current || terminalOdrStatus(current.status)) return true;
  if (attendance === "JOINED") {
    await db.odrCase.update({ where: { id: current.id }, data: { status: "JOINED" } });
    return true;
  }
  if (hearing.attendance === "NO_SHOW") {
    await db.odrCase.update({ where: { id: current.id }, data: { status: "NO_SHOW" } });
    return true;
  }
  const next = nextNoShowState({ noShowCount: current.noShowCount, maxNoShow, matterType: current.matterType });
  await db.odrCase.update({
    where: { id: current.id },
    data: {
      status: "NO_SHOW",
      noShowCount: next.noShowCount,
      flaggedExParte: false,
      ...(current.matterType === "MEDIATION" ? { exParte: false } : {}),
    },
  });
  if (next.considerFinalOpportunity) {
    await db.odrAlert.create({
      data: {
        caseId: current.id,
        bankId: current.bankId,
        kind: "FINAL_OPPORTUNITY",
        summary: `Consider a final opportunity notice for ${current.refNo}.`,
      },
    });
  }
  return true;
}

async function purgeExpiredPersonalData(
  db: PrismaClient,
  now: Date,
  rules: { sheetRetentionDays: number; closedDataRetentionDays: number },
): Promise<void> {
  const sheets = [
    ...(await db.odrBatch.findMany({
      where: { NOT: { rawRows: "[]" } },
      select: { id: true, createdAt: true },
      take: 40,
    })),
  ];
  for (const sheet of sheets) {
    if (!sheetExpired(sheet.createdAt, now, rules.sheetRetentionDays)) continue;
    await db.odrBatch.update({ where: { id: sheet.id }, data: EMPTY_SHEET });
  }
  const uploads = await db.uploadBatch.findMany({
    where: { NOT: { rawRows: "[]" } },
    select: { id: true, createdAt: true },
    take: 40,
  });
  for (const sheet of uploads) {
    if (!sheetExpired(sheet.createdAt, now, rules.sheetRetentionDays)) continue;
    await db.uploadBatch.update({ where: { id: sheet.id }, data: EMPTY_SHEET });
  }
  if (rules.closedDataRetentionDays < 1) return;
  const closed = await db.odrCase.findMany({
    where: {
      status: { in: ["CLOSED", "SETTLED", "AWARD_PASSED"] },
      NOT: { customerName: "" },
    },
    select: { id: true, updatedAt: true },
    take: 40,
  });
  for (const item of closed) {
    if (!closedCaseExpired(item.updatedAt, now, rules.closedDataRetentionDays)) continue;
    await db.odrCase.update({ where: { id: item.id }, data: CLOSED_CASE_BLANK });
    await db.odrRespondent.deleteMany({ where: { caseId: item.id } });
  }
}

export async function runOdrMaintenance(
  db: PrismaClient = prisma,
  deps?: OdrDeps,
): Promise<{ reminders: number; rescheduled: number; attendance: number; schedules: number }> {
  const liveDeps = deps ?? (await defaultDeps(db));
  const attendance = await refreshEndedAttendance(db, liveDeps);
  const reminders = await sendDueReminders(db, liveDeps);
  const rescheduled = await autoRescheduleNoShows(db, liveDeps);
  const schedules = await sendArbitratorDigests(db, liveDeps);
  await releaseHeldNoticeSends(liveDeps.now);
  await purgeExpiredPersonalData(db, liveDeps.now, liveDeps.rules);
  await processOdrWork(db, { limit: 6, deps: liveDeps });
  return { reminders, rescheduled, attendance, schedules };
}

async function refreshEndedAttendance(db: PrismaClient, deps: OdrDeps): Promise<number> {
  const hearings = await db.odrHearing.findMany({
    where: { attendance: "PENDING", attendanceSource: { not: "staff" }, meetFake: false, meetingCode: { not: "" } },
    include: { case: true },
    take: 30,
  });
  let updated = 0;
  const config = readMeetConfig();
  for (const hearing of hearings) {
    if (!hearingHasEnded(hearing.scheduledAt, hearing.durationMinutes, deps.now)) continue;
    const access = await impersonatedAccessToken({ config, fetchImpl: deps.fetchImpl ?? fetch });
    if (!access) continue;
    const participants = await fetchMeetParticipants({
      meetingCode: hearing.meetingCode,
      accessToken: access,
      fetchImpl: deps.fetchImpl,
    });
    if (!participants.ok) continue;
    const attendance = attendanceFromParticipants({
      customerName: hearing.case.customerName,
      customerEmail: hearing.case.email,
      participants: participants.participants,
    });
    const visits = guestVisitsFromParticipants({
      guests: parseInvitedGuests(hearing.invitedGuests),
      participants: participants.participants,
    });
    await db.odrHearing.update({ where: { id: hearing.id }, data: { guestAttendance: JSON.stringify(visits) } });
    if (await applyAttendance(db, hearing, attendance, "auto", deps.rules.maxNoShow)) updated += 1;
  }
  return updated;
}

async function sendDueReminders(db: PrismaClient, deps: OdrDeps): Promise<number> {
  const upcoming = await db.odrHearing.findMany({
    where: { scheduledAt: { gt: deps.now }, meetLink: { not: "" } },
    include: { case: { include: { bank: true } } },
    take: 40,
  });
  let created = 0;
  for (const hearing of upcoming) {
    if (terminalOdrStatus(hearing.case.status)) continue;
    if (!autoSendAllowed({
      flaggedExParte: hearing.case.flaggedExParte,
      noShowCount: hearing.case.noShowCount,
      maxNoShow: deps.rules.maxNoShow,
    })) {
      continue;
    }
    const keys = dueReminderKeys({
      now: deps.now,
      scheduledAt: hearing.scheduledAt,
      sent: parseReminderKeys(hearing.remindersSent),
      rule: {
        dayOn: deps.rules.reminderDayOn,
        hourOn: deps.rules.reminderHourOn,
        daysBefore: deps.rules.reminderDaysBefore,
        hoursBefore: deps.rules.reminderHoursBefore,
      },
    });
    if (keys.length === 0) continue;
    const already = await db.odrMessage.count({
      where: { hearingId: hearing.id, kind: "REMINDER", status: { not: "SKIPPED" } },
    });
    if (!canQueueReminder(already, deps.rules.maxRemindersPerHearing)) {
      const sentKeys = [...parseReminderKeys(hearing.remindersSent), ...keys];
      await db.odrHearing.update({ where: { id: hearing.id }, data: { remindersSent: JSON.stringify(sentKeys) } });
      continue;
    }
    const parties = await db.odrRespondent.findMany({
      where: { caseId: hearing.caseId },
      orderBy: { sortOrder: "asc" },
    });
    const templates = templatesFor(deps.rules.templates, hearing.case.matterType, "reminder");
    const window = sendWindowFromRules(deps.rules);
    let queued = 0;
    for (const person of noticeRecipients({
      mobile: hearing.case.mobile,
      email: hearing.case.email,
      parties,
    })) {
      const plans = planOdrChannels({
        live: deps.live,
        mobile: person.mobile,
        email: person.email,
        templates,
      });
      const chosen = pickReminderChannel(plans);
      if (!chosen) continue;
      const usedToday = await messagesUsedToday(db, hearing.caseId, deps.now, "", chosen.to);
      const held = windowHold(deps.now, window).hold
        ? windowHold(deps.now, window)
        : dayHold(deps.now, window, usedToday, deps.rules.maxMessagesPerDay);
      await queueMessages(db, {
        caseId: hearing.caseId,
        hearingId: hearing.id,
        bankId: hearing.bankId,
        matterType: hearing.case.matterType,
        mobile: person.mobile,
        email: person.email,
        kind: "REMINDER",
        live: deps.live,
        templates,
        plans: [chosen],
        notBefore: held.hold ? held.notBefore : null,
        detail: held.hold ? held.detail : "",
        respondentId: person.respondentId,
      });
      queued += 1;
    }
    queued += await queueArbitratorNotices(db, {
      caseId: hearing.caseId,
      hearingId: hearing.id,
      bankId: hearing.bankId,
      matterType: hearing.case.matterType,
      neutralId: hearing.case.neutralId,
      panelJson: hearing.case.panelJson,
      kind: "REMINDER",
      live: deps.live,
      templates,
      now: deps.now,
      window,
      maxPerDay: deps.rules.maxMessagesPerDay,
    });
    if (queued === 0) continue;
    const sent = [...parseReminderKeys(hearing.remindersSent), ...keys];
    await db.odrHearing.update({ where: { id: hearing.id }, data: { remindersSent: JSON.stringify(sent) } });
    created += queued;
  }
  return created;
}

async function autoRescheduleNoShows(db: PrismaClient, deps: OdrDeps): Promise<number> {
  if (deps.rules.autoRescheduleDays < 1) return 0;
  const cases = await db.odrCase.findMany({
    where: { status: "NO_SHOW", flaggedExParte: false },
    include: { hearings: true, bank: true },
    take: 30,
  });
  let created = 0;
  for (const item of cases) {
    if (!autoSendAllowed({
      flaggedExParte: item.flaggedExParte,
      noShowCount: item.noShowCount,
      maxNoShow: deps.rules.maxNoShow,
    })) {
      continue;
    }
    const future = item.hearings.some((hearing) => hearing.scheduledAt.getTime() > deps.now.getTime());
    if (future) continue;
    const last = [...item.hearings].sort((a, b) => a.number - b.number).at(-1);
    if (!last) continue;
    const when = autoRescheduleAt(last.scheduledAt, deps.rules.autoRescheduleDays);
    if (!when || when.getTime() <= deps.now.getTime()) continue;
    await scheduleHearingRecord(db, {
      caseId: item.id,
      bankId: item.bankId,
      matterType: item.matterType,
      mobile: item.mobile,
      email: item.email,
      number: last.number + 1,
      scheduledAt: when,
      durationMinutes: last.durationMinutes,
      kind: "NEXT",
      live: deps.live,
      templates: templatesFor(deps.rules.templates, item.matterType, "next"),
      actorName: "Auto-reschedule",
    });
    created += 1;
  }
  return created;
}

export async function releaseArbitrationNotices(db: PrismaClient, caseId: string): Promise<void> {
  const item = await db.odrCase.findUnique({
    where: { id: caseId },
    include: {
      documents: { select: { kind: true } },
      hearings: { include: { messages: { select: { kind: true } } } },
    },
  });
  if (!item) return;
  if (arbitrationNoticeGaps(item.matterType, item.documents.map((doc) => doc.kind)).length > 0) return;
  const rules = await readOdrRules(db);
  const parties = await db.odrRespondent.findMany({ where: { caseId: item.id }, orderBy: { sortOrder: "asc" } });
  for (const hearing of item.hearings) {
    const kind = hearing.number === 1 ? "FIRST" : "NEXT";
    if (hearing.messages.some((message) => message.kind === "FIRST" || message.kind === "NEXT")) continue;
    const templates = templatesFor(rules.templates, item.matterType, hearing.number === 1 ? "first" : "next");
    for (const person of noticeRecipients({ mobile: item.mobile, email: item.email, parties })) {
      await queueMessages(db, {
        caseId: item.id,
        hearingId: hearing.id,
        bankId: item.bankId,
        matterType: item.matterType,
        mobile: person.mobile,
        email: person.email,
        kind,
        live: rules.live,
        templates,
        respondentId: person.respondentId,
      });
    }
    await queueArbitratorNotices(db, {
      caseId: item.id,
      hearingId: hearing.id,
      bankId: item.bankId,
      matterType: item.matterType,
      neutralId: item.neutralId,
      panelJson: item.panelJson,
      kind,
      live: rules.live,
      templates,
    });
  }
}

export async function queueRespondentNotices(db: PrismaClient, respondentId: string): Promise<void> {
  const party = await db.odrRespondent.findUnique({ where: { id: respondentId } });
  if (!party) return;
  const item = await db.odrCase.findUnique({
    where: { id: party.caseId },
    include: {
      documents: { select: { kind: true } },
      hearings: { include: { messages: { select: { kind: true, respondentId: true } } } },
    },
  });
  if (!item) return;
  if (arbitrationNoticeGaps(item.matterType, item.documents.map((doc) => doc.kind)).length > 0) return;
  const rules = await readOdrRules(db);
  for (const hearing of item.hearings) {
    const kind = hearing.number === 1 ? "FIRST" : "NEXT";
    const sent = hearing.messages.some((message) => message.kind === "FIRST" || message.kind === "NEXT");
    if (!sent) continue;
    if (hearing.messages.some((message) => message.respondentId === party.id && (message.kind === "FIRST" || message.kind === "NEXT"))) {
      continue;
    }
    await queueMessages(db, {
      caseId: item.id,
      hearingId: hearing.id,
      bankId: item.bankId,
      matterType: item.matterType,
      mobile: party.mobile,
      email: party.email,
      kind,
      live: rules.live,
      templates: templatesFor(rules.templates, item.matterType, hearing.number === 1 ? "first" : "next"),
      respondentId: party.id,
    });
  }
}

async function queueArbitratorNotices(
  db: PrismaClient,
  input: {
    caseId: string;
    hearingId: string;
    bankId: string;
    matterType: string;
    neutralId: string | null;
    panelJson: string;
    kind: "FIRST" | "NEXT" | "REMINDER";
    live: boolean;
    templates: { smsFlowId: string; emailTemplateId: string; whatsappTemplate: string };
    now?: Date;
    window?: SendWindow;
    maxPerDay?: number;
  },
): Promise<number> {
  const panel = parsePanel(input.panelJson);
  const ids = [...new Set([input.neutralId ?? "", ...panel.map((member) => member.id)].filter(Boolean))];
  if (ids.length === 0) return 0;
  const saved = await db.odrNeutral.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, email: true, mobile: true },
  });
  const people = contactsForHearing({
    panelIds: panel.map((member) => member.id),
    assignedId: input.neutralId ?? "",
    saved,
  }).filter((person) => validGuestEmail(person.email) || Boolean(indianMobileDigits(person.mobile)));
  let queued = 0;
  for (const person of people) {
    const plans = planOdrChannels({
      live: input.live,
      mobile: person.mobile,
      email: person.email,
      templates: input.templates,
    }).filter((plan) => plan.channel !== "WHATSAPP");
    let notBefore: Date | null = null;
    let detail = "";
    if (input.now && input.window && input.maxPerDay !== undefined) {
      const outside = windowHold(input.now, input.window);
      if (outside.hold) {
        notBefore = outside.notBefore;
        detail = outside.detail;
      } else {
        const address = plans.find((plan) => plan.status === "QUEUED")?.to ?? person.email;
        const usedToday = await messagesUsedToday(db, input.caseId, input.now, "", address);
        const capped = dayHold(input.now, input.window, usedToday, input.maxPerDay);
        if (capped.hold) {
          notBefore = capped.notBefore;
          detail = capped.detail;
        }
      }
    }
    await queueMessages(db, {
      caseId: input.caseId,
      hearingId: input.hearingId,
      bankId: input.bankId,
      matterType: input.matterType,
      mobile: person.mobile,
      email: person.email,
      kind: input.kind,
      live: input.live,
      templates: input.templates,
      plans,
      notBefore,
      detail,
      respondentId: `neutral:${person.id}`,
    });
    queued += plans.length;
  }
  return queued;
}

export async function queueMessages(
  db: PrismaClient,
  input: {
    caseId: string;
    hearingId: string;
    bankId: string;
    matterType: string;
    mobile: string;
    email: string;
    kind: "FIRST" | "NEXT" | "REMINDER";
    live: boolean;
    templates: { smsFlowId: string; emailTemplateId: string; whatsappTemplate: string };
    plans?: ChannelPlan[];
    notBefore?: Date | null;
    detail?: string;
    respondentId?: string;
  },
): Promise<void> {
  const plans = input.plans ?? planOdrChannels({
    live: input.live,
    mobile: input.mobile,
    email: input.email,
    templates: input.templates,
  });
  await db.odrMessage.createMany({
    data: plans.map((plan) => ({
      caseId: input.caseId,
      hearingId: input.hearingId,
      bankId: input.bankId,
      channel: plan.channel,
      kind: input.kind,
      toAddress: plan.to,
      respondentId: input.respondentId ?? "",
      status: plan.status,
      notBefore: plan.status === "QUEUED" ? input.notBefore ?? null : null,
      detail: plan.status === "QUEUED" && input.detail
        ? input.detail
        : plan.detail || (plan.status === "SKIPPED" ? ODR_NOT_SENT_DETAIL : ""),
    })),
  });
}

async function messageHold(
  db: PrismaClient,
  input: { now: Date; window: SendWindow; caseId: string; messageId: string; maxPerDay: number; toAddress: string },
): Promise<{ notBefore: Date; detail: string } | null> {
  const outside = windowHold(input.now, input.window);
  if (outside.hold) return { notBefore: outside.notBefore, detail: outside.detail };
  const used = await messagesUsedToday(db, input.caseId, input.now, input.messageId, input.toAddress);
  const capped = dayHold(input.now, input.window, used, input.maxPerDay);
  if (capped.hold) return { notBefore: capped.notBefore, detail: capped.detail };
  return null;
}

async function messagesUsedToday(db: PrismaClient, caseId: string, now: Date, excludeId: string, toAddress = ""): Promise<number> {
  const { start, end } = istDayBounds(now);
  return db.odrMessage.count({
    where: {
      caseId,
      ...(toAddress ? { toAddress } : {}),
      ...(excludeId ? { id: { not: excludeId } } : {}),
      OR: [
        { status: "SENT", updatedAt: { gte: start, lt: end } },
        { status: "SENDING" },
        { status: "QUEUED", notBefore: { gte: start, lt: end } },
      ],
    },
  });
}

export async function scheduleHearingRecord(
  db: PrismaClient,
  input: {
    caseId: string;
    bankId: string;
    matterType: string;
    mobile: string;
    email: string;
    number: number;
    scheduledAt: Date;
    durationMinutes: number;
    kind: "FIRST" | "NEXT";
    live: boolean;
    templates: { smsFlowId: string; emailTemplateId: string; whatsappTemplate: string };
    actorName: string;
    sendMessages?: boolean;
  },
): Promise<string> {
  const hearing = await db.odrHearing.create({
    data: {
      caseId: input.caseId,
      bankId: input.bankId,
      number: input.number,
      scheduledAt: input.scheduledAt,
      durationMinutes: input.durationMinutes,
    },
  });
  const send = input.sendMessages !== false;
  if (send) {
    const parties = await db.odrRespondent.findMany({ where: { caseId: input.caseId }, orderBy: { sortOrder: "asc" } });
    for (const person of noticeRecipients({ mobile: input.mobile, email: input.email, parties })) {
      await queueMessages(db, {
        ...input,
        hearingId: hearing.id,
        kind: input.kind,
        mobile: person.mobile,
        email: person.email,
        respondentId: person.respondentId,
      });
    }
    const item = await db.odrCase.findUnique({
      where: { id: input.caseId },
      select: { neutralId: true, panelJson: true },
    });
    if (item) {
      await queueArbitratorNotices(db, {
        caseId: input.caseId,
        hearingId: hearing.id,
        bankId: input.bankId,
        matterType: input.matterType,
        neutralId: item.neutralId,
        panelJson: item.panelJson,
        kind: input.kind,
        live: input.live,
        templates: input.templates,
      });
    }
  }
  await db.odrCase.update({
    where: { id: input.caseId },
    data: { status: input.number === 1 ? "HEARING_SCHEDULED" : "NEXT_DATE_GIVEN" },
  });
  await db.odrStatusEvent.create({
    data: {
      caseId: input.caseId,
      bankId: input.bankId,
      status: input.number === 1 ? "HEARING_SCHEDULED" : "NEXT_DATE_GIVEN",
      note: input.number === 1 ? "First hearing scheduled." : `Hearing ${input.number} scheduled.`,
      actorName: input.actorName,
    },
  });
  return hearing.id;
}

export function placeholderToken(): string {
  return newPublicToken();
}

export { addIndiaDays };
