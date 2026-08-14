-- MamaCare: pregnancy clinic / doctor pre-consult columns
-- Run once in Supabase SQL Editor (or any Postgres client).
-- Safe to re-run: uses IF NOT EXISTS.
-- Do NOT run prisma generate / db push if those fail on your PC.

-- ── Booking / lab fields ──────────────────────────────────────────
ALTER TABLE "pregnancies" ADD COLUMN IF NOT EXISTS "rhesus" TEXT;
ALTER TABLE "pregnancies" ADD COLUMN IF NOT EXISTS "malaria_parasite" TEXT;
ALTER TABLE "pregnancies" ADD COLUMN IF NOT EXISTS "urinalysis" TEXT;
ALTER TABLE "pregnancies" ADD COLUMN IF NOT EXISTS "ipt_history" TEXT;
ALTER TABLE "pregnancies" ADD COLUMN IF NOT EXISTS "uss_date" TIMESTAMP(3);
ALTER TABLE "pregnancies" ADD COLUMN IF NOT EXISTS "uss_ega_weeks" INTEGER;
ALTER TABLE "pregnancies" ADD COLUMN IF NOT EXISTS "uss_notes" TEXT;
ALTER TABLE "pregnancies" ADD COLUMN IF NOT EXISTS "booked_anc" BOOLEAN;
ALTER TABLE "pregnancies" ADD COLUMN IF NOT EXISTS "booked_anc_facility" TEXT;
ALTER TABLE "pregnancies" ADD COLUMN IF NOT EXISTS "booking_ga_weeks" INTEGER;
ALTER TABLE "pregnancies" ADD COLUMN IF NOT EXISTS "booking_history" TEXT;
ALTER TABLE "pregnancies" ADD COLUMN IF NOT EXISTS "hep_c" TEXT;
ALTER TABLE "pregnancies" ADD COLUMN IF NOT EXISTS "rbg" TEXT;
ALTER TABLE "pregnancies" ADD COLUMN IF NOT EXISTS "ogtt" TEXT;
ALTER TABLE "pregnancies" ADD COLUMN IF NOT EXISTS "extra_labs" JSONB;

-- ── Doctor pre-consult review (vitals, drugs, scans, exam, remarks) ─
ALTER TABLE "pregnancies" ADD COLUMN IF NOT EXISTS "vitals_log" JSONB;
ALTER TABLE "pregnancies" ADD COLUMN IF NOT EXISTS "drugs_vaccines" JSONB;
ALTER TABLE "pregnancies" ADD COLUMN IF NOT EXISTS "scans_log" JSONB;
ALTER TABLE "pregnancies" ADD COLUMN IF NOT EXISTS "examination" JSONB;
ALTER TABLE "pregnancies" ADD COLUMN IF NOT EXISTS "important_remarks" TEXT;

-- Note: patients.emergency_contact_* columns are already on main schema.
-- If your DB is missing them, also run:
-- ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "emergency_contact_name" TEXT;
-- ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "emergency_contact_relationship" TEXT;
-- ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "emergency_contact_phone" TEXT;
