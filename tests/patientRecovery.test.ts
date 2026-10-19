import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/config/redis', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  return { redis: new RedisMock() };
});

vi.mock('../src/config/prisma', () => ({
  default: { patient: { findMany: vi.fn() } },
}));

import { namesMatch, isRecoveryMatch, patientRecovery, ageFromDateOfBirth, educationBucket } from '../src/services/patientRecovery';
import { patientRecoverSchema, recoverCredentialsSchema, patientLoginSchema } from '../src/modules/auth/schemas';
import prisma from '../src/config/prisma';

const ada = {
  id: 'p-ada',
  name: 'Ada Chioma Okafor',
  phone_number: '+2348031234567',
  email: 'ada123@fake.com',
  age: 27,
  education_level: 'Tertiary (University, Polytechnic)',
};

// Date of birth that makes someone exactly `age` today
const dobForAge = (age: number) => {
  const d = new Date();
  return `${d.getFullYear() - age}-01-01`;
};

describe('name matching', () => {
  it('ignores order, case and extra names', () => {
    expect(namesMatch('Ada Chioma Okafor', 'okafor ada')).toBe(true);
    expect(namesMatch('Ada Okafor', 'Ada Bello')).toBe(false);
  });
});

describe('date of birth and education', () => {
  it('works out age from date of birth', () => {
    expect(ageFromDateOfBirth('1998-06-15', new Date(2026, 5, 14))).toBe(27);
    expect(ageFromDateOfBirth('1998-06-15', new Date(2026, 5, 15))).toBe(28);
    expect(ageFromDateOfBirth('15/06/1998')).toBeNull();
  });

  it('groups education spellings', () => {
    expect(educationBucket('tertiary')).toBe('tertiary');
    expect(educationBucket('Tertiary (University, Polytechnic)')).toBe('tertiary');
    expect(educationBucket('Primary')).toBe(educationBucket('primary'));
  });
});

describe('recovery matching', () => {
  it('needs the name plus 2 other details', () => {
    expect(isRecoveryMatch(ada, { full_name: 'Ada Okafor', phone_number: '0803 123 4567', date_of_birth: dobForAge(28) }).ok).toBe(true);
    expect(isRecoveryMatch(ada, { full_name: 'Ada Okafor', education_level: 'Tertiary (University, Polytechnic)', email: 'ADA123@fake.com' }).ok).toBe(true);
    expect(isRecoveryMatch(ada, { full_name: 'Ada Okafor', phone_number: '08031234567' }).ok).toBe(false);
    expect(isRecoveryMatch(ada, { full_name: 'Bisi Okafor', phone_number: '08031234567', date_of_birth: dobForAge(27) }).ok).toBe(false);
  });

  it('rejects wrong details', () => {
    const r = isRecoveryMatch(ada, { full_name: 'Ada Okafor', phone_number: '08030000000', date_of_birth: dobForAge(40), education_level: 'Primary' });
    expect(r.nameMatches).toBe(true);
    expect(r.factors).toEqual([]);
    expect(r.ok).toBe(false);
  });

  it('refuses when two accounts match, and locks an account after repeated failures', async () => {
    const twin = { ...ada, id: 'p-twin' };
    vi.mocked(prisma.patient.findMany).mockResolvedValue([ada, twin] as any);
    const ambiguous = await patientRecovery.attempt({ full_name: 'Ada Okafor', email: 'ada123@fake.com', date_of_birth: dobForAge(27) });
    expect(ambiguous).toMatchObject({ ok: false, reason: 'ambiguous' });

    vi.mocked(prisma.patient.findMany).mockResolvedValue([ada] as any);
    for (let i = 0; i < 5; i++) {
      await patientRecovery.attempt({ full_name: 'Ada Okafor', phone_number: '08030000000', date_of_birth: dobForAge(50) });
    }
    const locked = await patientRecovery.attempt({ full_name: 'Ada Okafor', email: 'ada123@fake.com', date_of_birth: dobForAge(27) });
    expect(locked).toMatchObject({ ok: false, reason: 'locked' });
  });

  it('issues a single-use recovery token on success', async () => {
    const fresh = { ...ada, id: 'p-fresh' };
    vi.mocked(prisma.patient.findMany).mockResolvedValue([fresh] as any);
    const result = await patientRecovery.attempt({ full_name: 'Ada Okafor', email: 'ada123@fake.com', date_of_birth: dobForAge(27) });
    expect(result.ok).toBe(true);
    expect(await patientRecovery.patientIdForToken(result.token!)).toBe('p-fresh');
    await patientRecovery.consumeToken(result.token!);
    expect(await patientRecovery.patientIdForToken(result.token!)).toBeNull();
  });
});

describe('recovery schemas', () => {
  it('requires a first and last name plus 2 details', () => {
    expect(patientRecoverSchema.safeParse({ full_name: 'Ada', phone_number: '0803', email: 'x@y.com' }).success).toBe(false);
    expect(patientRecoverSchema.safeParse({ full_name: 'Ada Okafor', date_of_birth: '1998-06-15' }).success).toBe(false);
    expect(patientRecoverSchema.safeParse({ full_name: 'Ada Okafor', date_of_birth: '1998-06-15', education_level: 'Secondary' }).success).toBe(true);
    expect(patientRecoverSchema.safeParse({ full_name: 'Ada Okafor', date_of_birth: '2999-01-01', email: 'x@y.com' }).success).toBe(false);
    expect(patientRecoverSchema.safeParse({ full_name: 'Ada Okafor', education_level: 'PhD', email: 'x@y.com' }).success).toBe(false);
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
