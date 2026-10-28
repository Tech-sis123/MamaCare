/**
 * Delivery details and the postpartum period (42 days from the delivery date).
 */

export const POSTPARTUM_DAYS = 42;

/** Complications a patient can tick; `column` is the yes/no field on pregnancies. */
export const DELIVERY_COMPLICATIONS = [
  { key: 'antepartum_hemorrhage', column: 'comp_antepartum_hemorrhage', label: 'Antepartum hemorrhage', explain: 'bleeding from the vagina before delivery' },
  { key: 'premature_rupture_of_membranes', column: 'comp_premature_rupture_of_membranes', label: 'Premature rupture of membranes', explain: 'the waters broke before labour started' },
  { key: 'prolonged_labour', column: 'comp_prolonged_labour', label: 'Prolonged labour', explain: 'labour lasted unusually long' },
  { key: 'postpartum_hemorrhage', column: 'comp_postpartum_hemorrhage', label: 'Postpartum hemorrhage', explain: 'heavy bleeding after delivery' },
  { key: 'preeclampsia', column: 'comp_preeclampsia', label: 'Preeclampsia', explain: 'high blood pressure in pregnancy' },
  { key: 'eclampsia', column: 'comp_eclampsia', label: 'Eclampsia', explain: 'seizures or fits' },
  { key: 'other', column: 'comp_other', label: 'Other', explain: '' },
] as const;

export type ComplicationKey = (typeof DELIVERY_COMPLICATIONS)[number]['key'];
export const COMPLICATION_KEYS = DELIVERY_COMPLICATIONS.map((c) => c.key) as [ComplicationKey, ...ComplicationKey[]];

export const DELIVERY_OUTCOMES = {
  alive_well: 'Alive and well',
  alive_with_complications: 'Alive with some complications',
  stillbirth: 'Stillbirth / died at birth',
} as const;

export const DELIVERY_MODES = {
  vaginal: 'Vaginal delivery',
  caesarean: 'Caesarean section (C-section)',
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Calendar date (YYYY-MM-DD) in Nigeria. */
export function lagosDateString(d: Date = new Date()): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
}

/** Stored delivery dates are midnight UTC of the chosen calendar day. */
export function deliveryDateFromString(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export type PostpartumStatus = { days: number; weeks: number; completed: boolean; label: string };

/**
 * Counts up from the delivery day: days for the first 6 days, then weeks,
 * then "completed" after day 42.
 */
export function postpartumStatus(deliveryDate: Date | string | null | undefined, now: Date = new Date()): PostpartumStatus | null {
  if (!deliveryDate) return null;
  const delivered = new Date(deliveryDate).toISOString().slice(0, 10);
  const days = Math.max(0, Math.round((Date.parse(lagosDateString(now)) - Date.parse(delivered)) / DAY_MS));
  const weeks = Math.floor(days / 7);
  const completed = days > POSTPARTUM_DAYS;
  let label: string;
  if (completed) label = 'Postpartum period completed';
  else if (days === 0) label = 'Delivered today';
  else if (days < 7) label = `${days} day${days === 1 ? '' : 's'} postpartum`;
  else label = `${weeks} week${weeks === 1 ? '' : 's'} postpartum`;
  return { days, weeks, completed, label };
}

type DeliveryFields = {
  delivery_date?: Date | null;
  delivery_recorded_at?: Date | null;
  delivery_had_complications?: boolean | null;
  comp_other_details?: string | null;
  delivery_outcome?: string | null;
  delivery_mode?: string | null;
} & Partial<Record<(typeof DELIVERY_COMPLICATIONS)[number]['column'], boolean | null>>;

/** API shape of a pregnancy's delivery details (patient and doctor views). */
export function deliverySummary(pregnancy: DeliveryFields | null | undefined, now: Date = new Date()) {
  if (!pregnancy?.delivery_date) return { delivered: false as const };
  const complications = DELIVERY_COMPLICATIONS.filter((c) => pregnancy[c.column]).map((c) => ({
    key: c.key,
    label: c.key === 'other' && pregnancy.comp_other_details ? `Other: ${pregnancy.comp_other_details}` : c.label,
  }));
  return {
    delivered: true as const,
    delivery_date: pregnancy.delivery_date.toISOString().slice(0, 10),
    recorded_at: pregnancy.delivery_recorded_at ?? null,
    had_complications: pregnancy.delivery_had_complications ?? complications.length > 0,
    complications,
    other_details: pregnancy.comp_other_details ?? null,
    outcome: pregnancy.delivery_outcome ?? null,
    outcome_label: DELIVERY_OUTCOMES[pregnancy.delivery_outcome as keyof typeof DELIVERY_OUTCOMES] ?? null,
    mode: pregnancy.delivery_mode ?? null,
    mode_label: DELIVERY_MODES[pregnancy.delivery_mode as keyof typeof DELIVERY_MODES] ?? null,
    postpartum: postpartumStatus(pregnancy.delivery_date, now),
  };
}

/** Earliest allowed delivery date: the start of the pregnancy (LMP, or EDD − 280 days). */
export function pregnancyStartDate(pregnancy: { lmp_date?: Date | null; edd_computed?: Date | null } | null): Date | null {
  if (pregnancy?.lmp_date) return new Date(pregnancy.lmp_date);
  if (pregnancy?.edd_computed) return new Date(new Date(pregnancy.edd_computed).getTime() - 280 * DAY_MS);
  return null;
}

/** Weeks from which the "Have you delivered?" prompt shows. */
export const DELIVERY_PROMPT_FROM_WEEK = 30;
