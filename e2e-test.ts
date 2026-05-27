import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { env } from './src/config/env';

const prisma = new PrismaClient();
const baseUrl = 'http://localhost:3000';

async function run() {
  console.log('🚀 Starting Comprehensive E2E Test of All Endpoints...\n');
  
  // 1. Get seed data
  const doctor = await prisma.doctor.findUnique({ where: { email: 'dr.adaeze@ubth.ng' } });
  const patient = await prisma.patient.findUnique({ where: { phone_number: '+2348012345678' } });

  if (!doctor || !patient) {
    console.error('❌ Missing seeded data! Make sure npm run db:seed was run.');
    return;
  }

  // 2. Generate valid JWT tokens, bypassing OTP/password flows for rapid testing
  const docToken = jwt.sign({ id: doctor.id, role: doctor.role, type: 'doctor' }, env.JWT_SECRET);
  const patToken = jwt.sign({ id: patient.id, role: 'patient', type: 'patient' }, env.JWT_SECRET);

  let passed = 0;
  let failed = 0;

  async function req(name: string, endpoint: string, method: string, token: string, body?: any) {
    try {
      const res = await fetch(`${baseUrl}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: body ? JSON.stringify(body) : undefined
      });
      const data = await res.json();
      if (res.ok) {
        console.log(`✅ [${method}] ${endpoint} => ${name}`);
        passed++;
        return data;
      } else {
        console.error(`❌ [${method}] ${endpoint} => Failed (${res.status}):`, JSON.stringify(data));
        failed++;
        return null;
      }
    } catch (err) {
      console.error(`❌ [${method}] ${endpoint} => Network Error`);
      failed++;
      return null;
    }
  }

  // ==========================
  // PATIENT FLOW
  // ==========================
  console.log('--- PATIENT ENDPOINTS ---');
  await req('Get Patient Profile', '/patients/me', 'GET', patToken);
  await req('Get Dashboard', '/patients/me/dashboard', 'GET', patToken);
  
  await req('Upsert Biodata', '/patients/profile', 'POST', patToken, {
    name: 'Blessing Test Profile', age: 29, education_level: 'tertiary', occupation: 'banker', marital_status: 'married', address: 'Benin', religion: 'christian', ethnicity: 'bini', language_preference: 'en'
  });
  
  await req('Add Pregnancy', '/patients/pregnancy', 'POST', patToken, {
    lmp_date: '2023-10-01T00:00:00Z', blood_group: 'A+', genotype: 'AA', booking_weight: 60, booking_height: 1.6, booking_bp_systolic: 120, booking_bp_diastolic: 80, rvd_status: 'negative', vdrl: 'non-reactive', pcv: 32, hep_b: 'negative', tetanus_history: '2 doses', gravidity: 1, parity: 0
  });

  await req('Submit Intake Partial', `/intake/${patient.id}`, 'PATCH', patToken, {
    domain: 'medical', responses: [{ question_key: 'hypertension', answer: 'no' }]
  });
  
  await req('Log Symptom', '/symptoms', 'POST', patToken, {
    symptoms: [{ symptom_key: 'headache', severity: 'moderate', notes: 'hurts a lot' }]
  });

  // ==========================
  // DOCTOR FLOW
  // ==========================
  console.log('\n--- DOCTOR ENDPOINTS ---');
  // There is no /alerts/active, alerts are sent via SSE or fetched differently.
  
  const searchPat = await req('Search Patients', '/providers/patients/search?q=Blessing', 'GET', docToken);
  
  if (searchPat && searchPat.patients && searchPat.patients.length > 0) {
    const pId = searchPat.patients[0].id;
    await req('Get Patient Detail', `/providers/patients/${pId}`, 'GET', docToken);
    await req('Get Symptoms Timeline', `/patients/${pId}/symptoms`, 'GET', docToken);
    
    // Book appointment
    await req('Book Appointment', '/appointments/book', 'POST', docToken, {
      patient_id: pId,
      slot_start: new Date(Date.now() + 86400000).toISOString() // Tomorrow
    });
  }

  // ==========================
  // DASHBOARDS
  // ==========================
  console.log('\n--- SYSTEM ENDPOINTS ---');
  await req('Get Education Progress', '/education/progress', 'GET', patToken);

  console.log(`\n🎉 Test Complete! Passed: ${passed}, Failed: ${failed}\n`);
  process.exit(passed > 0 && failed === 0 ? 0 : 1);
}

run();
