-- Post-dispute arbitrator consent. Additive only.

ALTER TABLE "OdrCase" ADD COLUMN "appointmentMode" TEXT NOT NULL DEFAULT '';
ALTER TABLE "OdrCase" ADD COLUMN "nominatedNeutralId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "OdrCase" ADD COLUMN "nominatedNeutralName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "OdrCase" ADD COLUMN "firstNoticeAt" TIMESTAMP(3);

ALTER TABLE "OdrSettings" ADD COLUMN "consentDays" INTEGER NOT NULL DEFAULT 15;

CREATE TABLE "OdrBankPanel" (
  "id" TEXT NOT NULL,
  "bankId" TEXT NOT NULL,
  "neutralId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OdrBankPanel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OdrBankPanel_bankId_neutralId_key" ON "OdrBankPanel"("bankId", "neutralId");
CREATE INDEX "OdrBankPanel_bankId_idx" ON "OdrBankPanel"("bankId");

ALTER TABLE "OdrBankPanel" ADD CONSTRAINT "OdrBankPanel_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OdrBankPanel" ADD CONSTRAINT "OdrBankPanel_neutralId_fkey" FOREIGN KEY ("neutralId") REFERENCES "OdrNeutral"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "OdrConsent" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "bankId" TEXT NOT NULL,
  "choice" TEXT NOT NULL,
  "typedName" TEXT NOT NULL DEFAULT '',
  "chosenNeutralId" TEXT NOT NULL DEFAULT '',
  "chosenNeutralName" TEXT NOT NULL DEFAULT '',
  "objection" TEXT NOT NULL DEFAULT '',
  "shownText" TEXT NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL,
  "recordedAtIst" TEXT NOT NULL DEFAULT '',
  "ip" TEXT NOT NULL DEFAULT '',
  "userAgent" TEXT NOT NULL DEFAULT '',
  "documentId" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OdrConsent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OdrConsent_caseId_idx" ON "OdrConsent"("caseId");
CREATE INDEX "OdrConsent_bankId_idx" ON "OdrConsent"("bankId");

ALTER TABLE "OdrConsent" ADD CONSTRAINT "OdrConsent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "OdrCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
