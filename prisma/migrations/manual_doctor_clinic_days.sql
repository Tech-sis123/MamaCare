-- 9Care AI: Add clinic_days to doctors table and configure Dr. Delight's clinic availability
-- Run in Supabase SQL Editor (or any Postgres client).
-- Safe to re-run: uses IF NOT EXISTS.

-- 1. Add clinic_days column to doctors table (PostgreSQL TEXT array, defaults to empty array)
ALTER TABLE "doctors" ADD COLUMN IF NOT EXISTS "clinic_days" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- 2. Set Dr. Delight's clinic day to Monday
UPDATE "doctors"
SET "clinic_days" = ARRAY['Monday']
WHERE LOWER("email") = LOWER('delightigbinomwanhia@gmail.com');

-- 3. Optional verification query
SELECT "id", "name", "email", "phone_number", "role", "clinic_days"
FROM "doctors"
WHERE LOWER("email") = LOWER('delightigbinomwanhia@gmail.com');
