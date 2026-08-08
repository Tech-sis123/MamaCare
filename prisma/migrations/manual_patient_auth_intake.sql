-- Manual migration: patient email/password auth + intake edit window
-- Run against Postgres if `prisma db push` cannot reach the DB.

ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "password_hash" TEXT;
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "intake_status" TEXT NOT NULL DEFAULT 'not_started';
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "intake_first_submitted_at" TIMESTAMP(3);
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "intake_last_saved_at" TIMESTAMP(3);

-- Unique email (NULLs allowed for legacy rows without email yet)
CREATE UNIQUE INDEX IF NOT EXISTS "patients_email_key" ON "patients"("email");
