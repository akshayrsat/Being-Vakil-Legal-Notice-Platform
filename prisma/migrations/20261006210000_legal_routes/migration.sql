-- Legal route, consent window, neutral register, and settlement fields. Additive only.
-- Local SQLite picks the same columns up with `prisma db push`.

ALTER TABLE "OdrNeutral" ADD COLUMN "roles" TEXT NOT NULL DEFAULT 'ARBITRATOR';
ALTER TABLE "OdrNeutral" ADD COLUMN "empanelment" TEXT NOT NULL DEFAULT '';
ALTER TABLE "OdrNeutral" ADD COLUMN "mciRegistration" TEXT NOT NULL DEFAULT '';

CREATE TABLE "OdrNeutralFile" (
    "id" TEXT NOT NULL,
    "neutralId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "content" BYTEA NOT NULL,
    "uploadedBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OdrNeutralFile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OdrNeutralFile_neutralId_idx" ON "OdrNeutralFile"("neutralId");

ALTER TABLE "OdrNeutralFile" ADD CONSTRAINT "OdrNeutralFile_neutralId_fkey" FOREIGN KEY ("neutralId") REFERENCES "OdrNeutral"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OdrBatch" ADD COLUMN "legalRoute" TEXT NOT NULL DEFAULT '';

ALTER TABLE "OdrCase" ADD COLUMN "legalRoute" TEXT NOT NULL DEFAULT '';
ALTER TABLE "OdrCase" ADD COLUMN "limitationDate" TEXT NOT NULL DEFAULT '';
ALTER TABLE "OdrCase" ADD COLUMN "pleadingsClosedOn" TEXT NOT NULL DEFAULT '';
ALTER TABLE "OdrCase" ADD COLUMN "awardExtension" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OdrCase" ADD COLUMN "awardDeliveredOn" TEXT NOT NULL DEFAULT '';
ALTER TABLE "OdrCase" ADD COLUMN "processDeadlineOn" TEXT NOT NULL DEFAULT '';
ALTER TABLE "OdrCase" ADD COLUMN "settlementSanctionRef" TEXT NOT NULL DEFAULT '';
ALTER TABLE "OdrCase" ADD COLUMN "settlementInstalmentMonths" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "OdrCase" ADD COLUMN "lokAdalatStatus" TEXT NOT NULL DEFAULT '';

CREATE TABLE "OdrNeutralService" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "neutralId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OdrNeutralService_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OdrNeutralService_caseId_neutralId_role_key" ON "OdrNeutralService"("caseId", "neutralId", "role");
CREATE INDEX "OdrNeutralService_caseId_idx" ON "OdrNeutralService"("caseId");
CREATE INDEX "OdrNeutralService_neutralId_idx" ON "OdrNeutralService"("neutralId");

ALTER TABLE "OdrNeutralService" ADD CONSTRAINT "OdrNeutralService_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "OdrCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OdrNeutralService" ADD CONSTRAINT "OdrNeutralService_neutralId_fkey" FOREIGN KEY ("neutralId") REFERENCES "OdrNeutral"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OdrConsent" ADD COLUMN "respondentId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "OdrConsent" ADD COLUMN "respondentName" TEXT NOT NULL DEFAULT '';
CREATE INDEX "OdrConsent_respondentId_idx" ON "OdrConsent"("respondentId");

CREATE TABLE "OdrRouteReply" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "respondentId" TEXT NOT NULL DEFAULT '',
    "respondentName" TEXT NOT NULL DEFAULT '',
    "choice" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "recordedAtIst" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OdrRouteReply_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OdrRouteReply_caseId_respondentId_key" ON "OdrRouteReply"("caseId", "respondentId");
CREATE INDEX "OdrRouteReply_caseId_idx" ON "OdrRouteReply"("caseId");

ALTER TABLE "OdrRouteReply" ADD CONSTRAINT "OdrRouteReply_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "OdrCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OdrSettings" ADD COLUMN "consentBlockDays" INTEGER NOT NULL DEFAULT 30;
