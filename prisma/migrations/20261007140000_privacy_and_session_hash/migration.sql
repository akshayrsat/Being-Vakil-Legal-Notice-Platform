-- Session cookies are stored as SHA-256 hashes from this point.
-- Rows written before this migration are the raw cookie, so they are removed.
-- People who were signed in need to sign in again.
-- Last-4 lockouts, privacy requests, retention, and incident notes.
-- Types below are valid in SQLite and PostgreSQL.

DELETE FROM "Session";

CREATE TABLE "VerifyLock" (
  "id" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "failures" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VerifyLock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VerifyLock_scope_subject_key" ON "VerifyLock"("scope", "subject");

CREATE TABLE "FirmPrivacySetting" (
  "id" TEXT NOT NULL,
  "officerName" TEXT NOT NULL DEFAULT '',
  "officerEmail" TEXT NOT NULL DEFAULT 'contact@beingvakil.in',
  "officerPhone" TEXT NOT NULL DEFAULT '+91 9653331393',
  "requestDueDays" INTEGER NOT NULL DEFAULT 30,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FirmPrivacySetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PrivacyRequest" (
  "id" TEXT NOT NULL,
  "bankId" TEXT NOT NULL DEFAULT '',
  "bankName" TEXT NOT NULL DEFAULT '',
  "kind" TEXT NOT NULL,
  "requesterName" TEXT NOT NULL,
  "email" TEXT NOT NULL DEFAULT '',
  "mobile" TEXT NOT NULL DEFAULT '',
  "accountHint" TEXT NOT NULL DEFAULT '',
  "detail" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "dueAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PrivacyRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PrivacyRequest_bankId_idx" ON "PrivacyRequest"("bankId");
CREATE INDEX "PrivacyRequest_status_idx" ON "PrivacyRequest"("status");
CREATE INDEX "PrivacyRequest_dueAt_idx" ON "PrivacyRequest"("dueAt");

CREATE TABLE "BankRetention" (
  "bankId" TEXT NOT NULL,
  "closedCaseDays" INTEGER NOT NULL DEFAULT 0,
  "messageDays" INTEGER NOT NULL DEFAULT 0,
  "documentDays" INTEGER NOT NULL DEFAULT 0,
  "publicNoticeDays" INTEGER NOT NULL DEFAULT 0,
  "campaignDays" INTEGER NOT NULL DEFAULT 0,
  "legalHold" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BankRetention_pkey" PRIMARY KEY ("bankId"),
  CONSTRAINT "BankRetention_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "PersonLegalHold" (
  "id" TEXT NOT NULL,
  "bankId" TEXT NOT NULL,
  "accountKey" TEXT NOT NULL DEFAULT '',
  "mobileKey" TEXT NOT NULL DEFAULT '',
  "emailKey" TEXT NOT NULL DEFAULT '',
  "reason" TEXT NOT NULL DEFAULT '',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PersonLegalHold_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PersonLegalHold_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "PersonLegalHold_bankId_idx" ON "PersonLegalHold"("bankId");

CREATE TABLE "PrivacyIncident" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "whatHappened" TEXT NOT NULL,
  "detectedAt" TIMESTAMP(3) NOT NULL,
  "banksAffected" TEXT NOT NULL DEFAULT '',
  "peopleAffectedCount" INTEGER NOT NULL DEFAULT 0,
  "notifiedBankAt" TIMESTAMP(3),
  "notifiedBoardAt" TIMESTAMP(3),
  "notifiedPeopleAt" TIMESTAMP(3),
  "checklistJson" TEXT NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PrivacyIncident_pkey" PRIMARY KEY ("id")
);
