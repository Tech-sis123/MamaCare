import type { PostpartumStatus } from '../../utils/delivery';

/** Lesson groups a doctor can publish to, with the weeks each covers. */
export const EDUCATION_STAGES = [
  { id: 'general', label: 'General (any week)' },
  { id: 'trimester_1', label: 'First trimester (weeks 1 to 13)' },
  { id: 'trimester_2', label: 'Second trimester (weeks 14 to 27)' },
  { id: 'trimester_3', label: 'Third trimester (weeks 28 to 40)' },
  { id: 'postpartum', label: 'Postpartum (up to 6 weeks after delivery)' },
] as const;

export type EducationStage = (typeof EDUCATION_STAGES)[number]['id'];
export const EDUCATION_STAGE_IDS = EDUCATION_STAGES.map((s) => s.id) as [EducationStage, ...EducationStage[]];

/** Group a lesson belongs to; legacy rows only have a single week number. */
export function moduleStage(mod: { stage?: string | null; week_number?: number | null }): EducationStage {
  if (mod.stage && (EDUCATION_STAGE_IDS as string[]).includes(mod.stage)) return mod.stage as EducationStage;
  if (mod.week_number == null) return 'general';
  return trimesterStage(mod.week_number);
}

export function trimesterStage(weeks: number): EducationStage {
  if (weeks <= 13) return 'trimester_1';
  if (weeks <= 27) return 'trimester_2';
  return 'trimester_3'; // includes 41+ weeks while still pregnant
}

/**
 * Groups a patient can see. General is always shown. Delivered women see
 * postpartum lessons for 42 days; pregnant women see their trimester (all
 * three when the week is unknown).
 */
export function visibleStages(params: { egaWeeks: number | null; postpartum: PostpartumStatus | null; delivered: boolean }): Set<EducationStage> {
  const stages = new Set<EducationStage>(['general']);
  if (params.delivered) {
    if (params.postpartum && !params.postpartum.completed) stages.add('postpartum');
  } else if (params.egaWeeks == null) {
    stages.add('trimester_1').add('trimester_2').add('trimester_3');
  } else {
    stages.add(trimesterStage(params.egaWeeks));
  }
  return stages;
}
