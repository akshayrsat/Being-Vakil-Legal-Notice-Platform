-- Online dispute resolution: cases, hearings, messages, and the ODR send switch.
-- Cloud SQL Postgres. Local SQLite picks the same columns up with `prisma db push`.
-- Run once. Do not put API keys or entry codes in this file.
-- This does not change notice sending or MSG91_LIVE_SEND.

CREATE TABLE "OdrNeutral" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "qualification" TEXT NOT NULL DEFAULT '',
    "enrolmentNo" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OdrNeutral_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OdrBatch" (
    "id" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "matterType" TEXT NOT NULL,
    "neutralId" TEXT NOT NULL DEFAULT '',
    "neutralName" TEXT NOT NULL DEFAULT '',
    "hearingAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "headers" TEXT NOT NULL DEFAULT '[]',
    "rawRows" TEXT NOT NULL DEFAULT '[]',
    "mappingUsed" TEXT NOT NULL DEFAULT '',
    "saved" BOOLEAN NOT NULL DEFAULT false,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OdrBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OdrCase" (
    "id" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL DEFAULT 0,
    "refNo" TEXT NOT NULL,
    "matterType" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "coParties" TEXT NOT NULL DEFAULT '',
    "accountNumber" TEXT NOT NULL DEFAULT '',
    "branch" TEXT NOT NULL DEFAULT '',
    "mobile" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "loanAmount" TEXT NOT NULL DEFAULT '',
    "claimAmount" TEXT NOT NULL DEFAULT '',
    "asOnDate" TEXT NOT NULL DEFAULT '',
    "disputeSummary" TEXT NOT NULL DEFAULT '',
    "neutralId" TEXT,
    "neutralName" TEXT NOT NULL DEFAULT '',
    "neutralQualification" TEXT NOT NULL DEFAULT '',
    "neutralEnrolment" TEXT NOT NULL DEFAULT '',
    "publicToken" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'HEARING_SCHEDULED',
    "stage" TEXT NOT NULL DEFAULT 'HEARING',
    "exParte" BOOLEAN NOT NULL DEFAULT false,
    "noShowCount" INTEGER NOT NULL DEFAULT 0,
    "flaggedExParte" BOOLEAN NOT NULL DEFAULT false,
    "settlementAmount" TEXT NOT NULL DEFAULT '',
    "settlementNote" TEXT NOT NULL DEFAULT '',
    "settlementAt" TIMESTAMP(3),
    "awardAt" TIMESTAMP(3),
    "advocateName" TEXT NOT NULL DEFAULT '',
    "advocateBarNo" TEXT NOT NULL DEFAULT '',
    "bankCounsel" TEXT NOT NULL DEFAULT '',
    "bankContact" TEXT NOT NULL DEFAULT '',
    "paymentInfo" TEXT NOT NULL DEFAULT '',
    "rescheduleNote" TEXT NOT NULL DEFAULT '',
    "reschedulePreferred" TEXT NOT NULL DEFAULT '',
    "rescheduleAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OdrCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OdrHearing" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "meetLink" TEXT NOT NULL DEFAULT '',
    "meetFake" BOOLEAN NOT NULL DEFAULT false,
    "meetError" TEXT NOT NULL DEFAULT '',
    "calendarEventId" TEXT NOT NULL DEFAULT '',
    "meetingCode" TEXT NOT NULL DEFAULT '',
    "attendance" TEXT NOT NULL DEFAULT 'PENDING',
    "attendanceSource" TEXT NOT NULL DEFAULT '',
    "attendanceNote" TEXT NOT NULL DEFAULT '',
    "remindersSent" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OdrHearing_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OdrMessage" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "hearingId" TEXT,
    "bankId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "messageText" TEXT NOT NULL DEFAULT '',
    "providerId" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OdrMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OdrDocument" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "content" BYTEA NOT NULL,
    "uploadedBy" TEXT NOT NULL DEFAULT '',
    "uploaderName" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OdrDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OdrStatusEvent" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "exParte" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT NOT NULL DEFAULT '',
    "documentId" TEXT NOT NULL DEFAULT '',
    "actorId" TEXT NOT NULL DEFAULT '',
    "actorName" TEXT NOT NULL DEFAULT '',
    "actorRole" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OdrStatusEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OdrAccessLog" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "ip" TEXT NOT NULL DEFAULT '',
    "userAgent" TEXT NOT NULL DEFAULT '',
    "detail" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OdrAccessLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OdrVerifyGrant" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OdrVerifyGrant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OdrAlert" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OdrAlert_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OdrLiveSendSetting" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OdrLiveSendSetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OdrSettings" (
    "id" TEXT NOT NULL,
    "templatesJson" TEXT NOT NULL DEFAULT '{}',
    "reminderDaysBefore" INTEGER NOT NULL DEFAULT 1,
    "reminderHoursBefore" INTEGER NOT NULL DEFAULT 1,
    "reminderDayOn" BOOLEAN NOT NULL DEFAULT true,
    "reminderHourOn" BOOLEAN NOT NULL DEFAULT true,
    "maxNoShow" INTEGER NOT NULL DEFAULT 3,
    "autoRescheduleDays" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OdrSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OdrCase_refNo_key" ON "OdrCase"("refNo");
CREATE UNIQUE INDEX "OdrCase_publicToken_key" ON "OdrCase"("publicToken");
CREATE UNIQUE INDEX "OdrHearing_caseId_number_key" ON "OdrHearing"("caseId", "number");
CREATE UNIQUE INDEX "OdrVerifyGrant_token_key" ON "OdrVerifyGrant"("token");

CREATE INDEX "OdrBatch_bankId_idx" ON "OdrBatch"("bankId");
CREATE INDEX "OdrBatch_status_idx" ON "OdrBatch"("status");
CREATE INDEX "OdrCase_bankId_idx" ON "OdrCase"("bankId");
CREATE INDEX "OdrCase_batchId_idx" ON "OdrCase"("batchId");
CREATE INDEX "OdrCase_status_idx" ON "OdrCase"("status");
CREATE INDEX "OdrCase_accountNumber_idx" ON "OdrCase"("accountNumber");
CREATE INDEX "OdrCase_customerName_idx" ON "OdrCase"("customerName");
CREATE INDEX "OdrHearing_bankId_idx" ON "OdrHearing"("bankId");
CREATE INDEX "OdrHearing_scheduledAt_idx" ON "OdrHearing"("scheduledAt");
CREATE INDEX "OdrHearing_attendance_idx" ON "OdrHearing"("attendance");
CREATE INDEX "OdrMessage_caseId_idx" ON "OdrMessage"("caseId");
CREATE INDEX "OdrMessage_bankId_idx" ON "OdrMessage"("bankId");
CREATE INDEX "OdrMessage_hearingId_idx" ON "OdrMessage"("hearingId");
CREATE INDEX "OdrMessage_status_idx" ON "OdrMessage"("status");
CREATE INDEX "OdrMessage_kind_idx" ON "OdrMessage"("kind");
CREATE INDEX "OdrDocument_caseId_idx" ON "OdrDocument"("caseId");
CREATE INDEX "OdrDocument_bankId_idx" ON "OdrDocument"("bankId");
CREATE INDEX "OdrStatusEvent_caseId_idx" ON "OdrStatusEvent"("caseId");
CREATE INDEX "OdrStatusEvent_createdAt_idx" ON "OdrStatusEvent"("createdAt");
CREATE INDEX "OdrAccessLog_caseId_idx" ON "OdrAccessLog"("caseId");
CREATE INDEX "OdrAccessLog_createdAt_idx" ON "OdrAccessLog"("createdAt");
CREATE INDEX "OdrVerifyGrant_caseId_idx" ON "OdrVerifyGrant"("caseId");
CREATE INDEX "OdrAlert_bankId_idx" ON "OdrAlert"("bankId");
CREATE INDEX "OdrAlert_caseId_idx" ON "OdrAlert"("caseId");

ALTER TABLE "OdrBatch" ADD CONSTRAINT "OdrBatch_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OdrCase" ADD CONSTRAINT "OdrCase_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OdrCase" ADD CONSTRAINT "OdrCase_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "OdrBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OdrCase" ADD CONSTRAINT "OdrCase_neutralId_fkey" FOREIGN KEY ("neutralId") REFERENCES "OdrNeutral"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OdrHearing" ADD CONSTRAINT "OdrHearing_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "OdrCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OdrMessage" ADD CONSTRAINT "OdrMessage_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "OdrCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OdrMessage" ADD CONSTRAINT "OdrMessage_hearingId_fkey" FOREIGN KEY ("hearingId") REFERENCES "OdrHearing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OdrDocument" ADD CONSTRAINT "OdrDocument_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "OdrCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OdrStatusEvent" ADD CONSTRAINT "OdrStatusEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "OdrCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OdrAccessLog" ADD CONSTRAINT "OdrAccessLog_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "OdrCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OdrAlert" ADD CONSTRAINT "OdrAlert_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "OdrCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
