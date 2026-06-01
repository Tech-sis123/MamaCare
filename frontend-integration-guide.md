# MamaCare AI - Frontend Integration Guide

Welcome to the MamaCare API! This document provides all the necessary information to successfully connect your frontend application to the backend.

## Base URL
- **Local Development:** `http://localhost:3000`
- **Production:** `https://mamacare-api.onrender.com`

---

## 1. Authentication & Headers

The backend uses **JWT (JSON Web Tokens)** for securing all private endpoints.

### Required Headers
For any protected route, you must include the following header:
```http
Authorization: Bearer <your_access_token>
```
For routes that create resources (like booking appointments or logging symptoms), you must include an **Idempotency-Key** to prevent accidental duplicate submissions if the user clicks twice or has slow internet. Generate a unique UUID on the frontend for each submission.
```http
Idempotency-Key: <unique_uuid_v4>
```

---

## 2. Patient Authentication Flow (OTP)

Patients do not use passwords. They log in via an SMS OTP flow powered by Termii.

### Step 1: Request OTP
**`POST /auth/patient/otp/request`**
```json
// Request Body
{
  "phone_number": "+2347048413823"
}

// Response (200 OK)
{
  "pin_id": "d2c1456b-5fbd-4080-ba48-2819bbfd4906"
}
```

### Step 2: Verify OTP
**`POST /auth/patient/otp/verify`**
```json
// Request Body
{
  "pin_id": "d2c1456b-5fbd-4080-ba48-2819bbfd4906",
  "code": "123456"
}

// Response (200 OK)
{
  "access_token": "eyJhbGciOi...",
  "refresh_token": "eyJhbGciOi...",
  "patient": {
    "id": "186c1df8-d67d-4519-9e89...",
    "phone_number": "+2347048413823",
    "name": null
  }
}
```
*Note: Store the `access_token` securely (e.g., in Secure HttpOnly Cookies or Encrypted LocalStorage) and attach it to the `Authorization` header for all subsequent requests.*

---

## 3. Doctor Authentication Flow

Doctors use standard email/password authentication.

**`POST /auth/doctor/login`**
```json
// Request Body
{
  "email": "dr.adaeze@ubth.ng",
  "password": "mamacare123"
}

// Response (200 OK)
{
  "access_token": "eyJhbGci...",
  "refresh_token": "eyJhbGci...",
  "doctor": {
    "id": "...",
    "name": "Dr. Adaeze Okonkwo",
    "email": "dr.adaeze@ubth.ng",
    "role": "doctor" // or "department_head"
  }
}
```

---

## 4. Patient Core Endpoints

*(Requires Patient `access_token`)*

### Get Current Profile & Dashboard Data
**`GET /patients/me`** - Returns the full patient biodata and their latest pregnancy record.
**`GET /patients/me/dashboard`** - Returns a lightweight dashboard summary including current Gestational Age (EGA), next appointment, latest risk tier, and the recommended weekly educational module.

### Upsert Biodata (Profile Setup)
**`POST /patients/profile`**
```json
{
  "name": "Blessing Okafor",
  "age": 28,
  "education_level": "tertiary",
  "occupation": "teacher",
  "marital_status": "married",
  "address": "Benin City",
  "religion": "Christian",
  "ethnicity": "Bini",
  "language_preference": "en" // "en" or "pidgin"
}
```

### Add Pregnancy Record (Booking Setup)
**`POST /patients/pregnancy`**
```json
{
  "lmp_date": "2023-10-01T00:00:00Z",
  "blood_group": "O+",
  "genotype": "AA",
  "booking_weight": 65.5,
  "booking_height": 165,
  "booking_bp_systolic": 120,
  "booking_bp_diastolic": 80,
  "rvd_status": "negative",
  "vdrl": "non-reactive",
  "pcv": 33,
  "hep_b": "negative",
  "tetanus_history": "2 doses",
  "gravidity": 1,
  "parity": 0
}
```

### Book an Appointment
**`POST /appointments`**
*(Requires `Idempotency-Key` header)*
```json
{
  "doctor_id": "uuid-of-doctor",
  "slot_start": "2024-11-20T10:00:00Z"
}
```

### Get Available Appointment Slots
**`GET /appointments/available?date=2024-11-20&doctor_id=uuid-of-doctor`**

### Get Educational Modules & AI Personalized Lessons
**`GET /education/modules`**
Returns a list of clinical learning modules for the mother. The backend automatically determines the mother's current pregnancy week and dynamically generates a personalized AI lesson (if the OpenAI key is configured). It also pins critical danger sign lessons for high-risk patients.

### Mark Education Module as Completed
**`PATCH /education/progress`**
```json
{
  "module_id": "uuid-of-module"
}
```


---

## 5. Intake & Clinical Workflows

### Save Partial Intake Form
**`PATCH /intake/:patientId`**
*Used for auto-saving form steps so users don't lose progress.*
```json
{
  "domain": "medical",
  "responses": [
    { "question_key": "hypertension", "answer": "no" },
    { "question_key": "diabetes", "answer": "yes" }
  ]
}
```

### Submit Full Intake (Triggers AI Risk Engine)
**`POST /intake/:patientId/submit`**
*Marks the intake as complete and automatically runs the AI Risk Engine to generate a High/Medium/Low risk tier for the patient.*

### Log a Symptom
**`POST /symptoms`**
*(Requires `Idempotency-Key` header)*
```json
{
  "symptoms": [
    {
      "symptom_key": "headache",
      "severity": "moderate", // "mild", "moderate", "severe"
      "notes": "Throbbing pain behind eyes"
    }
  ]
}
```

---

## 6. Doctor & System Endpoints

*(Requires Doctor `access_token`)*

### Search for Patients
**`GET /providers/patients/search?q=Blessing`**
Returns a list of matching patients.

### Get Patient Symptom Timeline
**`GET /patients/:patientId/symptoms?range=30d`**
Returns historical symptoms for the last 30 days for a specific patient.

### Subscribe to Live Danger Alerts (SSE)
**`GET /alerts/subscribe`**
*This is a Server-Sent Events (SSE) stream. Connect to this endpoint to receive real-time push notifications when a patient logs a critical symptom (like bleeding) or hits a High-Risk tier.*

### Acknowledge Alert
**`POST /alerts/:alertId/acknowledge`**
Silences the push notifications/alarms for a specific alert so other doctors know someone is handling it.

---

## 7. Standard Error Handling

All failed requests will return a standard JSON error response. The frontend should gracefully handle these.

```json
// Example 400 Bad Request (Validation Error)
{
  "error": "validation_failed",
  "issues": [
    {
      "path": "phone_number",
      "message": "Invalid phone number format"
    }
  ]
}

// Example 401 Unauthorized
{
  "error": "Unauthorized Error",
  "message": "Invalid or expired OTP"
}
```
