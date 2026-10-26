import { Patient, Pregnancy, IntakeResponse } from '@prisma/client';
import { RiskInput } from '../../utils/types';

/**
 * Builds the risk engine snapshot from everything we know about a patient:
 * intake answers (mother-entered) and the pregnancy record (doctor-entered).
 * Used by intake submit, the doctor pregnancy update and POST /risk/:id/run,
 * so all three grade a patient the same way.
 */

const isYes = (v: unknown) => v === true || ['yes', 'true'].includes(String(v ?? '').trim().toLowerCase());
const isNo = (v: unknown) => v === false || ['no', 'false'].includes(String(v ?? '').trim().toLowerCase());
const yesNo = (v: unknown): boolean | null => (isYes(v) ? true : isNo(v) ? false : null);

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && String(v).match(/\d/) ? n : null;
};

/** "positive", "reactive", "+ve" → true; "negative", "non-reactive", "-ve" → false */
const labResult = (v: unknown): boolean | null => {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return null;
  if (/non[\s-]?reactive|neg|-ve|not detected/.test(s)) return false;
  if (/reactive|pos|\+ve|detected/.test(s)) return true;
  return null;
};

const splitList = (v: unknown) =>
  String(v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && !/^none/i.test(s));

/** Latest dated entry from a JSON log array (falls back to the last item). */
function latestEntry<T extends { date?: string | null }>(log: unknown): T | null {
  if (!Array.isArray(log) || log.length === 0) return null;
  const entries = log as T[];
  const dated = entries.filter((e) => e?.date && !Number.isNaN(Date.parse(e.date)));
  if (dated.length) return dated.sort((a, b) => Date.parse(b.date!) - Date.parse(a.date!))[0];
  return entries[entries.length - 1];
}

/** mg/dL values (> 30) are converted to mmol/L */
const glucoseMmol = (v: unknown): number | null => {
  const n = num(v);
  if (n == null) return null;
  return n > 30 ? Math.round((n / 18) * 10) / 10 : n;
};

export function buildRiskInput(
  patient: Pick<Patient, 'age'>,
  pregnancy: Pregnancy | null,
  intakeResponses: Pick<IntakeResponse, 'question_key' | 'answer'>[]
): RiskInput {
  const intake = new Map<string, unknown>();
  for (const ir of intakeResponses) intake.set(ir.question_key, ir.answer);

  // ── Past deliveries (child_1_delivery_mode, child_1_state_now, …) ──
  let csCount = 0;
  let stillbirth = false;
  let childDiedLater = false;
  let pph = false;
  let hypertensionInPregnancy = false;
  let lowBirthWeight = false;
  for (const [key, answer] of intake.entries()) {
    const value = String(answer ?? '');
    if (/^child_\d+_delivery_mode$/.test(key) && value === 'cs') csCount++;
    if (/^child_\d+_state_now$/.test(key)) {
      if (value === 'stillbirth' || value === 'died_at_birth') stillbirth = true;
      if (value === 'died_later') childDiedLater = true;
    }
    if (/^child_\d+_postnatal_issues$/.test(key) && /excessive bleeding/i.test(value)) pph = true;
    if (/^child_\d+_events$/.test(key) && /hypertension/i.test(value)) hypertensionInPregnancy = true;
    if (/^child_\d+_birth_weight$/.test(key)) {
      const kg = num(value);
      if (kg != null && kg > 0 && kg < 2.5) lowBirthWeight = true;
    }
  }

  const explicitCs = yesNo(intake.get('previous_csection'));
  const explicitStillbirth = yesNo(intake.get('previous_stillbirth'));

  // ── Intake conditions and symptoms ──
  const medicalConditions = splitList(intake.get('medical_conditions'));
  for (const key of ['hypertension', 'diabetes', 'epilepsy', 'asthma']) {
    if (isYes(intake.get(key)) && !medicalConditions.some((c) => c.toLowerCase().includes(key))) medicalConditions.push(key);
  }

  const surgeries: string[] = [];
  for (const [key, answer] of intake.entries()) {
    if (/^surgery_\d+_type$/.test(key) && answer) surgeries.push(String(answer));
  }

  // ── Doctor-entered vitals: newest vitals entry wins over booking values ──
  const vitals = latestEntry<{ date?: string | null; bp_systolic?: unknown; bp_diastolic?: unknown; protein?: unknown; weight_kg?: unknown; height_cm?: unknown }>(
    pregnancy?.vitals_log
  );
  const vitalsSys = num(vitals?.bp_systolic);
  const vitalsDia = num(vitals?.bp_diastolic);
  const bpSystolic = vitalsSys != null && vitalsDia != null ? vitalsSys : pregnancy?.booking_bp_systolic ?? null;
  const bpDiastolic = vitalsSys != null && vitalsDia != null ? vitalsDia : pregnancy?.booking_bp_diastolic ?? null;

  const extraLabs = (pregnancy?.extra_labs ?? {}) as Record<string, unknown>;
  const proteinText = String(vitals?.protein ?? extraLabs.protein ?? pregnancy?.urinalysis ?? '');
  const proteinuria = /\+|protein\s*[1-4]|[1-4]\s*\+|positive/i.test(proteinText) && !/nil|neg|trace/i.test(proteinText)
    ? true
    : proteinText
      ? false
      : null;

  // BMI from the newest weight/height we have (height in cm, or m if < 3)
  const weight = num(vitals?.weight_kg) ?? pregnancy?.booking_weight ?? null;
  let height = num(vitals?.height_cm) ?? pregnancy?.booking_height ?? null;
  if (height != null && height > 0 && height < 3) height = height * 100;
  const bmi = weight && height ? Math.round((weight / (height / 100) ** 2) * 10) / 10 : null;

  const examination = (pregnancy?.examination ?? {}) as { presentation?: string | null; lie?: string | null };

  const genotype = pregnancy?.genotype ?? (intake.get('genotype') as string | undefined) ?? null;
  const bloodGroup = pregnancy?.blood_group ?? (intake.get('blood_group') as string | undefined) ?? '';
  const rhesus = pregnancy?.rhesus ?? (/[-−]$/.test(String(bloodGroup).trim()) ? 'negative' : null);
  const parityRaw = pregnancy?.parity ?? num(intake.get('parity'));
  const miscarriages = num(intake.get('miscarriage_count'));

  const clinicianFlags = Array.isArray(pregnancy?.risk_factors)
    ? (pregnancy!.risk_factors as unknown[]).filter((id): id is string => typeof id === 'string')
    : [];

  return {
    age: patient.age ?? null,
    bp_systolic: bpSystolic,
    bp_diastolic: bpDiastolic,
    proteinuria,
    hemoglobin: num(extraLabs.hb ?? extraLabs.hemoglobin ?? extraLabs.haemoglobin),
    pcv: pregnancy?.pcv ?? null,
    genotype,
    rhesus,
    hiv_positive: labResult(pregnancy?.rvd_status),
    hep_b_positive: labResult(pregnancy?.hep_b),
    hep_c_positive: labResult(pregnancy?.hep_c),
    vdrl_positive: labResult(pregnancy?.vdrl),
    random_blood_glucose: glucoseMmol(pregnancy?.rbg),
    bmi,
    gravidity: pregnancy?.gravidity ?? null,
    parity: parityRaw ?? null,
    ega_weeks: pregnancy?.current_ega_weeks ?? null,
    fetal_presentation: examination.presentation ?? null,
    fetal_lie: examination.lie ?? null,
    is_twin_pregnancy: yesNo(intake.get('is_twin_pregnancy')),
    medical_conditions: medicalConditions,
    current_symptoms: splitList(intake.get('systems_symptoms')),
    previous_csection: explicitCs ?? (csCount > 0 ? true : null),
    previous_cs_count: csCount > 0 ? csCount : explicitCs ? 1 : null,
    previous_stillbirth: explicitStillbirth ?? (stillbirth ? true : null),
    previous_child_death_after_birth: childDiedLater || null,
    previous_eclampsia: yesNo(intake.get('previous_eclampsia')),
    previous_hypertension_in_pregnancy: hypertensionInPregnancy || null,
    previous_pph: pph || null,
    previous_low_birth_weight: lowBirthWeight || null,
    miscarriage_count: miscarriages,
    surgeries,
    clinician_flags: clinicianFlags,
  };
}
