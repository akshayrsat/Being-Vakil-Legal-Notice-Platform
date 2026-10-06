-- Fields printed on an arbitration hearing notice. Additive only.

ALTER TABLE "OdrCase" ADD COLUMN "claimReference" TEXT NOT NULL DEFAULT '';
ALTER TABLE "OdrCase" ADD COLUMN "defenceDeadline" TEXT NOT NULL DEFAULT '';
