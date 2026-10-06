-- Saved award and settlement answers for an ODR case.
-- Cloud SQL Postgres. Local SQLite picks the same column up with `prisma db push`.
-- Run once. This does not change notice sending or MSG91_LIVE_SEND.

ALTER TABLE "OdrCase" ADD COLUMN "paperJson" TEXT NOT NULL DEFAULT '{}';
