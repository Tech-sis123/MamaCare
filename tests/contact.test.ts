import { describe, it, expect } from 'vitest';
import { isUsableEmail, isSmsPhone, splitRiskReasons } from '../src/utils/contact';
import { patientEmailRequestSchema } from '../src/modules/auth/schemas';

describe('contact helpers', () => {
  it('rejects phone numbers and placeholders as emails', () => {
    expect(isUsableEmail(null)).toBe(false);
    expect(isUsableEmail('08012345678')).toBe(false);
    expect(isUsableEmail('08012345678@phone.local')).toBe(false);
    expect(isUsableEmail('email-1710000000@tmp')).toBe(false);
    expect(isUsableEmail('mama@example.com')).toBe(true);
  });

  it('accepts Nigerian numbers and rejects generated email- phones', () => {
    expect(isSmsPhone('+2348012345678')).toBe(true);
    expect(isSmsPhone('08012345678')).toBe(true);
    expect(isSmsPhone('email-1710000000')).toBe(false);
    expect(isSmsPhone('')).toBe(false);
  });

  it('splits clinical risk reasons from incomplete-data notes', () => {
    const split = splitRiskReasons([
      'Advanced maternal age (>35)',
      'Genotype not confirmed',
      'Incomplete clinic data: bp_systolic',
      'History of stillbirth',
    ]);
    expect(split.clinical).toEqual(['Advanced maternal age (>35)', 'History of stillbirth']);
    expect(split.incomplete).toContain('Genotype not confirmed');
  });
});

describe('patient email schema', () => {
  it('rejects non-email values that used to be stored as usernames', () => {
    expect(patientEmailRequestSchema.safeParse({ email: '08012345678' }).success).toBe(false);
    expect(patientEmailRequestSchema.safeParse({ email: 'not-an-email' }).success).toBe(false);
    expect(patientEmailRequestSchema.safeParse({ email: 'mama@clinic.ng' }).success).toBe(true);
  });
});
