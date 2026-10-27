import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/config/redis', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  return { redis: new RedisMock() };
});

vi.mock('../src/config/prisma', () => ({
  default: {
    patient: { findFirst: vi.fn() },
    doctor: { findFirst: vi.fn() },
    systemConfig: { findFirst: vi.fn() },
  },
}));

import prisma from '../src/config/prisma';
import { redis } from '../src/config/redis';
import { env } from '../src/config/env';
import { whatsappBot, findAvailableDoctor, phoneCandidates } from '../src/services/whatsappBot';

const send = (text: string, from = '08011111111') => whatsappBot.reply({ from, text });

describe('WhatsApp bot', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await redis.flushall();
    env.WHATSAPP_BOT_ENABLED = 'true';
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1', name: 'Ada Okafor', primary_doctor_id: 'd2' } as any);
    vi.mocked(prisma.doctor.findFirst).mockResolvedValue({ name: 'Dr Bello', phone_number: '08099999999' } as any);
    vi.mocked(prisma.systemConfig.findFirst).mockResolvedValue(null);
  });

  it('greets a known patient by first name with the menu', async () => {
    const reply = await send('Hi');
    expect(reply).toContain('Hello Ada');
    expect(reply).toContain('9Care AI');
    expect(reply).toContain('5. Talk to a doctor');
  });

  it('looks the patient up in every saved phone format', async () => {
    await send('hi', '+234 801 111 1111');
    const where = vi.mocked(prisma.patient.findFirst).mock.calls[0][0]!.where as any;
    expect(where.phone_number.in).toEqual(expect.arrayContaining(['2348011111111', '+2348011111111', '08011111111']));
    expect(phoneCandidates('2348011111111')).toContain('08011111111');
  });

  it('answers menu options with generic information', async () => {
    expect(await send('1')).toContain('Danger signs in pregnancy');
    expect(await send('4')).toContain('Forgot your login?');
  });

  it('gives the available doctor number when asked for a doctor', async () => {
    const reply = await send('5');
    expect(reply).toContain('Dr Bello');
    expect(reply).toContain('+2348099999999');
  });

  it('treats danger signs as an emergency', async () => {
    const reply = await send('I am bleeding since morning');
    expect(reply).toContain('This may be an emergency');
    expect(reply).toContain('+2348099999999');
  });

  it('hands over to a doctor after two messages it cannot understand', async () => {
    const first = await send('abc xyz');
    expect(first).toContain("didn't understand");
    expect(first).not.toContain('+2348099999999');
    const second = await send('qwerty');
    expect(second).toContain('A doctor can help you better');
    expect(second).toContain('+2348099999999');
  });

  it('stays silent when switched off', async () => {
    env.WHATSAPP_BOT_ENABLED = 'false';
    expect(await send('hi')).toBeNull();
  });
});

describe('findAvailableDoctor', () => {
  beforeEach(() => vi.clearAllMocks());

  it("prefers today's clinic doctor, then the patient's own doctor", async () => {
    vi.mocked(prisma.doctor.findFirst)
      .mockResolvedValueOnce(null) // nobody in clinic today
      .mockResolvedValueOnce({ name: 'Dr Own', phone_number: '08022222222' } as any);
    const contact = await findAvailableDoctor({ id: 'p1', name: null, primary_doctor_id: 'd2' });
    expect(contact).toEqual({ name: 'Dr Own', phone: '2348022222222', source: 'primary' });
  });

  it('falls back to the clinic support number when no doctor has a phone', async () => {
    vi.mocked(prisma.doctor.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.systemConfig.findFirst).mockResolvedValue(null);
    const contact = await findAvailableDoctor(null);
    expect(contact.source).toBe('support');
    expect(contact.phone).toBe(env.SUPPORT_WHATSAPP_NUMBER.replace(/\D/g, ''));
  });
});
