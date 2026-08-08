import { describe, it, expect } from 'vitest';
import { getIntakeEditMeta, INTAKE_EDIT_WINDOW_DAYS } from '../src/modules/intake/editWindow';

describe('Intake 7-day edit window', () => {
  it('allows edit when never submitted', () => {
    const meta = getIntakeEditMeta({ intake_status: 'in_progress', intake_first_submitted_at: null });
    expect(meta.can_edit).toBe(true);
    expect(meta.is_locked).toBe(false);
    expect(meta.days_remaining).toBeNull();
  });

  it('allows edit within 7 days of first submit', () => {
    const first = new Date();
    first.setDate(first.getDate() - 2);
    const meta = getIntakeEditMeta({
      intake_status: 'submitted',
      intake_first_submitted_at: first,
    });
    expect(meta.can_edit).toBe(true);
    expect(meta.is_locked).toBe(false);
    expect(meta.days_remaining).toBeGreaterThan(0);
    expect(meta.days_remaining).toBeLessThanOrEqual(INTAKE_EDIT_WINDOW_DAYS);
  });

  it('locks edit after 7 days', () => {
    const first = new Date();
    first.setDate(first.getDate() - 10);
    const meta = getIntakeEditMeta({
      intake_status: 'submitted',
      intake_first_submitted_at: first,
    });
    expect(meta.can_edit).toBe(false);
    expect(meta.is_locked).toBe(true);
    expect(meta.days_remaining).toBe(0);
  });
});
