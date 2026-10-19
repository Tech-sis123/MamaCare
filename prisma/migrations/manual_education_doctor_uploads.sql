-- Doctor-managed education content (videos + articles) from the doctor dashboard.
-- Run once in Supabase SQL Editor (or any Postgres client) BEFORE deploying the backend.
-- Safe to re-run: uses IF NOT EXISTS.

ALTER TABLE "education_modules" ADD COLUMN IF NOT EXISTS "content_type" TEXT;
ALTER TABLE "education_modules" ADD COLUMN IF NOT EXISTS "article_url" TEXT;
ALTER TABLE "education_modules" ADD COLUMN IF NOT EXISTS "body" TEXT;
ALTER TABLE "education_modules" ADD COLUMN IF NOT EXISTS "created_by" TEXT;
ALTER TABLE "education_modules" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "education_modules" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- General articles don't belong to a specific pregnancy week
ALTER TABLE "education_modules" ALTER COLUMN "week_number" DROP NOT NULL;
