-- How long an unused spreadsheet is kept, and whether closed-case personal data is cleared.
-- Additive only. Closed-case clearing stays off until the owner sets a number of days.

ALTER TABLE "OdrSettings" ADD COLUMN "sheetRetentionDays" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "OdrSettings" ADD COLUMN "closedDataRetentionDays" INTEGER NOT NULL DEFAULT 0;
