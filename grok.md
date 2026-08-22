# MamaCare session context (Grok Build)

Last updated: 2026-08-22  
Purpose: keep continuity after chat compaction. Read this before continuing doctor UI / patient homepage work.

---

## Product surfaces

| Role | Routes | Main files |
|------|--------|------------|
| Patient | `/dashboard`, `/profile`, `/intake`, `/appointments`, … | `frontend/src/pages/Dashboard.jsx`, `PatientProfile.jsx`, `Onboarding.jsx` |
| Doctor | `/provider`, `/provider/patient` | `frontend/src/pages/ProviderDashboard.jsx`, `PatientDetails.jsx` |
| API | Render `mamacare-api.onrender.com` | `src/modules/*`, Prisma `prisma/schema.prisma` |

Stack: React/Vite frontend (Vercel) + Express/TS API (Render) + Postgres/Supabase.  
Constraint: **no local `prisma generate`** when locked — if schema changes, give **manual SQL** for the owner to run.

---

## What we are doing overall

Figma-driven **doctor-side UI movements** (mostly reorder / regroup, little new logic), plus patient homepage weeks accuracy, plus a **future** doctor next-visit notification (details TBD).

User sends screenshots in batches. Implement one batch, confirm build, then wait for the next.

---

## Done so far (this thread)

### Doctor patient chart — Booking History batch

File: `frontend/src/pages/PatientDetails.jsx`

When a patient’s name is clicked, show **only 3 clinic sections** (not 4):

1. **Booking History**
2. **Investigations done**
3. **Consultation notes**

**Removed from this screen:** Vitals section (was the 4th).

**Booking History** is **not** an appointment list anymore. It is the **ANC booking form**:

- Header action: **Add Booking** (opens the form)
- Fields:
  - Booking Weight
  - Booking Height
  - Booking BP (sys/dia)
  - Blood Group
  - Genotype
  - Rhesus
  - Gestational Age at Booking
  - Previously booked ANC? (Yes/No)
  - If Yes → facility name
  - Booking Date

Blood Group / Genotype / Rhesus were **moved out of Investigations** into Booking History.

Save still goes through `updateDoctorPregnancy` / existing pregnancy columns.

**Schema addition:** `pregnancies.booking_date`  
SQL (run in Supabase if not already):

```sql
ALTER TABLE "pregnancies" ADD COLUMN IF NOT EXISTS "booking_date" TIMESTAMP(3);
```

File also at: `prisma/migrations/manual_booking_date.sql`  
Backend wired in: `src/modules/providers/schemas.ts`, `controller.ts`, `prisma/schema.prisma`.

AI Pre-Consult Summary + patient header still show above the 3 sections.

Investigations / Consultation notes left largely as-is for now (labs minus blood group/genotype/rhesus) — **user will send more Figma for those next**.

### Patient homepage weeks + profile loading

**Problem:** Home showed static **Week 12 of 40** while Profile correctly showed live week (e.g. 24). Profile also flashed Week 12 before load.

**Fixes:**

- `Dashboard.jsx` (`/dashboard`): read `current_ega.weeks` from `GET /patients/me/dashboard` and `/patients/me` (same source as profile). Spinner while loading; no fake Week 12. Honest empty state if no LMP.
- `PatientProfile.jsx`: removed `?? 12` fallback; show loading indicator in pregnancy card until `getPatientMe` returns.

Also tightened dashboard next-appointment / risk / education key reads (`slot_start`, `risk.tier`, `education_module`).

**No SQL** for this part.

### Earlier (prior segments — still relevant)

- Doctor booking history from appointments was added once, then **replaced** by ANC booking form above.
- Escalate / Refer removed from doctor patient chart.
- Desktop patient chart widened (`max-w-4xl`).
- Intake: obstetric heading “previous delivery”; education level on biodata; some gynae screens removed earlier.
- Don’t treat questionnaire `ERR_INTERNET_DISCONNECTED` as app bugs unless proven.

---

## Architecture notes (quick)

Doctor patient detail API: `GET /providers/patients/:id`  
Pregnancy update: `PATCH /providers/patients/:id/pregnancy`  
Patient dashboard: `GET /patients/me/dashboard` → `{ current_ega, edd, next_appointment, risk, education_module }`  
Patient me: `GET /patients/me` → includes `current_ega`, pregnancies  

Note: pregnancy column `booking_history` (string) ≠ shaped appointment list formerly exposed as `patient.booking_history` on detail. UI Booking History now = ANC booking fields on pregnancy.

Unused / legacy: `frontend/src/pages/PatientDashboard.jsx` is **not** routed (`App.jsx` uses `Dashboard.jsx`).

---

## Waiting on user (next)

1. **More Figma screenshots** for remaining doctor chart work — especially:
   - **Investigations done** layout / fields / Add flow
   - **Consultation notes** if it changes
   - Any other moved components (vitals elsewhere?, remove AI summary?, ProviderDashboard moves)
2. Confirm whether **AI Pre-Consult Summary** should stay above the 3 sections (Image 1 only called out the 3 accordions).
3. Later: **doctor notified of user’s next visit** — channel, timing, copy TBD. Hooks already exist: appointments, queue, patient SMS reminder job (`src/jobs/appointmentReminder.ts`) — doctor-facing notify not built yet.
4. User should run **`booking_date` SQL** on Supabase if not done.
5. Redeploy frontend (and API if `booking_date` + provider patch need to be live).

---

## How to continue after compact

1. Read this file.
2. Wait for / open the next image batch.
3. Diff against current `PatientDetails.jsx` section order and fields.
4. Prefer frontend-only moves; SQL only for new columns.
5. Build (`frontend` vite + API `tsc --noEmit` if backend touched).
6. Push to `main` when user asks.

---

## Constraints to keep

- Minimal surface area — don’t rewrite unrelated intake/patient flows unless asked.
- Manual SQL for schema; don’t rely on local prisma generate.
- Confirm build before push when asked.
- Browser-verify UI when tools available; otherwise note what wasn’t verified.
- If schema changes: paste the SQL in the reply.

---

## Files touched in latest work (expect in upcoming commit)

- `frontend/src/pages/PatientDetails.jsx` — 3 sections + ANC Booking History
- `frontend/src/pages/Dashboard.jsx` — live EGA + loading
- `frontend/src/pages/PatientProfile.jsx` — loading instead of Week 12 flash
- `prisma/schema.prisma` — `booking_date`
- `prisma/migrations/manual_booking_date.sql`
- `src/modules/providers/schemas.ts` — `booking_date`
- `src/modules/providers/controller.ts` — persist `booking_date`
- `grok.md` — this continuity doc
