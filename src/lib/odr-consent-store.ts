// Loads the consent row and the documents that can stand in for it.

import type { PrismaClient } from "@prisma/client";
import { prisma } from "./db";
import { appointmentConsentState, type ConsentState, type StoredConsent } from "./odr-consent";
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
  item: { id: string; matterType: string; firstNoticeAt: Date | null },
  db: PrismaClient = prisma,
  now = new Date(),
): Promise<ConsentState & { consent: StoredConsent | null; documentKinds: string[] }> {
  const [consent, documents, rules] = await Promise.all([
    db.odrConsent.findFirst({ where: { caseId: item.id }, orderBy: { createdAt: "asc" } }),
    db.odrDocument.findMany({ where: { caseId: item.id }, select: { kind: true } }),
    readOdrRules(db),
  ]);
  const documentKinds = documents.map((doc) => doc.kind);
  const stored = storedConsent(consent);
  return {
    ...appointmentConsentState({
      matterType: item.matterType,
      now,
      days: rules.consentDays,
      firstNoticeAt: item.firstNoticeAt,
      consent: stored,
      documentKinds,
    }),
    consent: stored,
    documentKinds,
  };
}
