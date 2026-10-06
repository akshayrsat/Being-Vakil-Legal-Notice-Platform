-- Per-bank grievance officer and the date the bank approved the wording.
-- Additive only.

ALTER TABLE "Bank" ADD COLUMN "grievanceOfficerName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Bank" ADD COLUMN "grievanceOfficerPhone" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Bank" ADD COLUMN "grievanceOfficerEmail" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Bank" ADD COLUMN "grievanceOmbudsman" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Bank" ADD COLUMN "wordingApprovedOn" TEXT NOT NULL DEFAULT '';
