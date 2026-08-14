-- Add emergency contact columns on patients (run in Supabase SQL editor if db push fails)
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "emergency_contact_name" TEXT;
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "emergency_contact_relationship" TEXT;
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "emergency_contact_phone" TEXT;
