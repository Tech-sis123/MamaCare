-- Doctor high-risk checklist (risk engine v2).
-- Run once in Supabase SQL Editor (or any Postgres client) BEFORE deploying the backend.
-- Safe to re-run: uses IF NOT EXISTS.

ALTER TABLE "pregnancies" ADD COLUMN IF NOT EXISTS "risk_factors" JSONB;
