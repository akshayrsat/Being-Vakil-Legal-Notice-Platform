-- Structured co-borrowers and guarantors. The free-text co-party field stays.
-- Additive only.

ALTER TABLE "OdrHearing" ADD COLUMN "partyAttendance" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "OdrMessage" ADD COLUMN "respondentId" TEXT NOT NULL DEFAULT '';

CREATE TABLE "OdrRespondent" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "bankId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'Co-borrower',
  "mobile" TEXT NOT NULL DEFAULT '',
  "email" TEXT NOT NULL DEFAULT '',
  "address" TEXT NOT NULL DEFAULT '',
  "publicToken" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OdrRespondent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OdrRespondent_publicToken_key" ON "OdrRespondent"("publicToken");
CREATE INDEX "OdrRespondent_caseId_idx" ON "OdrRespondent"("caseId");
CREATE INDEX "OdrRespondent_bankId_idx" ON "OdrRespondent"("bankId");

ALTER TABLE "OdrRespondent" ADD CONSTRAINT "OdrRespondent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "OdrCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
