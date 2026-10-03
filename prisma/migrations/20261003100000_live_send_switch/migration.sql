-- Firm-wide live send switch. Cloud SQL Postgres.
-- Local SQLite picks this table up with `prisma db push`.
-- No row is inserted. A missing row starts the switch on.

CREATE TABLE "LiveSendSetting" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LiveSendSetting_pkey" PRIMARY KEY ("id")
);
