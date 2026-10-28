-- Delivery details + postpartum lesson groups.
-- Run BEFORE deploying the code that uses them. Safe to run more than once.

-- 1. Delivery details on the pregnancy (one yes/no column per complication)
ALTER TABLE "pregnancies" ADD COLUMN IF NOT EXISTS "delivery_date" TIMESTAMP(3);
ALTER TABLE "pregnancies" ADD COLUMN IF NOT EXISTS "delivery_recorded_at" TIMESTAMP(3);
ALTER TABLE "pregnancies" ADD COLUMN IF NOT EXISTS "delivery_had_complications" BOOLEAN;
ALTER TABLE "pregnancies" ADD COLUMN IF NOT EXISTS "comp_antepartum_hemorrhage" BOOLEAN;
ALTER TABLE "pregnancies" ADD COLUMN IF NOT EXISTS "comp_premature_rupture_of_membranes" BOOLEAN;
ALTER TABLE "pregnancies" ADD COLUMN IF NOT EXISTS "comp_prolonged_labour" BOOLEAN;
ALTER TABLE "pregnancies" ADD COLUMN IF NOT EXISTS "comp_postpartum_hemorrhage" BOOLEAN;
ALTER TABLE "pregnancies" ADD COLUMN IF NOT EXISTS "comp_preeclampsia" BOOLEAN;
ALTER TABLE "pregnancies" ADD COLUMN IF NOT EXISTS "comp_eclampsia" BOOLEAN;
ALTER TABLE "pregnancies" ADD COLUMN IF NOT EXISTS "comp_other" BOOLEAN;
ALTER TABLE "pregnancies" ADD COLUMN IF NOT EXISTS "comp_other_details" TEXT;
ALTER TABLE "pregnancies" ADD COLUMN IF NOT EXISTS "delivery_outcome" TEXT;
ALTER TABLE "pregnancies" ADD COLUMN IF NOT EXISTS "delivery_mode" TEXT;

-- 2. Lesson groups (General / trimesters / Postpartum)
ALTER TABLE "education_modules" ADD COLUMN IF NOT EXISTS "stage" TEXT;

-- Put existing single-week lessons into the matching group
UPDATE "education_modules"
SET "stage" = CASE
  WHEN "week_number" IS NULL THEN 'general'
  WHEN "week_number" <= 13 THEN 'trimester_1'
  WHEN "week_number" <= 27 THEN 'trimester_2'
  ELSE 'trimester_3'
END
WHERE "stage" IS NULL;
