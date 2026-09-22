# 9Care AI

> **Important Naming Note:**  
> This project is officially called **9Care AI** (or **9Care**).  
> Although the local directory path on disk and repository name are `MamaCare` (the legacy working name), all public branding, user interfaces, documentation, and product communications are branded as **9Care AI**.

---

## About 9Care AI

**9Care AI** is a mobile-first digital antenatal care platform designed to assist expectant mothers and healthcare providers. It provides:
- **For Expectant Mothers:** Guided self-intake & biodata reporting, pregnancy tracking, symptom reporting with triage and danger sign alerts, and gestational-age-specific health education.
- **For Healthcare Providers (Doctors / Midwives):** Streamlined patient triage, digital antenatal clerking records, clinical summaries, and risk stratification based on WHO-aligned guidelines.

---

## Architecture & Tech Stack

- **Frontend:** React + Vite, Tailwind CSS / Vanilla styling (Vercel deployment: `9careai.com`)
- **Backend API:** Node.js + TypeScript + Express (Render deployment)
- **Database:** PostgreSQL with Prisma ORM (hosted on Supabase)
- **Services & Integrations:** 
  - Termii (SMS notifications & OTP)
  - Google Gemini AI (clinical assistant & guidance summaries)

---

## Directory Structure

```
MamaCare/ (Local workspace folder)
├── frontend/             # React + Vite frontend application (9Care AI)
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── pages/        # Patient & Provider pages (Onboarding, Dashboard, Clerking records)
│   │   └── lib/          # Client API & utility helpers
├── src/                  # Node.js / Express backend service
│   ├── config/           # Environment and server configuration
│   ├── modules/          # Auth, Patient, Provider, Appointment, and Admin modules
│   └── services/         # AI, SMS, and notification services
├── prisma/               # Database schema & migrations
└── grok.md               # Continuous development & session context
```

---

## Running Locally

### Backend
```bash
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```
