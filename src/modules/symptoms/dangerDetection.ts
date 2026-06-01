/**
 * MAMA CARE AI — Danger Sign Detection Engine
 *
 * CLINICAL SAFETY CRITICAL CODE
 * Pure function. No DB access.
 *
 * Detects the 9 danger sign triggers from reported symptoms
 * and contextual patient data (BP, EGA).
 *
 * Danger sign triggers:
 * 1. Severe headache + high BP
 * 2. Blurred vision + high BP
 * 3. Vaginal bleeding
 * 4. Severe abdominal pain
 * 5. Reduced fetal movement after 28 weeks
 * 6. Convulsions
 * 7. Fever above 38°C
 * 8. Severe vomiting / unable to keep fluids down
 * 9. Sudden facial or hand swelling + headache
 */

import { SymptomInput, DangerTrigger } from '../../utils/types';

export interface DangerDetectionContext {
  bp_systolic?: number | null;
  bp_diastolic?: number | null;
  ega_weeks?: number | null;
}

export interface DangerDetectionResult {
  is_danger: boolean;
  triggers: DangerTrigger[];
  severity: 'critical' | 'none';
}

const HIGH_BP_SYSTOLIC = 140;
const HIGH_BP_DIASTOLIC = 90;

function hasHighBP(ctx: DangerDetectionContext): boolean {
  return (
    (ctx.bp_systolic != null && ctx.bp_systolic >= HIGH_BP_SYSTOLIC) ||
    (ctx.bp_diastolic != null && ctx.bp_diastolic >= HIGH_BP_DIASTOLIC)
  );
}

function hasSymptom(symptoms: SymptomInput[], key: string): boolean {
  return symptoms.some((s) => s.symptom_key === key);
}

function hasSevereSymptom(symptoms: SymptomInput[], key: string): boolean {
  return symptoms.some((s) => s.symptom_key === key && s.severity === 'severe');
}

export function detectDangerSigns(
  symptoms: SymptomInput[],
  context: DangerDetectionContext
): DangerDetectionResult {
  const triggers: DangerTrigger[] = [];

  // 1. Severe headache + high BP
  if (hasSymptom(symptoms, 'severe_headache') && hasHighBP(context)) {
    triggers.push({
      trigger_key: 'headache_high_bp',
      description: 'Severe headache with elevated blood pressure — possible pre-eclampsia',
      symptoms_involved: ['severe_headache'],
    });
  }

  // 2. Blurred vision + high BP
  if (hasSymptom(symptoms, 'blurred_vision') && hasHighBP(context)) {
    triggers.push({
      trigger_key: 'vision_high_bp',
      description: 'Blurred vision with elevated blood pressure — possible eclampsia',
      symptoms_involved: ['blurred_vision'],
    });
  }

  // 3. Vaginal bleeding (any severity is a danger sign in pregnancy)
  if (hasSymptom(symptoms, 'vaginal_bleeding')) {
    triggers.push({
      trigger_key: 'vaginal_bleeding',
      description: 'Vaginal bleeding during pregnancy',
      symptoms_involved: ['vaginal_bleeding'],
    });
  }

  // 4. Severe abdominal pain
  if (hasSevereSymptom(symptoms, 'abdominal_pain')) {
    triggers.push({
      trigger_key: 'severe_abdominal_pain',
      description: 'Severe abdominal pain — possible placental abruption or ectopic',
      symptoms_involved: ['abdominal_pain'],
    });
  }

  // 5. Reduced fetal movement after 28 weeks
  if (
    hasSymptom(symptoms, 'reduced_fetal_movement') &&
    context.ega_weeks != null &&
    context.ega_weeks >= 28
  ) {
    triggers.push({
      trigger_key: 'reduced_fetal_movement',
      description: 'Reduced fetal movement after 28 weeks',
      symptoms_involved: ['reduced_fetal_movement'],
    });
  }

  // 6. Convulsions
  if (hasSymptom(symptoms, 'convulsions')) {
    triggers.push({
      trigger_key: 'convulsions',
      description: 'Convulsions — possible eclamptic seizure',
      symptoms_involved: ['convulsions'],
    });
  }

  // 7. Fever above 38°C
  if (hasSymptom(symptoms, 'high_fever')) {
    triggers.push({
      trigger_key: 'high_fever',
      description: 'Fever above 38°C — possible infection',
      symptoms_involved: ['high_fever'],
    });
  }

  // 8. Severe vomiting / unable to keep fluids down
  if (hasSevereSymptom(symptoms, 'severe_vomiting')) {
    triggers.push({
      trigger_key: 'severe_vomiting',
      description: 'Severe vomiting — unable to keep fluids down, possible hyperemesis',
      symptoms_involved: ['severe_vomiting'],
    });
  }

  // 9. Sudden facial or hand swelling + headache
  if (
    hasSymptom(symptoms, 'facial_swelling') &&
    hasSymptom(symptoms, 'severe_headache')
  ) {
    triggers.push({
      trigger_key: 'swelling_headache',
      description: 'Sudden facial/hand swelling with headache — possible pre-eclampsia',
      symptoms_involved: ['facial_swelling', 'severe_headache'],
    });
  }

  return {
    is_danger: triggers.length > 0,
    triggers,
    severity: triggers.length > 0 ? 'critical' : 'none',
  };
}
