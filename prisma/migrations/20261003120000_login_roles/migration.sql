-- New logins: owner, legal coordinator, and bank user.
-- ADMIN and BANK_VIEWER stay, so an existing login still opens.
-- Cloud SQL Postgres. Local SQLite picks the values up with `prisma db push`.

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'OWNER';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'LEGAL_COORDINATOR';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'BANK_USER';
