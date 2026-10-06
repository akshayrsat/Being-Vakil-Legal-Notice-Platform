// Staff actions for ODR. A bank user can look, not change a case.

"use server";

import { redirect } from "next/navigation";
import { auditCurrentUser } from "@/lib/audit";
import { getSessionContext } from "@/lib/auth";
import { requiredBankId } from "@/lib/bank-data";
import { workingBank } from "@/lib/bank-context";
import { prisma } from "@/lib/db";
import { isPdf, safePdfName } from "@/lib/odr-access";
import {
  mapOdrRows,
  odrMappingFromForm,
  parseOdrMapping,
  suggestOdrMapping,
  validateOdrMapping,
} from "@/lib/odr-fields";
import { SheetReadError, parseXlsx } from "@/lib/parse-xlsx";
import { ODR_NOT_SENT_DETAIL } from "@/lib/odr-live";
import { applyAttendance, processOdrWork, queueRespondentNotices, releaseArbitrationNotices, retryMeetLink, scheduleHearingRecord, refreshCaseAttendance } from "@/lib/odr-runner";
import { arbitrationNoticeError, arbitrationNoticeGaps } from "@/lib/odr-notice-gate";
import { partiesFromColumns, partyRole, withPartyAttendance } from "@/lib/odr-parties";
import { readOdrRules } from "@/lib/odr-store";
import { durationMinutes, generateRefNo, indiaDateTime, newPublicToken, normalizeRefNo } from "@/lib/odr-ref";
import { panelJson, parsePanel, type PanelMember } from "@/lib/odr-panel";
import { busyByNeutral, planBatchHearings } from "@/lib/odr-slot-store";
import { planSeats, readArbitratorChoice, readScheduleInput, rulesFromSchedule } from "@/lib/odr-slots";
import { isOdrDocumentKind, isOdrMatter, isOdrStage, isOdrStatus, terminalOdrStatus } from "@/lib/odr-status";
import { ODR_LIVE_SEND_SETTING_ID } from "@/lib/odr-live";
import { ODR_SETTINGS_ID, odrTemplateSlots, parseTemplateMap } from "@/lib/odr-templates";
import { templatesFor } from "@/lib/odr-templates";
import { canFlipLiveSend } from "@/lib/live-send-switch";
import { canSendNotices } from "@/lib/roles";
import { EMPTY_SHEET, keepMappedColumns, redactSheet } from "@/lib/data-min";
import { validSendWindow } from "@/lib/send-window";
import { STAFF_DOCUMENT_KINDS } from "@/lib/odr-status";

export type OdrFormState = { error: string } | null;

const MAX_BYTES = 5 * 1024 * 1024;

async function staffBank() {
  const current = await getSessionContext();
  if (!current) redirect("/login");
  if (!canSendNotices(current.user.role)) {
    return { ok: false as const, error: "Only the owner or a legal coordinator can change an ODR case." };
  }
  const bank = workingBank(current.user);
  if (!bank) return { ok: false as const, error: "Choose a bank before working on ODR." };
  if (!bank.active) return { ok: false as const, error: "This bank is inactive. Mark it active before filing an ODR case." };
  return { ok: true as const, bank, user: current.user };
}

export async function uploadOdrExcel(_previous: OdrFormState, formData: FormData): Promise<OdrFormState> {
  const scope = await staffBank();
  if (!scope.ok) return { error: scope.error };
  const matterType = String(formData.get("matterType") ?? "").trim().toUpperCase();
  if (!isOdrMatter(matterType)) return { error: "Choose Arbitration or Mediation before uploading." };
  const choice = readArbitratorChoice(formData);
  if (!choice.ok) return { error: choice.error };
  const found = await prisma.odrNeutral.findMany({ where: { id: { in: choice.ids }, active: true } });
  const neutrals = choice.ids.flatMap((id) => found.filter((neutral) => neutral.id === id));
  if (neutrals.length !== choice.ids.length) {
    return { error: "Choose the arbitrator or mediator. Add one first if the list is empty." };
  }
  const schedule = readScheduleInput(formData);
  if (!schedule.ok) return { error: schedule.error };
  if (schedule.schedule.start.getTime() < Date.now() - 60 * 1000) {
    return { error: "The first hearing time is already past." };
  }
  const rules = rulesFromSchedule(schedule.schedule);
  const probe = rules ? planSeats([{ key: "1", label: "Customer" }], choice.mode, rules, neutrals.map(() => [])) : null;
  if (!rules || !probe || !probe.ok) return { error: probe && !probe.ok ? probe.error : "Enter the hearing window again." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an Excel file (.xlsx)." };
  const fileName = file.name.trim().slice(0, 200);
  if (!fileName.toLowerCase().endsWith(".xlsx")) return { error: "Save the file as an Excel workbook (.xlsx) and try again." };
  if (file.size > MAX_BYTES) return { error: "That file is larger than 5 MB. Split it into a smaller workbook." };

  let parsed: { headers: string[]; rows: string[][] };
  try {
    parsed = await parseXlsx(Buffer.from(await file.arrayBuffer()));
  } catch (error) {
    if (error instanceof SheetReadError) return { error: error.message };
    throw error;
  }

  const stored = redactSheet(parsed.headers, parsed.rows);
  const batch = await prisma.odrBatch.create({
    data: {
      bankId: scope.bank.id,
      fileName,
      matterType,
      neutralId: neutrals[0]?.id ?? "",
      neutralName: neutrals.map((neutral) => neutral.name).join(", "),
      hearingAt: schedule.schedule.start,
      durationMinutes: schedule.schedule.durationMinutes,
      windowStart: schedule.schedule.windowStart,
      windowEnd: schedule.schedule.windowEnd,
      gapMinutes: schedule.schedule.gapMinutes,
      skipSundays: schedule.schedule.skipSundays,
      holidays: JSON.stringify(schedule.schedule.holidays),
      breakStart: schedule.schedule.breakStart,
      breakEnd: schedule.schedule.breakEnd,
      arbitratorMode: choice.mode,
      neutralIds: JSON.stringify(choice.ids),
      headers: JSON.stringify(stored.headers),
      rawRows: JSON.stringify(stored.rows),
      createdById: scope.user.id,
    },
  });
  await auditCurrentUser({
    action: "odr.upload",
    summary: `Uploaded ${fileName} for ${matterType === "MEDIATION" ? "mediation" : "arbitration"}.`,
    bankId: scope.bank.id,
    bankName: scope.bank.name,
    targetId: batch.id,
  });
  redirect(`/odr/uploads/${batch.id}`);
}

export async function saveOdrMapping(_previous: OdrFormState, formData: FormData): Promise<OdrFormState> {
  const scope = await staffBank();
  if (!scope.ok) return { error: scope.error };
  const batchId = String(formData.get("batchId") ?? "");
  const batch = await prisma.odrBatch.findFirst({ where: { id: batchId, bankId: scope.bank.id } });
  if (!batch) return { error: "That spreadsheet was not found for the bank you are working on." };
  if (batch.status !== "DRAFT") return { error: "This sheet was already sent." };
  let headers: string[] = [];
  try {
    headers = JSON.parse(batch.headers) as string[];
  } catch {
    return { error: "This saved spreadsheet could not be read. Upload it again." };
  }
  const mapping = odrMappingFromForm(formData);
  const problem = validateOdrMapping(mapping, headers);
  if (problem) return { error: problem };
  let rawRows: string[][] = [];
  try {
    rawRows = JSON.parse(batch.rawRows) as string[][];
  } catch {
    return { error: "This saved spreadsheet could not be read. Upload it again." };
  }
  const kept = keepMappedColumns(headers, rawRows, Object.values(mapping));
  await prisma.odrBatch.update({
    where: { id: batch.id },
    data: { mappingUsed: JSON.stringify(mapping), saved: true, headers: JSON.stringify(kept.headers), rawRows: JSON.stringify(kept.rows) },
  });
  await auditCurrentUser({
    action: "odr.mapping",
    summary: `Matched columns on ${batch.fileName}.`,
    bankId: scope.bank.id,
    bankName: scope.bank.name,
    targetId: batch.id,
  });
  redirect(`/odr/uploads/${batch.id}/preview`);
}

export async function confirmOdrBatch(previousOrForm: OdrFormState | FormData, maybeForm?: FormData): Promise<OdrFormState> {
  const formData = maybeForm ?? (previousOrForm instanceof FormData ? previousOrForm : null);
  if (!formData) return { error: "Choose the sheet again." };
  const scope = await staffBank();
  if (!scope.ok) return { error: scope.error };
  const batchId = String(formData.get("batchId") ?? "");
  const batch = await prisma.odrBatch.findFirst({ where: { id: batchId, bankId: scope.bank.id } });
  if (!batch || !batch.saved) return { error: "Match the columns before sending." };
  if (batch.status !== "DRAFT") return { error: "This sheet was already sent." };
  if (!isOdrMatter(batch.matterType)) return { error: "Choose Arbitration or Mediation before sending." };

  let headers: string[] = [];
  let rawRows: string[][] = [];
  try {
    headers = JSON.parse(batch.headers) as string[];
    rawRows = JSON.parse(batch.rawRows) as string[][];
  } catch {
    return { error: "This saved spreadsheet could not be read. Upload it again." };
  }
  const mapping = suggestOdrMapping(headers, parseOdrMapping(batch.mappingUsed));
  const mapped = mapOdrRows(headers, rawRows, mapping);
  const ready = mapped.filter((row) => row.problems.length === 0);
  if (ready.length === 0) return { error: "No row has a customer name and an account number with at least 4 digits." };

  const rules = await readOdrRules();
  const templates = templatesFor(rules.templates, batch.matterType, "first");
  const planned = await planBatchHearings(batch, ready.map((row) => ({
    key: String(row.rowNumber),
    label: row.customerName,
  })));
  if (!planned.ok) return { error: planned.error };
  const taken = new Set<string>();
  const existingRefs = await prisma.odrCase.findMany({ select: { refNo: true } });
  for (const row of existingRefs) taken.add(row.refNo);

  await prisma.odrBatch.update({ where: { id: batch.id }, data: { status: "SENDING", rowCount: ready.length } });

  for (const row of ready) {
    let refNo = normalizeRefNo(row.refNo);
    if (!refNo || taken.has(refNo)) refNo = generateRefNo(batch.matterType, taken);
    else taken.add(refNo);
    const seat = planned.seatFor(String(row.rowNumber));
    const created = await prisma.odrCase.create({
      data: {
        bankId: scope.bank.id,
        batchId: batch.id,
        rowNumber: row.rowNumber,
        refNo,
        matterType: batch.matterType,
        customerName: row.customerName,
        coParties: row.coParties,
        accountNumber: row.accountNumber,
        branch: row.branch,
        mobile: row.mobile,
        email: row.email,
        address: row.address,
        loanAmount: row.loanAmount,
        claimAmount: row.claimAmount,
        asOnDate: row.asOnDate,
        disputeSummary: row.disputeSummary,
        neutralId: seat.primary.id || null,
        neutralName: seat.name,
        neutralQualification: seat.primary.qualification,
        neutralEnrolment: seat.primary.enrolment,
        panelJson: panelJson(seat.panel),
        publicToken: newPublicToken(),
        status: "NOTICE_SENT",
      },
    });
    const parties = partiesFromColumns({
      coParties: row.coParties,
      slots: [
        { name: row.co1Name, role: row.co1Role, mobile: row.co1Mobile, email: row.co1Email, address: row.co1Address },
        { name: row.co2Name, role: row.co2Role, mobile: row.co2Mobile, email: row.co2Email, address: row.co2Address },
      ],
    });
    if (parties.length > 0) {
      await prisma.odrRespondent.createMany({
        data: parties.map((party, index) => ({
          caseId: created.id,
          bankId: scope.bank.id,
          name: party.name,
          role: party.role,
          mobile: party.mobile,
          email: party.email,
          address: party.address,
          publicToken: newPublicToken(),
          sortOrder: index,
        })),
      });
    }
    await scheduleHearingRecord(prisma, {
      caseId: created.id,
      bankId: scope.bank.id,
      matterType: batch.matterType,
      mobile: row.mobile,
      email: row.email,
      number: 1,
      scheduledAt: seat.start,
      durationMinutes: batch.durationMinutes,
      kind: "FIRST",
      live: rules.live,
      templates,
      actorName: scope.user.name,
      sendMessages: batch.matterType !== "ARBITRATION",
    });
  }

  await prisma.odrBatch.update({ where: { id: batch.id }, data: EMPTY_SHEET });
  await auditCurrentUser({
    action: "odr.send",
    summary: rules.live
      ? `Queued ${ready.length} ODR ${ready.length === 1 ? "case" : "cases"} from ${batch.fileName}.`
      : `Recorded ${ready.length} ODR ${ready.length === 1 ? "case" : "cases"} from ${batch.fileName}. ${ODR_NOT_SENT_DETAIL}.`,
    bankId: scope.bank.id,
    bankName: scope.bank.name,
    targetId: batch.id,
  });
  redirect(`/odr/batches/${batch.id}`);
}

export async function processOdrBatch(batchId: string): Promise<{
  done: boolean;
  pending: number;
  ready: number;
  skipped: number;
  failed: number;
  note: string;
  error?: string;
}> {
  const scope = await staffBank();
  if (!scope.ok) return { done: true, pending: 0, ready: 0, skipped: 0, failed: 0, note: "", error: scope.error };
  const batch = await prisma.odrBatch.findFirst({ where: { id: batchId, bankId: scope.bank.id }, select: { id: true } });
  if (!batch) return { done: true, pending: 0, ready: 0, skipped: 0, failed: 0, note: "", error: "That file was not found." };
  return processOdrWork(prisma, { bankId: scope.bank.id, batchId: batch.id, limit: 4 });
}

export async function saveNeutral(previousOrForm: OdrFormState | FormData, maybeForm?: FormData): Promise<OdrFormState> {
  const formData = maybeForm ?? (previousOrForm instanceof FormData ? previousOrForm : null);
  if (!formData) return { error: "Enter the name again." };
  const scope = await staffBank();
  if (!scope.ok) return { error: scope.error };
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  if (name.length < 3) return { error: "Enter the arbitrator or mediator’s name." };
  const qualification = String(formData.get("qualification") ?? "").trim().slice(0, 160);
  const enrolmentNo = String(formData.get("enrolmentNo") ?? "").trim().slice(0, 80);
  const neutral = await prisma.odrNeutral.create({ data: { name, qualification, enrolmentNo } });
  await auditCurrentUser({
    action: "odr.neutral",
    summary: `Added ${name} to the arbitrator list.`,
    bankId: scope.bank.id,
    bankName: scope.bank.name,
    targetId: neutral.id,
  });
  redirect("/odr/neutrals");
}

export async function updateOdrStatus(_previous: OdrFormState, formData: FormData): Promise<OdrFormState> {
  const scope = await staffBank();
  if (!scope.ok) return { error: scope.error };
  const caseId = String(formData.get("caseId") ?? "");
  const item = await prisma.odrCase.findFirst({ where: { id: caseId, bankId: requiredBankId(scope.bank.id) } });
  if (!item) return { error: "That case was not found for the bank you are working on." };
  const status = String(formData.get("status") ?? "").trim();
  if (!isOdrStatus(status)) return { error: "Choose a status." };
  const stage = String(formData.get("stage") ?? item.stage).trim();
  if (!isOdrStage(stage)) return { error: "Choose a stage." };
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);
  const mediation = item.matterType === "MEDIATION";
  const exParteFlag = !mediation && formData.get("exParte") === "on";
  let awardAt = item.awardAt;
  if (status === "AWARD_PASSED" && !awardAt) awardAt = new Date();
  let noShowCount = item.noShowCount;
  let flaggedExParte = mediation ? false : item.flaggedExParte || exParteFlag;
  const latestHearing =
    status === "NO_SHOW" || status === "JOINED"
      ? await prisma.odrHearing.findFirst({
          where: { caseId: item.id, bankId: scope.bank.id },
          orderBy: { number: "desc" },
        })
      : null;
  // A hearing record owns the count via applyAttendance. Increment here only when there is no hearing to attach.
  if (status === "NO_SHOW" && item.status !== "NO_SHOW" && !latestHearing) {
    const rules = await readOdrRules();
    noShowCount += 1;
    if (!mediation && noShowCount >= rules.maxNoShow) flaggedExParte = true;
  }
  const file = formData.get("file");
  let documentId = "";
  if (file instanceof File && file.size > 0) {
    const saved = await savePdf(file, {
      caseId: item.id,
      bankId: scope.bank.id,
      kind: String(formData.get("docKind") ?? "ORDER"),
      uploadedBy: scope.user.id,
      uploaderName: scope.user.name,
      note,
      allowed: STAFF_DOCUMENT_KINDS.map((kind) => kind.id),
    });
    if (!saved.ok) return { error: saved.error };
    documentId = saved.id;
  }
  await prisma.odrCase.update({
    where: { id: item.id },
    data: { status, stage, exParte: exParteFlag, noShowCount, flaggedExParte, awardAt },
  });
  await prisma.odrStatusEvent.create({
    data: {
      caseId: item.id,
      bankId: scope.bank.id,
      status,
      exParte: exParteFlag,
      note,
      documentId,
      actorId: scope.user.id,
      actorName: scope.user.name,
      actorRole: scope.user.role,
    },
  });
  if (latestHearing) {
    const rules = await readOdrRules();
    await applyAttendance(prisma, latestHearing, status === "JOINED" ? "JOINED" : "NO_SHOW", "staff", rules.maxNoShow);
  }
  await auditCurrentUser({
    action: "odr.status",
    summary: `Set ${item.refNo} to ${status}${exParteFlag ? " ex parte" : ""}${note ? `: ${note}` : ""}.`,
    bankId: scope.bank.id,
    bankName: scope.bank.name,
    targetId: item.id,
  });
  redirect(`/odr/cases/${item.id}`);
}

export async function uploadStaffDocument(_previous: OdrFormState, formData: FormData): Promise<OdrFormState> {
  const scope = await staffBank();
  if (!scope.ok) return { error: scope.error };
  const caseId = String(formData.get("caseId") ?? "");
  const item = await prisma.odrCase.findFirst({ where: { id: caseId, bankId: scope.bank.id } });
  if (!item) return { error: "That case was not found for the bank you are working on." };
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Choose a PDF." };
  const saved = await savePdf(file, {
    caseId: item.id,
    bankId: scope.bank.id,
    kind: String(formData.get("kind") ?? "OTHER"),
    uploadedBy: scope.user.id,
    uploaderName: scope.user.name,
    note: String(formData.get("note") ?? "").trim().slice(0, 300),
    allowed: STAFF_DOCUMENT_KINDS.map((kind) => kind.id),
  });
  if (!saved.ok) return { error: saved.error };
  await releaseArbitrationNotices(prisma, item.id);
  await auditCurrentUser({
    action: "odr.document",
    summary: `Added a document to ${item.refNo}.`,
    bankId: scope.bank.id,
    bankName: scope.bank.name,
    targetId: item.id,
  });
  redirect(`/odr/cases/${item.id}`);
}

export async function scheduleOneHearing(_previous: OdrFormState, formData: FormData): Promise<OdrFormState> {
  const scope = await staffBank();
  if (!scope.ok) return { error: scope.error };
  const caseId = String(formData.get("caseId") ?? "");
  const item = await prisma.odrCase.findFirst({
    where: { id: caseId, bankId: scope.bank.id },
    include: { hearings: true },
  });
  if (!item) return { error: "That case was not found for the bank you are working on." };
  if (terminalOdrStatus(item.status)) return { error: "This case is closed." };
  const when = indiaDateTime(String(formData.get("hearingDate") ?? ""), String(formData.get("hearingTime") ?? ""));
  if (!when || when.getTime() < Date.now()) return { error: "Enter a future date and time." };
  const duration = durationMinutes(String(formData.get("duration") ?? "60"));
  if (!duration) return { error: "Session length must be between 15 and 240 minutes." };
  const rules = await readOdrRules();
  const number = item.hearings.reduce((max, hearing) => Math.max(max, hearing.number), 0) + 1;
  const send = formData.get("send") === "on" && !item.flaggedExParte;
  if (send) {
    const missing = arbitrationNoticeGaps(item.matterType, (await prisma.odrDocument.findMany({
      where: { caseId: item.id },
      select: { kind: true },
    })).map((doc) => doc.kind));
    if (missing.length > 0) return { error: arbitrationNoticeError(missing) };
  }
  await scheduleHearingRecord(prisma, {
    caseId: item.id,
    bankId: scope.bank.id,
    matterType: item.matterType,
    mobile: item.mobile,
    email: item.email,
    number,
    scheduledAt: when,
    durationMinutes: duration,
    kind: "NEXT",
    live: rules.live,
    templates: templatesFor(rules.templates, item.matterType, "next"),
    actorName: scope.user.name,
    sendMessages: send,
  });
  await auditCurrentUser({
    action: "odr.hearing",
    summary: `Scheduled hearing ${number} for ${item.refNo}${send ? "" : " without a message"}.`,
    bankId: scope.bank.id,
    bankName: scope.bank.name,
    targetId: item.id,
  });
  redirect(`/odr/cases/${item.id}`);
}

export async function scheduleBulkHearings(_previous: OdrFormState, formData: FormData): Promise<OdrFormState> {
  const scope = await staffBank();
  if (!scope.ok) return { error: scope.error };
  const from = indiaDateTime(String(formData.get("fromDate") ?? ""), "00:00");
  const to = indiaDateTime(String(formData.get("fromDate") ?? ""), "23:59");
  if (!from || !to) return { error: "Choose the date of the no-show hearings." };
  const schedule = readScheduleInput(formData);
  if (!schedule.ok) return { error: schedule.error };
  if (schedule.schedule.start.getTime() < Date.now()) return { error: "Enter a future date and time for the next hearing." };
  const slotRules = rulesFromSchedule(schedule.schedule);
  if (!slotRules) return { error: "Enter the hearing window again." };
  const hearings = await prisma.odrHearing.findMany({
    where: {
      bankId: scope.bank.id,
      attendance: "NO_SHOW",
      scheduledAt: { gte: from, lte: to },
    },
    include: { case: { include: { hearings: true } } },
  });
  const rules = await readOdrRules();
  const seen = new Set<string>();
  const waiting: Array<{ hearing: (typeof hearings)[number]; panel: PanelMember[] }> = [];
  for (const hearing of hearings) {
    if (seen.has(hearing.caseId)) continue;
    seen.add(hearing.caseId);
    if (terminalOdrStatus(hearing.case.status)) continue;
    const future = hearing.case.hearings.some((row) => row.scheduledAt.getTime() > Date.now());
    if (future) continue;
    const panel = parsePanel(hearing.case.panelJson);
    const members = panel.length > 0
      ? panel
      : hearing.case.neutralId
        ? [{ id: hearing.case.neutralId, name: hearing.case.neutralName, qualification: hearing.case.neutralQualification, enrolment: hearing.case.neutralEnrolment }]
        : [];
    if (members.length === 0 || members.some((member) => !member.id)) {
      return { error: `${hearing.case.refNo} has no arbitrator, so the next hearing cannot be placed.` };
    }
    waiting.push({ hearing, panel: members });
  }
  if (waiting.length === 0) return { error: "No no-show cases on that date still need a hearing." };
  waiting.sort((a, b) =>
    a.hearing.scheduledAt.getTime() - b.hearing.scheduledAt.getTime()
    || a.hearing.case.customerName.localeCompare(b.hearing.case.customerName)
    || a.hearing.caseId.localeCompare(b.hearing.caseId));
  const groups = new Map<string, typeof waiting>();
  for (const item of waiting) {
    const key = item.panel.map((member) => member.id).sort().join("|");
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  const busy = await busyByNeutral(waiting.flatMap((item) => item.panel.map((member) => member.id)), slotRules.start);
  const placed: Array<{ item: (typeof waiting)[number]; start: Date }> = [];
  for (const group of groups.values()) {
    const members = group[0]?.panel ?? [];
    const planned = planSeats(
      group.map((item) => ({ key: item.hearing.caseId, label: item.hearing.case.customerName })),
      "PANEL",
      slotRules,
      members.map((member) => busy.get(member.id) ?? []),
    );
    if (!planned.ok) return { error: planned.error };
    for (const item of group) {
      const seat = planned.seats.find((row) => row.key === item.hearing.caseId);
      if (!seat) return { error: "A hearing time could not be placed." };
      placed.push({ item, start: seat.start });
    }
  }
  const blocked: string[] = [];
  for (const { item } of placed) {
    const missing = arbitrationNoticeGaps(
      item.hearing.case.matterType,
      (await prisma.odrDocument.findMany({ where: { caseId: item.hearing.caseId }, select: { kind: true } })).map((doc) => doc.kind),
    );
    if (missing.length > 0) blocked.push(`${item.hearing.case.refNo} (${missing.join(", ")})`);
  }
  if (blocked.length > 0) {
    return { error: `Hearing notices stay held until the papers are on file: ${blocked.join("; ")}.` };
  }
  let count = 0;
  for (const { item, start } of placed) {
    const number = item.hearing.case.hearings.reduce((max, row) => Math.max(max, row.number), 0) + 1;
    const send = !item.hearing.case.flaggedExParte;
    await scheduleHearingRecord(prisma, {
      caseId: item.hearing.caseId,
      bankId: scope.bank.id,
      matterType: item.hearing.case.matterType,
      mobile: item.hearing.case.mobile,
      email: item.hearing.case.email,
      number,
      scheduledAt: start,
      durationMinutes: schedule.schedule.durationMinutes,
      kind: "NEXT",
      live: rules.live,
      templates: templatesFor(rules.templates, item.hearing.case.matterType, "next"),
      actorName: scope.user.name,
      sendMessages: send,
    });
    count += 1;
  }
  await auditCurrentUser({
    action: "odr.hearing",
    summary: `Scheduled the next hearing for ${count} no-show ${count === 1 ? "case" : "cases"}.`,
    bankId: scope.bank.id,
    bankName: scope.bank.name,
  });
  redirect("/odr/queue");
}

export async function refreshAttendance(_previous: OdrFormState, formData: FormData): Promise<OdrFormState> {
  const scope = await staffBank();
  if (!scope.ok) return { error: scope.error };
  const caseId = String(formData.get("caseId") ?? "");
  const item = await prisma.odrCase.findFirst({ where: { id: caseId, bankId: scope.bank.id }, select: { id: true, refNo: true } });
  if (!item) return { error: "That case was not found for the bank you are working on." };
  const result = await refreshCaseAttendance(prisma, { bankId: scope.bank.id, caseId: item.id });
  await auditCurrentUser({
    action: "odr.attendance",
    summary: `Refreshed attendance for ${item.refNo}. ${result.note}`,
    bankId: scope.bank.id,
    bankName: scope.bank.name,
    targetId: item.id,
  });
  redirect(`/odr/cases/${item.id}?attendance=1`);
}

export async function retryHearingMeet(_previous: OdrFormState, formData: FormData): Promise<OdrFormState> {
  const scope = await staffBank();
  if (!scope.ok) return { error: scope.error };
  const hearingId = String(formData.get("hearingId") ?? "");
  const caseId = String(formData.get("caseId") ?? "");
  const ok = await retryMeetLink(prisma, hearingId, scope.bank.id);
  if (!ok) return { error: "That hearing was not found, or it already has a link." };
  redirect(`/odr/cases/${caseId}`);
}

export async function saveCasePartyInfo(_previous: OdrFormState, formData: FormData): Promise<OdrFormState> {
  const scope = await staffBank();
  if (!scope.ok) return { error: scope.error };
  const caseId = String(formData.get("caseId") ?? "");
  const item = await prisma.odrCase.findFirst({ where: { id: caseId, bankId: scope.bank.id }, select: { id: true } });
  if (!item) return { error: "That case was not found for the bank you are working on." };
  await prisma.odrCase.update({
    where: { id: item.id },
    data: {
      bankCounsel: String(formData.get("bankCounsel") ?? "").trim().slice(0, 160),
      bankContact: String(formData.get("bankContact") ?? "").trim().slice(0, 300),
      paymentInfo: String(formData.get("paymentInfo") ?? "").trim().slice(0, 500),
      claimReference: String(formData.get("claimReference") ?? "").trim().slice(0, 160),
      defenceDeadline: /^\d{4}-\d{2}-\d{2}$/.test(String(formData.get("defenceDeadline") ?? ""))
        ? String(formData.get("defenceDeadline"))
        : "",
    },
  });
  redirect(`/odr/cases/${item.id}`);
}

function partyInput(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim().slice(0, 160);
  const role = partyRole(String(formData.get("role") ?? ""));
  const mobile = String(formData.get("mobile") ?? "").trim().slice(0, 20);
  const email = String(formData.get("email") ?? "").trim().slice(0, 160);
  const address = String(formData.get("address") ?? "").trim().slice(0, 400);
  return { name, role, mobile, email, address };
}

export async function saveRespondent(_previous: OdrFormState, formData: FormData): Promise<OdrFormState> {
  const scope = await staffBank();
  if (!scope.ok) return { error: scope.error };
  const caseId = String(formData.get("caseId") ?? "");
  const item = await prisma.odrCase.findFirst({ where: { id: caseId, bankId: scope.bank.id }, select: { id: true, refNo: true } });
  if (!item) return { error: "That case was not found for the bank you are working on." };
  const party = partyInput(formData);
  if (party.name.length < 2) return { error: "Enter the co-borrower or guarantor’s name." };
  const respondentId = String(formData.get("respondentId") ?? "");
  if (respondentId) {
    const existing = await prisma.odrRespondent.findFirst({ where: { id: respondentId, caseId: item.id, bankId: scope.bank.id } });
    if (!existing) return { error: "That co-party was not found on this case." };
    await prisma.odrRespondent.update({ where: { id: existing.id }, data: party });
  } else {
    const count = await prisma.odrRespondent.count({ where: { caseId: item.id } });
    const created = await prisma.odrRespondent.create({
      data: {
        caseId: item.id,
        bankId: scope.bank.id,
        ...party,
        publicToken: newPublicToken(),
        sortOrder: count,
      },
    });
    await queueRespondentNotices(prisma, created.id);
  }
  await auditCurrentUser({
    action: "odr.respondent",
    summary: `${respondentId ? "Updated" : "Added"} ${party.name} (${party.role}) on ${item.refNo}.`,
    bankId: scope.bank.id,
    bankName: scope.bank.name,
    targetId: item.id,
  });
  redirect(`/odr/cases/${item.id}`);
}

export async function removeRespondent(_previous: OdrFormState, formData: FormData): Promise<OdrFormState> {
  const scope = await staffBank();
  if (!scope.ok) return { error: scope.error };
  const caseId = String(formData.get("caseId") ?? "");
  const respondentId = String(formData.get("respondentId") ?? "");
  const existing = await prisma.odrRespondent.findFirst({
    where: { id: respondentId, caseId, bankId: scope.bank.id },
    select: { id: true, name: true, case: { select: { refNo: true } } },
  });
  if (!existing) return { error: "That co-party was not found on this case." };
  await prisma.odrRespondent.delete({ where: { id: existing.id } });
  await auditCurrentUser({
    action: "odr.respondent",
    summary: `Removed ${existing.name} from ${existing.case.refNo}.`,
    bankId: scope.bank.id,
    bankName: scope.bank.name,
    targetId: caseId,
  });
  redirect(`/odr/cases/${caseId}`);
}

export async function setPartyAttendance(_previous: OdrFormState, formData: FormData): Promise<OdrFormState> {
  const scope = await staffBank();
  if (!scope.ok) return { error: scope.error };
  const caseId = String(formData.get("caseId") ?? "");
  const hearingId = String(formData.get("hearingId") ?? "");
  const respondentId = String(formData.get("respondentId") ?? "");
  const attendance = String(formData.get("attendance") ?? "");
  if (attendance !== "JOINED" && attendance !== "NO_SHOW") return { error: "Choose joined or no-show." };
  const hearing = await prisma.odrHearing.findFirst({ where: { id: hearingId, caseId, bankId: scope.bank.id } });
  const party = await prisma.odrRespondent.findFirst({ where: { id: respondentId, caseId, bankId: scope.bank.id } });
  if (!hearing || !party) return { error: "That hearing or co-party was not found." };
  await prisma.odrHearing.update({
    where: { id: hearing.id },
    data: { partyAttendance: withPartyAttendance(hearing.partyAttendance, party.id, attendance) },
  });
  redirect(`/odr/cases/${caseId}`);
}

export async function setOdrLiveSwitch(_previous: OdrFormState, formData: FormData): Promise<OdrFormState> {
  const current = await getSessionContext();
  if (!current) redirect("/login");
  if (!canFlipLiveSend(current.user.role)) return { error: "Only the owner can change ODR sending." };
  const value = String(formData.get("enabled") ?? "");
  if (value !== "on" && value !== "off") return { error: "Choose on or off." };
  const enabled = value === "on";
  await prisma.odrLiveSendSetting.upsert({
    where: { id: ODR_LIVE_SEND_SETTING_ID },
    create: { id: ODR_LIVE_SEND_SETTING_ID, enabled },
    update: { enabled },
  });
  await auditCurrentUser({
    action: "odr.settings",
    summary: enabled
      ? "Turned the ODR switch on. Messages go out only when ODR_LIVE_SEND is also true."
      : "Turned the ODR switch off. ODR messages are recorded as not sent.",
    bankId: null,
    bankName: "",
  });
  redirect("/settings?saved=odr-send");
}

export async function saveOdrSettings(_previous: OdrFormState, formData: FormData): Promise<OdrFormState> {
  const current = await getSessionContext();
  if (!current) redirect("/login");
  if (!canFlipLiveSend(current.user.role)) return { error: "Only the owner can change ODR templates." };
  const existing = await prisma.odrSettings.findUnique({ where: { id: ODR_SETTINGS_ID } });
  const currentMap = parseTemplateMap(existing?.templatesJson);
  const editsIds = formData.has("arbitration.first.sms");
  if (editsIds) {
    for (const slot of odrTemplateSlots()) {
      currentMap[slot] = {
        smsFlowId: String(formData.get(`${slot}.sms`) ?? "").trim().slice(0, 80),
        emailTemplateId: String(formData.get(`${slot}.email`) ?? "").trim().slice(0, 80),
        whatsappTemplate: String(formData.get(`${slot}.whatsapp`) ?? "").trim().slice(0, 80),
      };
    }
  }
  const maxNoShow = Number(formData.get("maxNoShow"));
  const autoRescheduleDays = Number(formData.get("autoRescheduleDays"));
  const reminderDaysBefore = Number(formData.get("reminderDaysBefore"));
  const reminderHoursBefore = Number(formData.get("reminderHoursBefore"));
  if (!Number.isInteger(maxNoShow) || maxNoShow < 1 || maxNoShow > 10) return { error: "Maximum no-shows must be from 1 to 10." };
  if (!Number.isInteger(autoRescheduleDays) || autoRescheduleDays < 0 || autoRescheduleDays > 60) {
    return { error: "Auto-reschedule days must be from 0 to 60. Use 0 to keep it off." };
  }
  const sendWindowStart = String(formData.get("sendWindowStart") ?? "").trim();
  const sendWindowEnd = String(formData.get("sendWindowEnd") ?? "").trim();
  const maxRemindersPerHearing = Number(formData.get("maxRemindersPerHearing"));
  const maxMessagesPerDay = Number(formData.get("maxMessagesPerDay"));
  if (!/^\d{2}:\d{2}$/.test(sendWindowStart) || !/^\d{2}:\d{2}$/.test(sendWindowEnd) || !validSendWindow(sendWindowStart, sendWindowEnd)) {
    return { error: "Send hours must be a clock time, and the start must be earlier than the end." };
  }
  if (!Number.isInteger(maxRemindersPerHearing) || maxRemindersPerHearing < 1 || maxRemindersPerHearing > 5) {
    return { error: "Automatic reminders per hearing must be from 1 to 5." };
  }
  if (!Number.isInteger(maxMessagesPerDay) || maxMessagesPerDay < 1 || maxMessagesPerDay > 5) {
    return { error: "Messages per customer per day must be from 1 to 5." };
  }
  const sheetRetentionDays = Number(formData.get("sheetRetentionDays"));
  const closedDataRetentionDays = Number(formData.get("closedDataRetentionDays"));
  if (!Number.isInteger(sheetRetentionDays) || sheetRetentionDays < 1 || sheetRetentionDays > 3650) {
    return { error: "Spreadsheet retention must be from 1 to 3650 days." };
  }
  if (!Number.isInteger(closedDataRetentionDays) || closedDataRetentionDays < 0 || closedDataRetentionDays > 3650) {
    return { error: "Closed-case retention must be 0 (off) or from 1 to 3650 days." };
  }
  const windowFields = {
    sendWindowStart,
    sendWindowEnd,
    maxRemindersPerHearing,
    maxMessagesPerDay,
    sheetRetentionDays,
    closedDataRetentionDays,
  };
  await prisma.odrSettings.upsert({
    where: { id: ODR_SETTINGS_ID },
    create: {
      id: ODR_SETTINGS_ID,
      templatesJson: JSON.stringify(currentMap),
      maxNoShow,
      autoRescheduleDays,
      reminderDaysBefore: Number.isInteger(reminderDaysBefore) ? reminderDaysBefore : 1,
      reminderHoursBefore: Number.isInteger(reminderHoursBefore) ? reminderHoursBefore : 1,
      reminderDayOn: formData.get("reminderDayOn") === "on",
      reminderHourOn: formData.get("reminderHourOn") === "on",
      ...windowFields,
    },
    update: {
      templatesJson: JSON.stringify(currentMap),
      maxNoShow,
      autoRescheduleDays,
      reminderDaysBefore: Number.isInteger(reminderDaysBefore) ? reminderDaysBefore : 1,
      reminderHoursBefore: Number.isInteger(reminderHoursBefore) ? reminderHoursBefore : 1,
      reminderDayOn: formData.get("reminderDayOn") === "on",
      reminderHourOn: formData.get("reminderHourOn") === "on",
      ...windowFields,
    },
  });
  await auditCurrentUser({
    action: "odr.settings",
    summary: "Updated ODR templates, reminders, and the no-show rule.",
    bankId: null,
    bankName: "",
  });
  redirect("/settings?saved=odr");
}

async function savePdf(
  file: File,
  input: {
    caseId: string;
    bankId: string;
    kind: string;
    uploadedBy: string;
    uploaderName: string;
    note: string;
    allowed: string[];
  },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!input.allowed.includes(input.kind) || !isOdrDocumentKind(input.kind)) {
    return { ok: false, error: "Choose the kind of document." };
  }
  if (file.size > MAX_BYTES) return { ok: false, error: "That PDF is larger than 5 MB." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isPdf(bytes)) return { ok: false, error: "Upload a PDF file." };
  const saved = await prisma.odrDocument.create({
    data: {
      caseId: input.caseId,
      bankId: input.bankId,
      kind: input.kind,
      fileName: safePdfName(file.name),
      content: Buffer.from(bytes),
      uploadedBy: input.uploadedBy,
      uploaderName: input.uploaderName,
      note: input.note,
    },
  });
  return { ok: true, id: saved.id };
}
