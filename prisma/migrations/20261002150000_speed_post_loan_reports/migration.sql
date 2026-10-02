-- Speed Post consignments, loan lookup indexes, and optional notice PDF on email.
-- Cloud SQL Postgres. Local SQLite picks the same columns up with `prisma db push`.
-- Run once. Do not put API keys or entry codes in this file.

ALTER TABLE "Bank" ADD COLUMN "attachNoticePdf" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "PublicNotice_loanNumber_idx" ON "PublicNotice"("loanNumber");
CREATE INDEX "PublicNotice_customerId_idx" ON "PublicNotice"("customerId");

CREATE TABLE "SpeedPostConsignment" (
    "id" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "publicNoticeId" TEXT,
    "campaignId" TEXT,
    "recipientRowId" TEXT NOT NULL DEFAULT '',
    "customerName" TEXT NOT NULL DEFAULT '',
    "loanNumber" TEXT NOT NULL DEFAULT '',
    "customerId" TEXT NOT NULL DEFAULT '',
    "noticeNumber" TEXT NOT NULL DEFAULT '',
    "articleNumber" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'BOOKED',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SpeedPostConsignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SpeedPostEvent" (
    "id" TEXT NOT NULL,
    "consignmentId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SpeedPostEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SpeedPostConsignment_bankId_idx" ON "SpeedPostConsignment"("bankId");
CREATE INDEX "SpeedPostConsignment_articleNumber_idx" ON "SpeedPostConsignment"("articleNumber");
CREATE INDEX "SpeedPostConsignment_loanNumber_idx" ON "SpeedPostConsignment"("loanNumber");
CREATE INDEX "SpeedPostConsignment_customerId_idx" ON "SpeedPostConsignment"("customerId");
CREATE INDEX "SpeedPostConsignment_noticeNumber_idx" ON "SpeedPostConsignment"("noticeNumber");
CREATE INDEX "SpeedPostConsignment_campaignId_idx" ON "SpeedPostConsignment"("campaignId");
CREATE INDEX "SpeedPostConsignment_publicNoticeId_idx" ON "SpeedPostConsignment"("publicNoticeId");
CREATE INDEX "SpeedPostConsignment_recipientRowId_idx" ON "SpeedPostConsignment"("recipientRowId");
CREATE INDEX "SpeedPostConsignment_status_idx" ON "SpeedPostConsignment"("status");
CREATE INDEX "SpeedPostEvent_consignmentId_idx" ON "SpeedPostEvent"("consignmentId");
CREATE INDEX "SpeedPostEvent_occurredAt_idx" ON "SpeedPostEvent"("occurredAt");

ALTER TABLE "SpeedPostConsignment" ADD CONSTRAINT "SpeedPostConsignment_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpeedPostConsignment" ADD CONSTRAINT "SpeedPostConsignment_publicNoticeId_fkey" FOREIGN KEY ("publicNoticeId") REFERENCES "PublicNotice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SpeedPostConsignment" ADD CONSTRAINT "SpeedPostConsignment_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SpeedPostEvent" ADD CONSTRAINT "SpeedPostEvent_consignmentId_fkey" FOREIGN KEY ("consignmentId") REFERENCES "SpeedPostConsignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
