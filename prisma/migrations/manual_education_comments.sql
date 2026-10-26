-- Patient comments on education lessons + doctor replies.
-- Run once in Supabase SQL Editor (or any Postgres client) BEFORE deploying the backend.
-- Safe to re-run: uses IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS "education_comments" (
  "id" TEXT NOT NULL,
  "module_id" TEXT NOT NULL,
  "parent_id" TEXT,
  "author_type" TEXT NOT NULL,
  "patient_id" TEXT,
  "doctor_id" TEXT,
  "body" TEXT NOT NULL,
  "hidden" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "education_comments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "education_comments_module_id_created_at_idx"
  ON "education_comments"("module_id", "created_at");
CREATE INDEX IF NOT EXISTS "education_comments_parent_id_idx"
  ON "education_comments"("parent_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'education_comments_patient_id_fkey') THEN
    ALTER TABLE "education_comments"
      ADD CONSTRAINT "education_comments_patient_id_fkey"
      FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'education_comments_doctor_id_fkey') THEN
    ALTER TABLE "education_comments"
      ADD CONSTRAINT "education_comments_doctor_id_fkey"
      FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
