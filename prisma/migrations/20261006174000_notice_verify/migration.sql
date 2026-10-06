-- Last-4 check before a public legal notice shows personal details.
-- Additive only.

CREATE TABLE "NoticeVerifyGrant" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "noticeNumber" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NoticeVerifyGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NoticeVerifyGrant_token_key" ON "NoticeVerifyGrant"("token");
CREATE INDEX "NoticeVerifyGrant_noticeNumber_idx" ON "NoticeVerifyGrant"("noticeNumber");
