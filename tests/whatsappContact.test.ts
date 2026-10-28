import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/config/redis', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  return { redis: new RedisMock() };
});

vi.mock('../src/config/prisma', () => ({
  default: {
    patient: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  },
}));

vi.mock('../src/services/termii', () => ({
  termiiService: { sendSMS: vi.fn().mockResolvedValue({}) },
}));

import prisma from '../src/config/prisma';
import { redis } from '../src/config/redis';
import { normalizeWhatsappNumber } from '../src/utils/contact';
import { whatsappSchema } from '../src/modules/patients/schemas';
import {
  needsWhatsappPrompt,
  whatsappContact,
  whatsappRecipient,
  whatsappStatus,
} from '../src/services/whatsappContact';
import { authController } from '../src/modules/auth/controller';

describe('WhatsApp number format', () => {
  it('stores Nigerian numbers with the country code however they are typed', () => {
    for (const typed of ['0801 234 5678', '08012345678', '801-234-5678', '2348012345678', '+234 801 234 5678']) {
      expect(normalizeWhatsappNumber(typed)).toBe('+2348012345678');
    }
  });

  it('accepts other countries when typed with + and the country code', () => {
    expect(normalizeWhatsappNumber('+44 7911 123456')).toBe('+447911123456');
  });

  it('rejects numbers that are not valid', () => {
    for (const typed of ['', 'abc', '0801234', '0601 234 5678', '0801 234 56789', 'email-123', '447911123456']) {
      expect(normalizeWhatsappNumber(typed)).toBeNull();
    }
  });

  it('needs the consent box ticked to save', () => {
    expect(whatsappSchema.safeParse({ whatsapp_number: '08012345678' }).success).toBe(false);
    expect(whatsappSchema.safeParse({ whatsapp_number: '08012345678', consent: false }).success).toBe(false);
    expect(whatsappSchema.safeParse({ whatsapp_number: 'abc', consent: true }).success).toBe(false);
    expect(whatsappSchema.parse({ whatsapp_number: '0801 234 5678', consent: true }).whatsapp_number).toBe('+2348012345678');
  });
});

describe('WhatsApp pop-up and status', () => {
  const recovered = new Date('2026-10-01T10:00:00Z');

  it('asks after account recovery until a number is saved', () => {
    expect(needsWhatsappPrompt({ account_recovered_at: recovered, whatsapp_number: null })).toBe(true);
    expect(needsWhatsappPrompt({ account_recovered_at: recovered, whatsapp_number: '+2348012345678' })).toBe(false);
    expect(needsWhatsappPrompt({ account_recovered_at: null, whatsapp_number: null })).toBe(false);
  });

  it('offers her sign-up phone only when it is a real number', () => {
    expect(whatsappStatus({ phone_number: '08012345678' }).phone_number).toBe('+2348012345678');
    expect(whatsappStatus({ phone_number: 'email-1712345678' }).phone_number).toBeNull();
  });

  it('is never shown as verified yet, and consent time is hidden after withdrawal', () => {
    const at = new Date();
    expect(whatsappStatus({ whatsapp_number: '+2348012345678', whatsapp_consent: true, whatsapp_consent_at: at })).toMatchObject({
      number: '+2348012345678',
      consent: true,
      consent_at: at,
      verified: false,
      prompt: false,
    });
    expect(whatsappStatus({ whatsapp_number: '+2348012345678', whatsapp_consent: false, whatsapp_consent_at: at }).consent_at).toBeNull();
  });
});

describe('who gets WhatsApp messages', () => {
  it('sends nothing once she withdraws consent', () => {
    expect(whatsappRecipient({ phone_number: '+2348011111111', whatsapp_number: '+2348022222222', whatsapp_consent: false })).toBeNull();
  });

  it('uses her WhatsApp number when she gave one', () => {
    expect(whatsappRecipient({ phone_number: '+2348011111111', whatsapp_number: '+2348022222222', whatsapp_consent: true })).toBe(
      '+2348022222222'
    );
  });

  it('keeps using the sign-up phone for accounts that were never asked', () => {
    expect(whatsappRecipient({ phone_number: '+2348011111111', whatsapp_consent: null })).toBe('+2348011111111');
    expect(whatsappRecipient({ phone_number: 'email-1712345678', whatsapp_consent: null })).toBeNull();
  });
});

describe('saving and withdrawing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.patient.update).mockImplementation(async ({ data }: any) => data as any);
  });

  it('saves a new number as not verified, with consent and its time', async () => {
    vi.mocked(prisma.patient.findUnique).mockResolvedValue({ whatsapp_number: null, whatsapp_consent: null } as any);
    await whatsappContact.saveNumber('p1', '+2348012345678', 'prompt');
    const data = vi.mocked(prisma.patient.update).mock.calls[0][0].data as any;
    expect(data).toMatchObject({ whatsapp_number: '+2348012345678', whatsapp_consent: true, whatsapp_verified: false, whatsapp_verified_at: null });
    expect(data.whatsapp_consent_at).toBeInstanceOf(Date);
    expect(vi.mocked(prisma.auditLog.create).mock.calls[0][0].data.action).toBe('whatsapp_number_saved');
  });

  it('keeps verification and the original consent time when the same number is saved again', async () => {
    vi.mocked(prisma.patient.findUnique).mockResolvedValue({ whatsapp_number: '+2348012345678', whatsapp_consent: true } as any);
    await whatsappContact.saveNumber('p1', '+2348012345678', 'profile');
    const data = vi.mocked(prisma.patient.update).mock.calls[0][0].data as any;
    expect(data).not.toHaveProperty('whatsapp_verified');
    expect(data).not.toHaveProperty('whatsapp_consent_at');
  });

  it('records a new consent time when she turns messages back on', async () => {
    vi.mocked(prisma.patient.findUnique).mockResolvedValue({ whatsapp_number: '+2348012345678', whatsapp_consent: false } as any);
    await whatsappContact.saveNumber('p1', '+2348012345678', 'profile');
    expect((vi.mocked(prisma.patient.update).mock.calls[0][0].data as any).whatsapp_consent_at).toBeInstanceOf(Date);
  });

  it('withdraws consent and keeps the number', async () => {
    vi.mocked(prisma.patient.findUnique).mockResolvedValue({ whatsapp_number: '+2348012345678', whatsapp_consent: true } as any);
    await whatsappContact.withdrawConsent('p1');
    const data = vi.mocked(prisma.patient.update).mock.calls[0][0].data as any;
    expect(data).toEqual({ whatsapp_consent: false, whatsapp_consent_at: null });
    expect(vi.mocked(prisma.auditLog.create).mock.calls[0][0].data.action).toBe('whatsapp_consent_withdrawn');
  });
});

describe('account recovery', () => {
  it('marks the account as recovered so the WhatsApp pop-up shows', async () => {
    vi.clearAllMocks();
    await redis.set('patient_recover:tok1', 'p1');
    vi.mocked(prisma.patient.findUnique).mockResolvedValue({ id: 'p1', phone_number: 'email-1', email: null, username: null } as any);
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.patient.update).mockImplementation(async ({ data }: any) => ({ id: 'p1', phone_number: 'email-1', ...data }) as any);
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();
    await authController.patientRecoverCredentials(
      { body: { recovery_token: 'tok1', method: 'username', username: 'ada.o', password: 'secret1' }, ip: '1.1.1.1' } as any,
      res,
      next
    );
    expect(next).not.toHaveBeenCalled();
    expect((vi.mocked(prisma.patient.update).mock.calls[0][0].data as any).account_recovered_at).toBeInstanceOf(Date);
  });
});
