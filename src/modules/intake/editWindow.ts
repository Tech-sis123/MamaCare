/** Days after first submit during which the mother may still edit her questionnaire. */
export const INTAKE_EDIT_WINDOW_DAYS = 7;

export type IntakeEditMeta = {
  status: string;
  can_edit: boolean;
  first_submitted_at: string | null;
  edit_deadline: string | null;
  days_remaining: number | null;
  is_locked: boolean;
};

export function getIntakeEditMeta(patient: {
  intake_status?: string | null;
  intake_first_submitted_at?: Date | null;
}): IntakeEditMeta {
  const status = patient.intake_status || 'not_started';
  const first = patient.intake_first_submitted_at
    ? new Date(patient.intake_first_submitted_at)
    : null;

  if (!first) {
    // Never submitted — always editable
    return {
      status,
      can_edit: true,
      first_submitted_at: null,
      edit_deadline: null,
      days_remaining: null,
      is_locked: false,
    };
  }

  const deadline = new Date(first);
  deadline.setDate(deadline.getDate() + INTAKE_EDIT_WINDOW_DAYS);
  const now = new Date();
  const msLeft = deadline.getTime() - now.getTime();
  const days_remaining = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
  const can_edit = now.getTime() <= deadline.getTime();

  return {
    status: status === 'not_started' ? 'submitted' : status,
    can_edit,
    first_submitted_at: first.toISOString(),
    edit_deadline: deadline.toISOString(),
    days_remaining: can_edit ? days_remaining : 0,
    is_locked: !can_edit,
  };
}
