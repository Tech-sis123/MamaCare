import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

vi.mock('../src/config/redis', () => {
  return {
    redis: {
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(null),
    },
  };
});

vi.mock('../src/config/prisma', () => {
  return {
    default: {
      patient: {
        upsert: vi.fn().mockResolvedValue({ id: 'patient-id', phone_number: '+2348012345678' }),
      },
    },
  };
});

import app from '../src/index';

describe('Endpoint Zod Validation and Auth Routing', () => {
  it('should return 400 validation_failed on invalid request body to patient otp request', async () => {
    const res = await request(app)
      .post('/auth/patient/otp/request')
      .send({ phone_number: 'short' }); // Invalid format: too short

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
    expect(res.body.issues).toBeDefined();
    expect(res.body.issues[0].path).toBe('phone_number');
  });

  it('should return 401 Unauthorized for route without headers', async () => {
    const res = await request(app).get('/patients/me');
    expect(res.status).toBe(401);
  });
});
