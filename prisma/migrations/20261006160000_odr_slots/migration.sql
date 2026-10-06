-- Staggered ODR hearings: daily window, lunch break, holidays, and the arbitrator panel.
-- Cloud SQL Postgres. Local SQLite picks the same columns up with `prisma db push`.
-- Run once. This does not change notice sending or MSG91_LIVE_SEND.

ALTER TABLE "OdrBatch" ADD COLUMN "windowStart" TEXT NOT NULL DEFAULT '10:00';
ALTER TABLE "OdrBatch" ADD COLUMN "windowEnd" TEXT NOT NULL DEFAULT '18:00';
ALTER TABLE "OdrBatch" ADD COLUMN "gapMinutes" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "OdrBatch" ADD COLUMN "skipSundays" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "OdrBatch" ADD COLUMN "holidays" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "OdrBatch" ADD COLUMN "breakStart" TEXT NOT NULL DEFAULT '13:30';
ALTER TABLE "OdrBatch" ADD COLUMN "breakEnd" TEXT NOT NULL DEFAULT '14:30';
ALTER TABLE "OdrBatch" ADD COLUMN "arbitratorMode" TEXT NOT NULL DEFAULT 'SPLIT';
ALTER TABLE "OdrBatch" ADD COLUMN "neutralIds" TEXT NOT NULL DEFAULT '[]';

ALTER TABLE "OdrCase" ADD COLUMN "panelJson" TEXT NOT NULL DEFAULT '[]';
