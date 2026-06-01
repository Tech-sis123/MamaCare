import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { detectDangerSigns } from '../src/modules/symptoms/dangerDetection';
import { SymptomInput } from '../src/utils/types';

// Mock the services and DB
vi.mock('../src/middleware/auth', () => {
  return {
    authenticate: (req: any, res: any, next: any) => {
      req.user = { id: 'patient-uuid-123', role: 'patient', type: 'patient' };
      next();
    },
  };
});

vi.mock('../src/middleware/rbac', () => {
  return {
    rbac: () => (req: any, res: any, next: any) => next(),
  };
});

vi.mock('../src/config/prisma', () => {
  return {
    default: {
      patient: {
        findUnique: vi.fn(),
      },
      symptom: {
        create: vi.fn(),
      },
      dangerAlert: {
        create: vi.fn(),
        update: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      notificationsLog: {
        create: vi.fn(),
      },
      systemConfig: {
        findFirst: vi.fn(),
      },
    },
  };
});

vi.mock('../src/config/redis', () => {
  const mockRedis = {
    get: vi.fn(),
    set: vi.fn(),
    lpush: vi.fn(),
    ltrim: vi.fn(),
    publish: vi.fn(),
  };
  return {
    redis: mockRedis,
  };
});

vi.mock('../src/services/termii', () => {
  return {
    termiiService: {
      sendSMS: vi.fn().mockResolvedValue({ message_id: 'sms-123' }),
    },
  };
});

vi.mock('../src/services/whatsapp', () => {
  return {
    whatsappService: {
      sendMessage: vi.fn().mockResolvedValue({ message_id: 'wa-123' }),
    },
  };
});

describe('Danger Sign Detection Rules', () => {
  it('should detect vaginal bleeding of any severity', () => {
    const symptoms: SymptomInput[] = [{ symptom_key: 'vaginal_bleeding', severity: 'mild' }];
    const res = detectDangerSigns(symptoms, {});
    expect(res.is_danger).toBe(true);
    expect(res.triggers[0].trigger_key).toBe('vaginal_bleeding');
  });

  it('should detect severe abdominal pain', () => {
    const symptoms: SymptomInput[] = [{ symptom_key: 'abdominal_pain', severity: 'severe' }];
    const res = detectDangerSigns(symptoms, {});
    expect(res.is_danger).toBe(true);
    expect(res.triggers[0].trigger_key).toBe('severe_abdominal_pain');
  });

  it('should NOT trigger for moderate abdominal pain', () => {
    const symptoms: SymptomInput[] = [{ symptom_key: 'abdominal_pain', severity: 'moderate' }];
    const res = detectDangerSigns(symptoms, {});
    expect(res.is_danger).toBe(false);
  });

  it('should detect reduced fetal movement after 28 weeks', () => {
    const symptoms: SymptomInput[] = [{ symptom_key: 'reduced_fetal_movement', severity: 'mild' }];
    const res = detectDangerSigns(symptoms, { ega_weeks: 30 });
    expect(res.is_danger).toBe(true);
    expect(res.triggers[0].trigger_key).toBe('reduced_fetal_movement');
  });

  it('should NOT detect reduced fetal movement before 28 weeks', () => {
    const symptoms: SymptomInput[] = [{ symptom_key: 'reduced_fetal_movement', severity: 'mild' }];
    const res = detectDangerSigns(symptoms, { ega_weeks: 24 });
    expect(res.is_danger).toBe(false);
  });

  it('should detect severe headache with high BP', () => {
    const symptoms: SymptomInput[] = [{ symptom_key: 'severe_headache', severity: 'moderate' }];
    const res = detectDangerSigns(symptoms, { bp_systolic: 145, bp_diastolic: 95 });
    expect(res.is_danger).toBe(true);
    expect(res.triggers[0].trigger_key).toBe('headache_high_bp');
  });
});

import request from 'supertest';
import express from 'express';
import symptomsRouter from '../src/modules/symptoms/routes';
import prisma from '../src/config/prisma';
import { redis } from '../src/config/redis';
import { termiiService } from '../src/services/termii';
import { whatsappService } from '../src/services/whatsapp';

describe('Danger Alert Pipeline Integration', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    // Mock a simple auth middleware injecting patient user
    app.use((req: any, res, next) => {
      req.user = { id: 'patient-uuid-123', role: 'patient', type: 'patient' };
      next();
    });
    app.use('/symptoms', symptomsRouter);
  });

  it('should execute the 4 core side-effects when danger signs are logged', async () => {
    // 1. Setup mocks
    vi.mocked(redis.get).mockResolvedValue(null); // No cached idempotency response
    vi.mocked(prisma.patient.findUnique).mockResolvedValue({
      id: 'patient-uuid-123',
      phone_number: '+2348012345678',
      name: 'Jane Doe',
      primary_doctor_id: 'doctor-uuid-999',
      age: 26,
      education_level: null,
      occupation: null,
      marital_status: null,
      address: null,
      religion: null,
      ethnicity: null,
      language_preference: 'en',
      created_at: new Date(),
      pregnancies: [],
    });
    vi.mocked(prisma.symptom.create).mockResolvedValue({} as any);
    vi.mocked(prisma.dangerAlert.create).mockResolvedValue({
      id: 'alert-uuid-555',
      patient_id: 'patient-uuid-123',
      doctor_id: 'doctor-uuid-999',
      triggers: [],
      severity: 'critical',
      status: 'open',
      sms_sent_at: null,
      whatsapp_sent_at: null,
      acknowledged_at: null,
      created_at: new Date(),
    });

    const response = await request(app)
      .post('/symptoms')
      .set('Idempotency-Key', 'unique-key-111')
      .send({
        symptoms: [
          { symptom_key: 'vaginal_bleeding', severity: 'moderate', notes: 'Spotted morning' },
        ],
      });

    // Expecting 201 Created and emergency payload response
    if (response.status !== 201) {
      console.error('Test failed with error:', response.body);
    }
    expect(response.status).toBe(201);
    expect(response.body.danger_alert.severity).toBe('critical');

    // Assertion 1: Postgres DangerAlert Row Written
    expect(prisma.dangerAlert.create).toHaveBeenCalled();

    // Assertion 2: SMS sent via Termii to Patient
    expect(termiiService.sendSMS).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '+2348012345678',
        sms: expect.stringContaining('Vaginal bleeding'),
      })
    );

    // Assertion 3: WhatsApp message sent via Meta API
    expect(whatsappService.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '+2348012345678',
        message: expect.stringContaining('Vaginal bleeding'),
      })
    );

    // Assertion 4: Redis LPUSH and PUBLISH to doctor
    expect(redis.lpush).toHaveBeenCalledWith(
      'doctor:doctor-uuid-999:active_alerts',
      expect.stringContaining('alert-uuid-555')
    );
    expect(redis.publish).toHaveBeenCalledWith(
      'doctor:doctor-uuid-999:alerts',
      expect.stringContaining('alert-uuid-555')
    );
  });
});
