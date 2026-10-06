-- Send hours and automatic reminder caps. Additive only.
-- Cloud SQL Postgres. Local SQLite picks the same columns up with `prisma db push`.

ALTER TABLE "OdrSettings" ADD COLUMN "sendWindowStart" TEXT NOT NULL DEFAULT '09:00';
ALTER TABLE "OdrSettings" ADD COLUMN "sendWindowEnd" TEXT NOT NULL DEFAULT '18:30';
ALTER TABLE "OdrSettings" ADD COLUMN "maxRemindersPerHearing" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "OdrSettings" ADD COLUMN "maxMessagesPerDay" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "OdrMessage" ADD COLUMN "notBefore" TIMESTAMP(3);

ALTER TABLE "CampaignDelivery" ADD COLUMN "notBefore" TIMESTAMP(3);
