"use server";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { redirect } from "next/navigation";
import { auditCurrentUser } from "@/lib/audit";
import { getSessionContext } from "@/lib/auth";
import { requiredBankId } from "@/lib/bank-data";
import { workingBank } from "@/lib/bank-context";
import { prisma } from "@/lib/db";
import { renderDocx } from "@/lib/odr-docx";
import { parsePanel } from "@/lib/odr-panel";
import { isPdf, safePdfName } from "@/lib/odr-access";
import {
  aadhaarLast4,
  composeModel,
  fieldsFor,
  flagsFor,
  exParteAwardError,
  missingAwardRates,
  parsePaper,
  seatFromBatch,
  type PaperCase,
  type PaperKind,
  type PaperRow,
  type PaperStore,
} from "@/lib/odr-paper";
import { canSendNotices } from "@/lib/roles";
import { appointmentParagraph, istDayKey } from "@/lib/odr-consent";
import { loadAppointmentConsent, storedConsent } from "@/lib/odr-consent-store";
import { conciliationDocumentsReady, instalmentMonthSpan, outcomeKind, resolveLegalRoute, settlementGuard } from "@/lib/odr-route";

export type PaperFormState = { error: string } | null;

const MAX_BYTES = 5 * 1024 * 1024;
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

async function staffBank() {
  const current = await getSessionContext();
  if (!current) redirect("/login");
  if (!canSendNotices(current.user.role)) return { ok: false as const, error: "Only the owner or a legal coordinator can prepare an award or settlement." };
  const bank = workingBank(current.user);
  if (!bank) return { ok: false as const, error: "Choose a bank before preparing a document." };
  return { ok: true as const, bank, user: current.user };
}

function kindOf(value: string): PaperKind | null {
  if (value === "award" || value === "settlement") return value;
  return null;
}

function readRows(raw: string): PaperRow[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is PaperRow => !!item && typeof item === "object")
      .map((item) => {
        const row: PaperRow = {};
        for (const [key, value] of Object.entries(item)) {
          if (typeof value !== "string") continue;
          row[key] = key.includes("aadhaar") ? aadhaarLast4(value) : value.trim().slice(0, 500);
        }
        return row;
      })
      .filter((row) => Object.values(row).some(Boolean));
  } catch {
    return [];
  }
}

function readStore(formData: FormData, kind: PaperKind): PaperStore {
  const fields: Record<string, string> = {};
  for (const field of fieldsFor(kind)) {
    const value = String(formData.get(field.key) ?? "").trim().slice(0, 4000);
    fields[field.key] = field.key.includes("aadhaar") ? aadhaarLast4(value) : value;
  }
  for (const flag of flagsFor(kind)) fields[flag.key] = formData.get(flag.key) === "true" ? "true" : "false";
  return {
    saved: true,
    fields,
    coRespondents: readRows(String(formData.get("coRespondents") ?? "[]")),
    obligors: readRows(String(formData.get("obligors") ?? "[]")),
    instalments: readRows(String(formData.get("instalments") ?? "[]")),
    deliveries: readRows(String(formData.get("deliveries") ?? "[]")),
  };
}

async function loadCase(caseId: string, bankId: string) {
  return prisma.odrCase.findFirst({
    where: { id: caseId, bankId: requiredBankId(bankId) },
    include: {
      bank: true,
      hearings: { orderBy: { number: "asc" } },
      respondents: { orderBy: { sortOrder: "asc" }, select: { name: true, role: true, mobile: true, email: true, address: true } },
      messages: { orderBy: { createdAt: "asc" } },
      documents: { orderBy: { createdAt: "asc" }, select: { kind: true, fileName: true, createdAt: true } },
      consents: { orderBy: { createdAt: "asc" }, take: 1 },
      accessLogs: { where: { kind: "OPEN" }, select: { id: true } },
    },
  });
}

function toPaperCase(
  item: NonNullable<Awaited<ReturnType<typeof loadCase>>>,
  speedPosts: PaperCase["speedPosts"],
  agreementSeat = "",
): PaperCase {
  return {
    matterType: item.matterType,
    refNo: item.refNo,
    customerName: item.customerName,
    coParties: item.coParties,
    respondents: item.respondents,
    accountNumber: item.accountNumber,
    branch: item.branch,
    mobile: item.mobile,
    email: item.email,
    address: item.address,
    loanAmount: item.loanAmount,
    claimAmount: item.claimAmount,
    asOnDate: item.asOnDate,
    neutralName: item.neutralName,
    neutralQualification: item.neutralQualification,
    neutralEnrolment: item.neutralEnrolment,
    panel: parsePanel(item.panelJson),
    exParte: item.exParte,
    flaggedExParte: item.flaggedExParte,
    bankCounsel: item.bankCounsel,
    paymentInfo: item.paymentInfo,
    bankName: item.bank.name,
    advocateName: item.advocateName,
    opens: item.accessLogs.length,
    hearings: item.hearings,
    messages: item.messages,
    documents: item.documents,
    speedPosts,
    agreementSeat,
    ...appointmentFields(item),
  };
}

function appointmentFields(item: {
  neutralName: string;
  nominatedNeutralName: string;
  documents: Array<{ kind: string }>;
  consents: Array<{
    choice: string;
    typedName: string;
    chosenNeutralId: string;
    chosenNeutralName: string;
    objection: string;
    shownText: string;
    recordedAt: Date;
    recordedAtIst: string;
  }>;
}): Pick<PaperCase, "appointmentParagraph" | "appointmentDate"> {
  const consent = storedConsent(item.consents[0] ?? null);
  const paragraph = appointmentParagraph({
    consent,
    documentKinds: item.documents.map((doc) => doc.kind),
    arbitratorName: item.neutralName,
    nominatedName: item.nominatedNeutralName,
  });
  const dated = consent && (consent.choice === "ACCEPT" || consent.choice === "PANEL") ? istDayKey(consent.recordedAt) : "";
  return { appointmentParagraph: paragraph, appointmentDate: dated };
}

export async function saveOdrPaper(_previous: PaperFormState, formData: FormData): Promise<PaperFormState> {
  const scope = await staffBank();
  if (!scope.ok) return { error: scope.error };
  const kind = kindOf(String(formData.get("kind") ?? ""));
  if (!kind) return { error: "Choose an award or a settlement agreement." };
  const caseId = String(formData.get("caseId") ?? "");
  const item = await loadCase(caseId, scope.bank.id);
  if (!item) return { error: "That case was not found for the bank you are working on." };
  const route = resolveLegalRoute(item.legalRoute, item.matterType);
  const outcome = outcomeKind(route, item.matterType);
  if (kind === "award" && outcome !== "award") return { error: "An award is prepared for an arbitration case." };
  if (kind === "settlement" && outcome !== "settlement" && outcome !== "conciliation") {
    return { error: "A settlement agreement is prepared for mediation or conciliation." };
  }
  const store = readStore(formData, kind);
  if (kind === "award") store.fields.arbitrator_entered_by = scope.user.name;
  await prisma.odrCase.update({ where: { id: item.id }, data: { paperJson: JSON.stringify(store) } });
  const generate = formData.get("intent") === "generate";
  if (generate && kind === "award") {
    const missing = missingAwardRates(store.fields);
    if (missing) return { error: missing };
    const blocked = exParteAwardError({
      exParte: store.fields.ex_parte === "true" || item.exParte,
      documents: item.documents.map((doc) => doc.kind),
    });
    if (blocked) return { error: blocked };
    const appointment = await loadAppointmentConsent(item);
    if (appointment.awardBlocked) return { error: appointment.warning };
  }
  if (generate && kind === "settlement") {
    if (!store.fields.ots_sanction_ref?.trim()) store.fields.ots_sanction_ref = item.settlementSanctionRef;
    const months = Math.max(
      item.settlementInstalmentMonths,
      instalmentMonthSpan(store.instalments.map((row) => row.instalment_due_date ?? "")),
    );
    const guard = settlementGuard({ sanctionRef: store.fields.ots_sanction_ref ?? "", instalmentMonths: months });
    if (guard.error) return { error: guard.error };
    if (outcome === "conciliation") {
      const missing = conciliationDocumentsReady(item.documents.map((doc) => doc.kind));
      if (missing) return { error: missing };
    }
  }
  if (!generate) {
    await auditCurrentUser({
      action: "odr.paper",
      summary: `Saved the ${kind === "award" ? "award" : "settlement"} answers for ${item.refNo}.`,
      bankId: scope.bank.id,
      bankName: scope.bank.name,
      targetId: item.id,
    });
    redirect(`/odr/cases/${item.id}/paper?kind=${kind}&saved=1`);
  }

  const posts = item.accountNumber
    ? await prisma.speedPostConsignment.findMany({
        where: { bankId: scope.bank.id, loanNumber: item.accountNumber },
        take: 30,
      })
    : [];
  const batch = await prisma.odrBatch.findFirst({
    where: { id: item.batchId, bankId: scope.bank.id },
    select: { headers: true, rawRows: true },
  });
  const model = composeModel(
    toPaperCase(
      item,
      posts.map((post) => ({
        articleNumber: post.articleNumber,
        status: post.status,
        createdAt: post.createdAt,
        customerName: post.customerName,
      })),
      batch ? seatFromBatch(batch.headers, batch.rawRows, item.rowNumber) : "",
    ),
    store,
    kind,
  );
  const fileName = kind === "award"
    ? "Arbitral_Award_Template.docx"
    : outcome === "conciliation"
      ? "Conciliation_Settlement_Template.docx"
      : "Settlement_Agreement_Template.docx";
  const template = await readFile(path.join(process.cwd(), "templates", "odr", fileName));
  const bytes = await renderDocx(template, model);
  const draftKind = kind === "award" ? "AWARD_DRAFT" : "SETTLEMENT_DRAFT";
  const version = (await prisma.odrDocument.count({ where: { caseId: item.id, bankId: scope.bank.id, kind: draftKind } })) + 1;
  const label = kind === "award" ? "Award" : "Settlement";
  await prisma.odrDocument.create({
    data: {
      caseId: item.id,
      bankId: scope.bank.id,
      kind: draftKind,
      fileName: `${label} v${version}.docx`,
      mimeType: DOCX,
      content: Uint8Array.from(bytes),
      uploadedBy: scope.user.id,
      uploaderName: scope.user.name,
      note: `v${version}`,
    },
  });
  await auditCurrentUser({
    action: "odr.paper",
    summary: `Prepared ${label} v${version} for ${item.refNo}. It was not sent.`,
    bankId: scope.bank.id,
    bankName: scope.bank.name,
    targetId: item.id,
  });
  redirect(`/odr/cases/${item.id}`);
}

function isDocx(bytes: Uint8Array, name: string): boolean {
  return name.toLowerCase().endsWith(".docx") && bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

export async function uploadSignedPaper(_previous: PaperFormState, formData: FormData): Promise<PaperFormState> {
  const scope = await staffBank();
  if (!scope.ok) return { error: scope.error };
  const caseId = String(formData.get("caseId") ?? "");
  const item = await prisma.odrCase.findFirst({ where: { id: caseId, bankId: requiredBankId(scope.bank.id) } });
  if (!item) return { error: "That case was not found for the bank you are working on." };
  const which = String(formData.get("which") ?? "");
  const signedKind = which === "award" ? "AWARD_SIGNED" : which === "settlement" ? "SETTLEMENT_SIGNED" : "";
  if (!signedKind) return { error: "Choose the signed award or the signed settlement." };
  const signedRoute = resolveLegalRoute(item.legalRoute, item.matterType);
  const signedOutcome = outcomeKind(signedRoute, item.matterType);
  if (signedKind === "AWARD_SIGNED" && signedOutcome !== "award") return { error: "A signed award belongs on an arbitration case." };
  if (signedKind === "SETTLEMENT_SIGNED" && signedOutcome !== "settlement" && signedOutcome !== "conciliation") {
    return { error: "A signed settlement belongs on a mediation or conciliation case." };
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose the signed file." };
  if (file.size > MAX_BYTES) return { error: "That file is larger than 5 MB." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = isPdf(bytes);
  const docx = isDocx(bytes, file.name);
  if (!pdf && !docx) return { error: "Upload the signed PDF or Word file." };
  const saved = await prisma.odrDocument.create({
    data: {
      caseId: item.id,
      bankId: scope.bank.id,
      kind: signedKind,
      fileName: pdf ? safePdfName(file.name) : file.name.trim().slice(0, 120),
      mimeType: pdf ? "application/pdf" : DOCX,
      content: Buffer.from(bytes),
      uploadedBy: scope.user.id,
      uploaderName: scope.user.name,
      note: "Signed final",
    },
  });
  const paper = parsePaper(item.paperJson);
  const status = signedKind === "AWARD_SIGNED" ? "AWARD_PASSED" : "SETTLED";
  await prisma.odrCase.update({
    where: { id: item.id },
    data: {
      status,
      stage: signedKind === "AWARD_SIGNED" ? "AWARD" : item.stage,
      awardAt: signedKind === "AWARD_SIGNED" ? item.awardAt ?? new Date() : item.awardAt,
      awardDeliveredOn: signedKind === "AWARD_SIGNED" && !item.awardDeliveredOn ? istDayKey(new Date()) : item.awardDeliveredOn,
      settlementAt: signedKind === "SETTLEMENT_SIGNED" ? new Date() : item.settlementAt,
      settlementAmount: signedKind === "SETTLEMENT_SIGNED" && paper.fields.settlement_amount ? paper.fields.settlement_amount : item.settlementAmount,
    },
  });
  await prisma.odrStatusEvent.create({
    data: {
      caseId: item.id,
      bankId: scope.bank.id,
      status,
      exParte: item.exParte,
      note: "Signed final uploaded.",
      documentId: saved.id,
      actorId: scope.user.id,
      actorName: scope.user.name,
      actorRole: scope.user.role,
    },
  });
  await auditCurrentUser({
    action: "odr.status",
    summary: `Uploaded the signed ${signedKind === "AWARD_SIGNED" ? "award" : "settlement"} for ${item.refNo} and set the status.`,
    bankId: scope.bank.id,
    bankName: scope.bank.name,
    targetId: item.id,
  });
  redirect(`/odr/cases/${item.id}`);
}
