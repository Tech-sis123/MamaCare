import { describe, it, expect } from 'vitest';
import { patchIntakeSchema } from '../src/modules/intake/schemas';

describe('intake domain validation', () => {
  it('accepts systems domain for review-of-systems responses', () => {
    const parsed = patchIntakeSchema.safeParse({
      domain: 'systems',
      responses: [{ question_key: 'pain', answer: 'yes' }],
    });

    expect(parsed.success).toBe(true);
  });

  it('accepts social domain for family-and-social responses', () => {
    const parsed = patchIntakeSchema.safeParse({
      domain: 'social',
      responses: [{ question_key: 'supportive', answer: 'yes' }],
    });

    expect(parsed.success).toBe(true);
  });
});
