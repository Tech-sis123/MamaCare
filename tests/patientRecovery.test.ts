import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/config/redis', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  return { redis: new RedisMock() };
});

vi.mock('../src/config/prisma', () => ({
  default: { patient: { findMany: vi.fn() } },
}));

import { namesMatch, isRecoveryMatch, patientRecovery } from '../src/services/patientRecovery';
import { patientRecoverSchema, recoverCredentialsSchema, patientLoginSchema } from '../src/modules/auth/schemas';
import prisma from '../src/config/prisma';

const ada = {
  id: 'p-ada',
  name: 'Ada Chioma Okafor',
  phone_number: '+2348031234567',
  email: 'ada123@fake.com',
  age: 27,
  emergency_contact_name: 'Emeka Okafor',
  emergency_contact_phone: '08099998888',
};

describe('name matching', () => {
  it('ignores order, case and extra names', () => {
    expect(namesMatch('Ada Chioma Okafor', 'okafor ada')).toBe(true);
    expect(namesMatch('Ada Okafor', 'Ada Bello')).toBe(false);
  });
});

describe('recovery matching', () => {
  it('needs the name plus 2 other details', () => {
    expect(isRecoveryMatch(ada, { full_name: 'Ada Okafor', phone_number: '0803 123 4567', age: 28 }).ok).toBe(true);
    expect(isRecoveryMatch(ada, { full_name: 'Ada Okafor', phone_number: '08031234567' }).ok).toBe(false);
    expect(isRecoveryMatch(ada, { full_name: 'Bisi Okafor', phone_number: '08031234567', age: 27 }).ok).toBe(false);
  });

  it('rejects wrong details', () => {
    const r = isRecoveryMatch(ada, { full_name: 'Ada Okafor', phone_number: '08030000000', age: 40 });
    expect(r.nameMatches).toBe(true);
    expect(r.factors).toEqual([]);
    expect(r.ok).toBe(false);
  });

  it('refuses when two accounts match, and locks an account after repeated failures', async () => {
    const twin = { ...ada, id: 'p-twin' };
    vi.mocked(prisma.patient.findMany).mockResolvedValue([ada, twin] as any);
    const ambiguous = await patientRecovery.attempt({ full_name: 'Ada Okafor', email: 'ada123@fake.com', age: 27 });
    expect(ambiguous).toMatchObject({ ok: false, reason: 'ambiguous' });

    vi.mocked(prisma.patient.findMany).mockResolvedValue([ada] as any);
    for (let i = 0; i < 5; i++) {
      await patientRecovery.attempt({ full_name: 'Ada Okafor', phone_number: '08030000000', age: 50 });
    }
    const locked = await patientRecovery.attempt({ full_name: 'Ada Okafor', email: 'ada123@fake.com', age: 27 });
    expect(locked).toMatchObject({ ok: false, reason: 'locked' });
  });

  it('issues a single-use recovery token on success', async () => {
    const fresh = { ...ada, id: 'p-fresh' };
    vi.mocked(prisma.patient.findMany).mockResolvedValue([fresh] as any);
    const result = await patientRecovery.attempt({ full_name: 'Ada Okafor', email: 'ada123@fake.com', age: 27 });
    expect(result.ok).toBe(true);
    expect(await patientRecovery.patientIdForToken(result.token!)).toBe('p-fresh');
    await patientRecovery.consumeToken(result.token!);
    expect(await patientRecovery.patientIdForToken(result.token!)).toBeNull();
  });
});

describe('recovery schemas', () => {
  it('requires a first and last name plus 2 details', () => {
    expect(patientRecoverSchema.safeParse({ full_name: 'Ada', phone_number: '0803', age: 27 }).success).toBe(false);
    expect(patientRecoverSchema.safeParse({ full_name: 'Ada Okafor', age: 27 }).success).toBe(false);
    expect(patientRecoverSchema.safeParse({ full_name: 'Ada Okafor', age: 27, email: 'x@y.com' }).success).toBe(true);
  });

  it('accepts email or username login details', () => {
    const base = { recovery_token: 't', password: 'secret1' };
    expect(recoverCredentialsSchema.safeParse({ ...base, method: 'username', username: 'Ada.Okafor' }).success).toBe(true);
    expect(recoverCredentialsSchema.safeParse({ ...base, method: 'username', username: 'ada@home' }).success).toBe(false);
    expect(recoverCredentialsSchema.safeParse({ ...base, method: 'email', email: 'ada@gmail.com' }).success).toBe(true);
    expect(recoverCredentialsSchema.safeParse({ ...base, method: 'email', email: 'nope' }).success).toBe(false);
  });

  it('login accepts a username or the old email field', () => {
    expect(patientLoginSchema.parse({ identifier: 'Ada.Okafor', password: 'x' }).identifier).toBe('ada.okafor');
    expect(patientLoginSchema.parse({ email: 'Ada@Gmail.com', password: 'x' }).identifier).toBe('ada@gmail.com');
  });
});
