-- Meeting 16 Sep 2026 deliverables: email verification, site-visit tracking,
-- doctor phone for onboarding SMS/WhatsApp.
-- Run once in Supabase SQL Editor (or any Postgres client).
-- Safe to re-run: uses IF NOT EXISTS.

ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "email_verified_at" TIMESTAMP(3);
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "last_seen_at" TIMESTAMP(3);
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "site_visit_count" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "doctors" ADD COLUMN IF NOT EXISTS "phone_number" TEXT;

CREATE TABLE IF NOT EXISTS "patient_site_visits" (
  "id" TEXT NOT NULL,
  "patient_id" TEXT NOT NULL,
  "visited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "path" TEXT,
  CONSTRAINT "patient_site_visits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "patient_site_visits_patient_id_visited_at_idx"
  ON "patient_site_visits"("patient_id", "visited_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'patient_site_visits_patient_id_fkey'
  ) THEN
    ALTER TABLE "patient_site_visits"
      ADD CONSTRAINT "patient_site_visits_patient_id_fkey"
      FOREIGN KEY ("patient_id") REFERENCES "patients"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
