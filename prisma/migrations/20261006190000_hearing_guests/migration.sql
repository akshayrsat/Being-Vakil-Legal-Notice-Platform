-- Arbitrator email, bank representatives, and hearing guest notes.
-- Additive only. Local SQLite picks the same columns up with `prisma db push`.

ALTER TABLE "OdrNeutral" ADD COLUMN "email" TEXT NOT NULL DEFAULT '';

CREATE TABLE "BankRepresentative" (
    "id" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mobile" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankRepresentative_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BankRepresentative_bankId_idx" ON "BankRepresentative"("bankId");

ALTER TABLE "BankRepresentative" ADD CONSTRAINT "BankRepresentative_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OdrHearing" ADD COLUMN "guestInviteNote" TEXT NOT NULL DEFAULT '';
ALTER TABLE "OdrHearing" ADD COLUMN "spaceName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "OdrHearing" ADD COLUMN "invitedGuests" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "OdrHearing" ADD COLUMN "guestAttendance" TEXT NOT NULL DEFAULT '[]';
