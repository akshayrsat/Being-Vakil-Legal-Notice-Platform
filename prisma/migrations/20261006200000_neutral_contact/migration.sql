-- Arbitrator mobile and an edit history. Additive only.
-- Local SQLite picks the same columns up with `prisma db push`.

ALTER TABLE "OdrNeutral" ADD COLUMN "mobile" TEXT NOT NULL DEFAULT '';

CREATE TABLE "OdrNeutralEdit" (
    "id" TEXT NOT NULL,
    "neutralId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL DEFAULT '',
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OdrNeutralEdit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OdrNeutralEdit_neutralId_idx" ON "OdrNeutralEdit"("neutralId");

ALTER TABLE "OdrNeutralEdit" ADD CONSTRAINT "OdrNeutralEdit_neutralId_fkey" FOREIGN KEY ("neutralId") REFERENCES "OdrNeutral"("id") ON DELETE CASCADE ON UPDATE CASCADE;
