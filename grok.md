# MamaCare session context (Grok Build)

Last updated: 2026-08-22 (consultation notes)  
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

**Removed from this screen:** Vitals as a 4th top-level section (vitals now live **inside Consultation notes**).

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

Investigations / Consultation notes were left as accordions until the next Figma batch (now implemented — see below).

### Patient homepage weeks + profile loading

**Problem:** Home showed static **Week 12 of 40** while Profile correctly showed live week (e.g. 24). Profile also flashed Week 12 before load.

**Fixes:**

- `Dashboard.jsx` (`/dashboard`): read `current_ega.weeks` from `GET /patients/me/dashboard` and `/patients/me` (same source as profile). Spinner while loading; no fake Week 12. Honest empty state if no LMP.
- `PatientProfile.jsx`: removed `?? 12` fallback; show loading indicator in pregnancy card until `getPatientMe` returns.

Also tightened dashboard next-appointment / risk / education key reads (`slot_start`, `risk.tier`, `education_module`).

**No SQL** for this part.

### Patient home — risk card copy (HIGH vs Safe & Stable)

`Dashboard.jsx` badge was live (`HIGH RISK`) but the headline was hardcoded **Safe & Stable**. HIGH now shows **Needs close follow-up** (warning icon); MEDIUM **Some monitoring needed**; LOW keeps **Safe & Stable**. Last assessed uses `risk.assessed_at` instead of always “Today”. Profile pregnancy card normalizes `HIGH` / `Low Risk` to the same labels.

**No SQL.**

### Doctor patient chart — Investigations done batch

**Investigations done** is no longer an accordion. Tapping it opens a full **Booking Investigations** screen (`frontend/src/pages/BookingInvestigations.jsx`) and Back returns to the 3-row chart.

Fields (chip selects unless noted):

- Blood group: O / A / B / AB
- Rhesus: + / −
- Genotype: AA / AS / SS / AC / others (others → text field)
- PCV: number
- Malaria parasite: + / ++ / +++ / None
- VDRL, HIV, HCV, HBV: Positive / Negative
- Urinalysis: protein and glucose each + / ++ / +++ / none
- RBG: text
- OGTT: blank text field
- Add investigation: Test done + Result (blank; can add more rows)
- Request investigation: Routine investigations / others

HIV → `rvd_status`; HBV → `hep_b`; HCV → `hep_c`. Protein/glucose/additional/request live in `pregnancies.extra_labs` (JSON). Urinalysis string is composed as `protein: …; glucose: …`.

Blood group / genotype / rhesus still exist on **Booking History** and share the same pregnancy columns — the investigations chips write those same fields (ABO and rhesus stored separately, header shows combined e.g. O+).

TT / IPT / USS were removed from this investigations UI (columns kept; PATCH omits them so they are not wiped).

**Auto-save (outage safety):** versioned local draft `mamacare_consult:v1:<patientId>` written on every change; debounced PATCH (~1.5s) plus flush on tab hide. If the network fails, copy is “Draft saved locally — will sync when online”. Draft overlays server data on reload.

**No SQL** — `extra_labs` already exists. Zod now accepts `extra_labs.additional[]`.

Files: `frontend/src/pages/BookingInvestigations.jsx`, `frontend/src/lib/investigations.js`, `frontend/src/lib/consultationDraft.js`, `frontend/src/pages/PatientDetails.jsx`, `src/modules/providers/schemas.ts`.

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

### Doctor patient chart — Consultation notes batch

**Consultation notes** is no longer a free-text accordion. Tapping it opens a screen with 5 clickable items:

1. **Vitals** — dated table (Date, BP/PR, Wt, Ht, RR, Temp, Urinalysis glucose/protein) plus **Log vitals** dropdown (fields + protein/glucose chips)
2. **Drugs and vaccination given** — prescribed medications; IPT dose + GA; TT dose + GA
3. **Scans done during pregnancy** — date, GA, notes (add more)
4. **Examination** — Lie (Transverse/Oblique/Longitudinal/Indeterminate); Presentation (Cephalic/Breech/Face/Shoulder/Indeterminate); SFH; fetal heart
5. **Important Remarks** — persistent textarea

The vitals **table** is inside Consultation notes (not a top-level chart section). Symptom timeline / escalate stay off this screen.

AI summary + header obstetric line use **G2P1 (1A)** (children alive). Backend summary generator updated the same way.

Persists via existing JSON columns: `vitals_log`, `drugs_vaccines`, `scans_log`, `examination`, `important_remarks`. Auto-save draft still applies.

**No SQL.**

Files: `frontend/src/pages/ConsultationNotes.jsx`, `frontend/src/lib/consultationNotes.js`, `frontend/src/pages/PatientDetails.jsx`, `src/services/summary-generator.ts`.

---

## Waiting on user (next)

1. **More Figma** if anything else on the doctor chart should move (AI summary stay/go, ProviderDashboard).
2. Confirm whether **AI Pre-Consult Summary** should stay above the 3 sections (it still does).
3. Later: **doctor notified of user’s next visit** — channel, timing, copy TBD.
4. **`booking_date` SQL applied** on the Supabase DB this local API uses. Search 500 is fixed; All Patients no longer treats a failed fetch as “No patients found”.
5. Redeploy **frontend + API** (summary G2P1 (1A) is generated on the API).

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

- `frontend/src/pages/ConsultationNotes.jsx` — 5-section consultation notes + vitals table
- `frontend/src/lib/consultationNotes.js` — map / payload
- `frontend/src/pages/PatientDetails.jsx` — notes opens a screen; G2P1 (1A)
- `src/services/summary-generator.ts` — children alive in pre-consult summary
- `grok.md` — this continuity doc
