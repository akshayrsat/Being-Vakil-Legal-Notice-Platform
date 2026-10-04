-- Firm-wide printed legal notices, separate from SMS, email, and WhatsApp templates.
-- Cloud SQL Postgres. Local SQLite picks the same columns up with `prisma db push`.
-- Run once. Do not put API keys or entry codes in this file.

CREATE TABLE "LegalNoticeTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'text',
    "seedKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LegalNoticeTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LegalNoticeTemplate_seedKey_key" ON "LegalNoticeTemplate"("seedKey");

ALTER TABLE "Campaign" ADD COLUMN "legalNoticeTemplateId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Campaign" ADD COLUMN "legalNoticeName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Campaign" ADD COLUMN "legalNoticeBody" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Campaign" ADD COLUMN "legalNoticeFormat" TEXT NOT NULL DEFAULT '';

ALTER TABLE "PublicNotice" ADD COLUMN "documentFormat" TEXT NOT NULL DEFAULT '';
