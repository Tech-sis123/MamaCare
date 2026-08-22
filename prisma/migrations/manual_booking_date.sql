-- MamaCare: ANC booking date on pregnancies
-- Run once in Supabase SQL Editor (or any Postgres client).
-- Safe to re-run: uses IF NOT EXISTS.

ALTER TABLE "pregnancies" ADD COLUMN IF NOT EXISTS "booking_date" TIMESTAMP(3);
