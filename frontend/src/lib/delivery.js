/** Delivery form options and lesson groups (mirrors src/utils/delivery.ts and education/stages.ts). */

export const COMPLICATIONS = [
  { key: 'antepartum_hemorrhage', label: 'Antepartum hemorrhage', explain: 'Bleeding from the vagina before delivery' },
  { key: 'premature_rupture_of_membranes', label: 'Premature rupture of membranes', explain: 'The waters broke before labour started' },
  { key: 'prolonged_labour', label: 'Prolonged labour', explain: 'Labour lasted unusually long' },
  { key: 'postpartum_hemorrhage', label: 'Postpartum hemorrhage', explain: 'Heavy bleeding after delivery' },
  { key: 'preeclampsia', label: 'Preeclampsia', explain: 'High blood pressure in pregnancy' },
  { key: 'eclampsia', label: 'Eclampsia', explain: 'Seizures or fits' },
  { key: 'other', label: 'Other', explain: 'Something else (type it below)' },
];

export const OUTCOMES = [
  { key: 'alive_well', label: 'Alive and well' },
  { key: 'alive_with_complications', label: 'Alive with some complications' },
  { key: 'stillbirth', label: 'Stillbirth / died at birth' },
];

export const MODES = [
  { key: 'vaginal', label: 'Vaginal delivery', explain: 'Normal birth' },
  { key: 'caesarean', label: 'Caesarean section', explain: 'C-section, delivery by surgery' },
];

export const POSTPARTUM_DAYS = 42;

export const EDUCATION_STAGES = [
  { id: 'general', label: 'General', range: 'any week' },
  { id: 'trimester_1', label: 'First trimester', range: 'weeks 1 to 13' },
  { id: 'trimester_2', label: 'Second trimester', range: 'weeks 14 to 27' },
  { id: 'trimester_3', label: 'Third trimester', range: 'weeks 28 to 40' },
  { id: 'postpartum', label: 'Postpartum', range: 'from delivery up to 6 weeks after' },
];

/** Group of a lesson; legacy rows only have a single week number. */
export const moduleStage = (mod) => {
  if (mod?.stage && EDUCATION_STAGES.some((s) => s.id === mod.stage)) return mod.stage;
  const w = mod?.week_number;
  if (w == null) return 'general';
  if (w <= 13) return 'trimester_1';
  if (w <= 27) return 'trimester_2';
  return 'trimester_3';
};

export const stageLabel = (mod) => EDUCATION_STAGES.find((s) => s.id === moduleStage(mod))?.label || 'General';

/** "Today" as YYYY-MM-DD in the user's own timezone, for the date picker's max. */
export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const formatDeliveryDate = (iso) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
