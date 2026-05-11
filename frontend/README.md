A I W O M E N R I S I N G — C O N F I D E N T I A L
Mama Care AI
Project Scope
MVP Sprint → Hackathon → Full Product Build
P H A S E 1 D U R A T I O N
P H A S E 1 T E A M
3 Weeks
4 People
P H A S E 2 D U R A T I O N
3 Months
P I L O T T A R G E T
200 Women
0 1 What We're Building
Mama Care AI is a mobile-first antenatal care platform targeting first-trimester pregnant
women at the University of Benin Teaching Hospital (UBTH). This scope covers the full build
lifecycle: a lean 3-week MVP sprint with a 4-person team, a hackathon to stress-test and
extend it, and a 3-month build with a full team to ship the complete product.
⚕ The clinical safety core — danger sign detection, emergency alerts, and risk stratification — must be
production-grade from Day 1 of the MVP. Everything else can iterate. These three features cannot.
0 2 Phase 1 — MVP Sprint
The MVP
T H E T E A M
F R O N T E N D D E V E L O P E R
Mobile App (React Native / Android)
OTP registration screen + offline caching—
Card-based intake questionnaire with branching logic—
Risk tier display (patient-facing, plain language)—
Appointment booking & calendar UI—
Danger sign reporting screen + full-screen red alert—
Education module viewer (video/audio/text)—
Offline-first SQLite/Room integration with sync UI—
B A C K E N D D E V E L O P E R
API + Infrastructure
5 core API endpoints (registration, intake, risk, appointments, danger alerts)—
SMS OTP gateway (Termii or Twilio)—
Priority sync queue — danger alerts processed first—
PostgreSQL schema (patients, pregnancies, visits, risk assessments)—
JWT auth + RBAC (patient, doctor, admin roles)—
WhatsApp notification via Twilio/Meta—
AWS Cape Town deployment + CI/CD pipeline—
U I / U X D E S I G N E R
Product Design
Full design system (components, colors, icons, 16sp+ typography)—
Figma prototype — all P0 screens, English + Pidgin—
Low-literacy design: icons + text, visual danger signs—
Provider dashboard wireframes (patient queue + summary)—
Usability test with 3–5 women before dev handoff—
WCAG AA contrast compliance check—
Design handoff specs + component annotations—
A I E N G I N E E R
Intelligence Layer
Rule-based risk stratification engine (on-device, deterministic)—
Decision tree: age, BP, Hb, genotype, parity, history → LOW/MEDIUM/HIGH—
Danger sign detection logic (9 triggers from PRD §3.4.2)—
Template-based pre-consult summary generator—
Graceful degradation: unknown inputs → escalate tier, never downgrade—
Engine audit logging (input snapshot, output, model version)—
Validate rules against WHO + Nigerian clinical guidelines—
W E E K - B Y - W E E K B R E A K D O W N
WEEK 1
Foundation & Core Safety
·
·
·
·
UI/UX Finalize design system + all P0 screen designs. Deliver handoff specs by end of Week 1.
Backend Stand up AWS infrastructure, DB schema, auth system, SMS OTP. All 5 API endpoints stubbed.
Frontend wired up.
Project scaffold, design system integrated, registration flow built (OTP + profile). Offline SQLite
AI Risk stratification engine built, unit-tested with clinical edge cases. Danger sign detection logic complete.
Clinical review started.
WEEK 2
Core Features & Integration
·
·
·
·
Frontend full-screen red alert. Risk tier display.
Intake questionnaire (all 5 domains, branching logic, auto-save). Danger sign reporting screen +
Backend second SLA enforced.
All 5 endpoints live. Priority sync queue. SMS + WhatsApp notifications. Danger alert pipeline — 60-
AI Pre-consult summary generator. Integrate engine with mobile app. Audit logging. Clinical rule validation
completed by 2 UBTH obstetricians.
UI/UX Provider dashboard design complete. Begin usability testing with target users. Pidgin UI copy finalized.
WEEK 3
Integration, Provider Dashboard & Hardening
·
Frontend completion bar. Full end-to-end flow tested.
Appointment booking UI. Education module viewer (offline pre-download). Progressive profile
Backend Provider dashboard API. Notification reminders scheduler (48hr + 2hr). Conflict resolution +·
·
·
idempotency keys. Load test on 3G simulation.
All provider dashboard.
Integration testing: full patient journey from registration → intake → risk → booking → danger alert →
All Crash rate target: <1% of sessions. Performance: app start <3s on 2GB RAM. APK <15MB. Test on
Tecno Spark + Itel A58.
M V P D E L I V E R A B L E S ( E N D O F W E E K 3 )
P0 — Ships in MVP P1 — Stretch goal Deferred to Phase 2
Phone-based registration with SMS OTP — Offline-capable, local-first storage, Patient ID generation
AI-guided intake questionnaire — 5 domains, branching logic, auto-save, plain-language tooltips,
English + Pidgin
Rule-based risk stratification engine — 3 tiers, runs on-device, auditable, validated by UBTH doctors
Danger sign detection + emergency alerts — 9 triggers, 3-channel notification within 60 seconds
Staggered appointment booking — 30-minute slots, SMS + push reminders, reschedule support
15 pregnancy education modules — Video + audio + text, offline pre-download, weeks 6–40
Provider dashboard (web) — Patient queue with risk tier badges, pre-consult summary, red-tier patients
pinned top
Basic patient record — Intake data, risk history, appointment log, provider notes, audit trail
Risk overview dashboard for department head — Risk distribution chart, exportable PDF
Internal referral system — Doctor-to-specialist referral with auto record transfer
⛔ NOT IN MVP — Do Not Scope These
⚠
⚠
⚠
⚠
⚠
⚠
Virtual consultations (audio/video via WebRTC) — Phase 2
ML-based risk models (XGBoost / Random Forest) — need Phase 1 training data
Multi-language voice input (Yoruba, Hausa, Edo) — Phase 2
Payment processing for consultations — Phase 2
Hospital EMR integration (FHIR) — Phase 3
IVR/USSD fallback for feature phones — Phase 3
M V P S U C C E S S C R I T E R I A ( G A T E T O H A C K A T H O N )
Metric Target How Measured
Registration completion rate ≥ 90% App analytics
Intake completion rate ≥ 75% within 48 hours App analytics
Danger sign alert delivery 100% within 60 seconds Server logs
App crash rate < 1% of sessions Firebase Crashlytics
App startup time (2GB device) < 3 seconds Manual + automated test
APK size < 15 MB Build output
API response time (3G) < 2 seconds Network throttle test
Clinical rule validation Signed off by 2 UBTH obstetricians Clinical review sign-off doc
0 3 The Hackathon
Hackathon
The hackathon is not a demo event — it's a working session. The MVP is the base. Participants extend it,
stress-test it, and build features that accelerate Phase 2. The best contributions get pulled into the main
product and the builders get hired onto the expanded team.
S U G G E S T E D C H A L L E N G E T R A C K S
Track Challenge
Track A —
AI/ML
Build a prototype ML risk model (logistic regression baseline) using synthetic
or de-identified Nigerian ANC data. Must outperform the rule-based engine on
edge cases.
Implement the virtual consultation UI (audio-first) that slots into the existing
React Native app. Must work on 3G with graceful degradation on 2G.
Track B —
Mobile
Track C —
Localization
Add Yoruba or Hausa voice input and text-to-speech using Google Speech API.
All danger sign screens must work in the target language with visual fallback.
Track D —
Provider
Tools
Build the no-show prediction model and the appointment optimization
interface for the provider dashboard. Predict likelihood per patient, surface in
the queue view.
Skills
Needed
AI/ML
Python
Frontend
WebRTC
Frontend
NLP
AI/ML
Frontend
Track E —
Community
Health
Design and prototype the CHW (Community Health Worker) mobile interface:
patient outreach list, follow-up logging, and escalation pathway for 3-no-show
patients.
UI/UX
Frontend
J U D G I N G C R I T E R I A
Criterion Weight What Judges Look For
Clinical Safety 30% Does it handle edge cases without endangering a patient?
Technical Quality 25% Code quality, architecture, offline readiness
Integration Fit 25% Can it be merged into the existing MVP codebase in <1 sprint?
User Impact 20% Does it meaningfully improve the experience for Mama Efe or Dr. Osagie?
Hackathon output: Shortlist of 3–5 new contributors. Best code contributions reviewed for merge
into Phase 2 codebase. Winning track builders offered roles on the expanded team.
0 4 Phase 2 — Main Product
Full Product Build
Phase 2 is where we graduate from MVP to a complete product. The original 4-person team leads, expanded
by hackathon contributors and new hires. Target: 2,000–5,000 patients, 5 hospitals. Every Phase 1 success
criteria must already be met before this phase begins.
E X P A N D E D T E A M ( R E C O M M E N D E D )
C A R R Y - O V E R
Frontend Developer (Lead)
C A R R Y - O V E R
Backend Developer (Lead)
C A R R Y - O V E R
UI/UX Designer (Lead)
C A R R Y - O V E R
AI/ML Engineer (Lead)
N E W H I R E
2nd Frontend Developer
N E W H I R E
2nd Backend / DevOps
N E W H I R E
QA / Testing Engineer
N E W H I R E
Clinical Informatics Specialist
H A C K A T H O N → H I R E
1–2 Contributors (Track Winner)
M O N T H - B Y - M O N T H B U I L D P L A N
MONTH 1 — Intelligence
→
→
→
Train ML risk model on Phase 1 patient data (LR + RF ensemble)→
Shadow-run ML alongside rule engine, compare outputs
NLP symptom triage (free-text → urgency classification)→
Begin virtual consultation backend (WebRTC signaling server)→
Paystack payment integration for consult fees
Yoruba + Hausa UI copy and TTS integration starts
MONTH 2 — Connectivity
→
→
Virtual consultation UI live (audio-first, video optional)→
Patient-to-midwife chat interface (WhatsApp-style)→
No-show prediction model integrated in booking
UBTH lab result integration (manual entry → semi-automated)→
Yoruba + Hausa + Edo languages fully released
Voice input for symptom reporting (Google Speech API)→
CHW outreach interface (mobile web)→
MONTH 3 — Scale
ML risk model promoted to primary (rules as fallback)→
Multi-hospital onboarding (2 additional Edo State sites)→
→
→
→
→
→
Advanced analytics dashboard for state health officials
DHIS2 integration for national health reporting
Cross-hospital referral with automatic record transfer
Full security audit + NDPA compliance re-certification
Public launch preparation + press materials
P H A S E 2 S U C C E S S C R I T E R I A
Metric Target
Total active patients Average clinic wait time Appointment adherence ML model accuracy (risk tier) 2,000 – 5,000 across ≥ 2 hospitals
< 1 hour for app users (vs 6+ hour baseline)
≥ 75% (vs ~50% baseline)
≥ 85% agreement with clinician override decisions
Virtual consultation adoption Patient satisfaction score Provider time savings ≥ 40% of low-risk follow-up visits done virtually
≥ 4.2 / 5.0 on post-visit survey
Doctors report < 5 min per patient history review (vs 15+ min baseline)
Danger sign alert SLA 100% within 60 seconds — maintained from Phase 1
0 5 Key Risks
Risk Likelihood Mitigation
Clinical rule errors in
risk engine
SMS OTP failures on
2G
Education content not
medically reviewed in
time
3-week timeline is very
tight for 4 people
High
impact
Medium Medium High Mandatory sign-off by 2 UBTH obstetricians before MVP ships. Graceful
degradation to MEDIUM risk on engine failure.
WhatsApp OTP fallback built in Week 1. 60-second resend timer. Tested
on Airtel/MTN 2G simulation.
Launch with 7 highest-priority modules. Add remaining 8 in Week 1 of
Phase 2. Never ship unreviewed health content.
Low-literacy users
abandoning the intake
form
Provider dashboard
rejected by Professor
Adesuwa
Medium P1 features (referral system, risk overview dashboard) are explicitly out of
scope. Team focuses only on P0. Daily standups. Week 3 is integration-
only — no new features.
One-question-per-screen design. Pidgin copy. Visual icons on every
question. Usability test with real users before dev handoff.
Medium 3-click maximum to see what she needs. No training required. Demo to
clinical staff in Week 3 before pilot launch. Iterate immediately on
feedback.
Mama Care AI — Project Scope v1.0 — AI Women Rising Pilot: UBTH, Benin City — Confidential