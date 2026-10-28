-- WhatsApp number + consent for patients (pop-up after account recovery, profile page).
-- Run once in Supabase SQL Editor (or any Postgres client) BEFORE deploying the backend.
-- Safe to re-run: uses IF NOT EXISTS and only fills empty values.

ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "whatsapp_number" TEXT;
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "whatsapp_consent" BOOLEAN;
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "whatsapp_consent_at" TIMESTAMP(3);
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "whatsapp_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "whatsapp_verified_at" TIMESTAMP(3);
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "account_recovered_at" TIMESTAMP(3);

-- Patients who already recovered their account before this change also get the WhatsApp pop-up
UPDATE "patients" p
SET "account_recovered_at" = r.last_recovered
FROM (
  SELECT "actor_id", MAX("created_at") AS last_recovered
  FROM "audit_logs"
  WHERE "action" = 'patient_recovery_credentials_set'
  GROUP BY "actor_id"
) r
WHERE p."id" = r."actor_id" AND p."account_recovered_at" IS NULL;
