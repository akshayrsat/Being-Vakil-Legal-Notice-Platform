// Loads the consent rows and the documents that can stand in for them.
// One row belongs to one respondent. A blank respondent id is the borrower.

import type { PrismaClient } from "@prisma/client";
import { prisma } from "./db";
import { appointmentConsentState, type ConsentParty, type ConsentState, type StoredConsent } from "./odr-consent";
import { readOdrRules } from "./odr-store";

export function storedConsent(row: {
  choice: string;
  typedName: string;
  chosenNeutralId: string;
  chosenNeutralName: string;
  objection: string;
  shownText: string;
  recordedAt: Date;
  recordedAtIst: string;
} | null): StoredConsent | null {
  if (!row) return null;
  return {
    choice: row.choice,
    typedName: row.typedName,
    chosenNeutralId: row.chosenNeutralId,
    chosenNeutralName: row.chosenNeutralName,
    objection: row.objection,
    shownText: row.shownText,
    recordedAt: row.recordedAt,
    recordedAtIst: row.recordedAtIst,
  };
}

export async function loadAppointmentConsent(
  item: {
    id: string;
    matterType: string;
    firstNoticeAt: Date | null;
    customerName?: string;
    nominatedNeutralId?: string;
  },
  db: PrismaClient = prisma,
  now = new Date(),
): Promise<ConsentState & { consent: StoredConsent | null; parties: ConsentParty[]; documentKinds: string[] }> {
  const [consents, documents, respondents, rules] = await Promise.all([
    db.odrConsent.findMany({ where: { caseId: item.id }, orderBy: { createdAt: "asc" } }),
    db.odrDocument.findMany({ where: { caseId: item.id }, select: { kind: true } }),
    db.odrRespondent.findMany({ where: { caseId: item.id }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    readOdrRules(db),
  ]);
  const documentKinds = documents.map((doc) => doc.kind);
  const forParty = (id: string) => storedConsent(consents.find((row) => row.respondentId === id) ?? null);
  const parties: ConsentParty[] = [
    { id: "", name: item.customerName ?? "", consent: forParty("") },
    ...respondents.map((party) => ({ id: party.id, name: party.name, consent: forParty(party.id) })),
  ];
  const primary = parties[0]?.consent ?? null;
  return {
    ...appointmentConsentState({
      matterType: item.matterType,
      now,
      days: rules.consentDays,
      blockDays: Math.max(rules.consentBlockDays, rules.consentDays),
      firstNoticeAt: item.firstNoticeAt,
      consent: primary,
      parties,
      nominatedNeutralId: item.nominatedNeutralId ?? "",
      documentKinds,
    }),
    consent: primary,
    parties,
    documentKinds,
  };
}
