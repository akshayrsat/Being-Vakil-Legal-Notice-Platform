-- AlterTable
-- Webpage opens of a public notice (/notice-<id>). Not CampaignDelivery.openedAt.
-- Cloud SQL Postgres. Local SQLite picks the same columns up with `prisma db push`.
ALTER TABLE "PublicNotice" ADD COLUMN "linkLastViewedAt" TIMESTAMP(3),
ADD COLUMN "linkOpenedAt" TIMESTAMP(3),
ADD COLUMN "linkViewCount" INTEGER NOT NULL DEFAULT 0;
