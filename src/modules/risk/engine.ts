/**
 * 9Care AI — Risk Stratification Engine
 *
 * CLINICAL SAFETY CRITICAL CODE
 * This is a PURE FUNCTION. No database access, no side effects.
 * Input is a snapshot object, output is { tier, reasons[], matches[], engine_version }.
 *
 * v2 rules follow the clinical team's "High-risk pregnancy conditions" guideline
 * (see conditions.ts for the full list and each condition's tier). Conditions are
 * either detected from the patient's data or ticked by a doctor on the checklist.
 *
 * MISSING-DATA POLICY (self-serve + clinic hybrid):
 * - HARD critical (age): missing → escalate tier (identity must exist).
 * - SOFT incomplete (BP, unconfirmed genotype): flag for care team but do NOT
 *   escalate to HIGH just because clinic vitals were never entered.
 *   Escalating on missing BP alone was marking every mother HIGH.
 */

import { RiskInput, RiskMatch, RiskOutput, RiskTier } from '../../utils/types';
import { RISK_CONDITIONS_BY_ID, CHECKLIST_CONDITION_IDS } from './conditions';

export const ENGINE_VERSION = '2.0.0';

/** Missing these forces a tier escalate (mother-path must provide them). */
const HARD_CRITICAL_FIELDS: (keyof RiskInput)[] = ['age'];

/** Missing these are noted for clinicians but do not raise risk tier alone. */
const SOFT_INCOMPLETE_FIELDS: (keyof RiskInput)[] = ['bp_systolic', 'bp_diastolic'];

const TIER_ORDER: Record<RiskTier, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };

function escalateTier(current: RiskTier): RiskTier {
  if (current === 'LOW') return 'MEDIUM';
  return 'HIGH'; // MEDIUM → HIGH, HIGH stays HIGH
}

/** Known clinical genotypes. "Not sure" / Unknown / empty → null (unconfirmed). */
function normalizeGenotype(value: string | null | undefined): string | null {
  if (value == null) return null;
  const gt = String(value).trim().toUpperCase();
  if (!gt || gt === 'NOT SURE' || gt === 'UNKNOWN' || gt === 'N/A') return null;
  return gt;
}

const hasItem = (list: string[] | undefined, pattern: RegExp) => (list || []).some((item) => pattern.test(item));

export function runRiskEngine(input: RiskInput): RiskOutput {
  const matches: RiskMatch[] = [];
  const add = (id: string, reason: string, source: RiskMatch['source'] = 'detected') => {
    const condition = RISK_CONDITIONS_BY_ID.get(id);
    if (!condition || matches.some((m) => m.id === id)) return;
    matches.push({ id, tier: condition.tier, reason, source });
  };

  // ─── 1. Maternal medical conditions ───────────────────────────
  const conditions = input.medical_conditions || [];
  if (hasItem(conditions, /hypertension/i)) add('chronic_hypertension', 'Chronic hypertension (reported at intake)');
  if (hasItem(conditions, /diabetes/i)) add('diabetes', 'Diabetes (reported at intake)');
  if (hasItem(conditions, /epilepsy/i)) add('epilepsy', 'Epilepsy (reported at intake)');
  if (hasItem(conditions, /asthma/i)) add('asthma_unspecified', 'Asthma reported at intake (severity not recorded)');

  const knownGenotype = normalizeGenotype(input.genotype);
  if (knownGenotype === 'SS' || knownGenotype === 'SC') add('sickle_cell_disease', `High-risk genotype: ${knownGenotype}`);

  const infections = [
    input.hiv_positive && 'HIV positive',
    input.hep_b_positive && 'Hepatitis B positive',
    input.hep_c_positive && 'Hepatitis C positive',
    input.vdrl_positive && 'VDRL (syphilis) positive',
  ].filter(Boolean);
  if (infections.length) add('hiv_or_significant_infection', infections.join(', '));

  if (hasItem(input.current_symptoms, /chest pain|palpitation|difficulty breathing/i)) {
    add('cardiorespiratory_symptoms', 'Chest pain, palpitations or breathing difficulty reported (check for heart disease)');
  }

  // ─── 2. Previous obstetric history ────────────────────────────
  if (input.previous_eclampsia === true) add('previous_preeclampsia', 'History of eclampsia');
  else if (input.previous_hypertension_in_pregnancy === true) {
    add('previous_preeclampsia', 'High blood pressure in a previous pregnancy (possible pre-eclampsia)');
  }
  if (input.previous_stillbirth === true) add('previous_stillbirth_neonatal_death', 'History of stillbirth');
  if (input.previous_child_death_after_birth === true) {
    add('previous_child_death_after_birth', 'A previous child died after birth (confirm if neonatal death)');
  }
  if (input.previous_low_birth_weight === true) {
    add('previous_low_birth_weight', 'Previous baby under 2.5 kg (possible preterm birth or growth restriction)');
  }
  if (input.previous_pph === true) add('previous_pph', 'Excessive bleeding after a previous delivery (postpartum haemorrhage)');

  const csCount = input.previous_cs_count ?? (input.previous_csection === true ? 1 : 0);
  if (csCount >= 2) add('previous_caesarean', `Previous caesarean sections (${csCount})`);
  else if (csCount === 1) add('previous_caesarean', 'Previous caesarean section');

  if (input.miscarriage_count != null && input.miscarriage_count >= 3) {
    add('recurrent_pregnancy_loss', `Recurrent pregnancy loss (${input.miscarriage_count} miscarriages)`);
  } else if (input.miscarriage_count === 2) {
    add('two_miscarriages', 'Two previous miscarriages');
  }

  // ─── 3. Current pregnancy complications ───────────────────────
  if (input.bp_systolic != null && input.bp_diastolic != null) {
    const severe = input.bp_systolic >= 160 || input.bp_diastolic >= 110;
    if (severe || input.bp_systolic >= 140 || input.bp_diastolic >= 90) {
      const protein = input.proteinuria ? ' with protein in urine (possible pre-eclampsia)' : '';
      add(
        'preeclampsia_gestational_hypertension',
        `${severe ? 'Severe-range BP' : 'Elevated BP'}: ${input.bp_systolic}/${input.bp_diastolic} mmHg${protein}`
      );
    }
  }

  if (input.is_twin_pregnancy === true) add('multiple_pregnancy', 'Twin/multiple pregnancy');

  // Malpresentation only matters near term
  if (input.ega_weeks != null && input.ega_weeks >= 36) {
    const presentation = input.fetal_presentation || '';
    const lie = input.fetal_lie || '';
    if (/breech|transverse|oblique|footling|face|brow|shoulder/i.test(presentation) || /transverse|oblique/i.test(lie)) {
      add('malpresentation', `Malpresentation at ${input.ega_weeks} weeks (${[presentation, lie].filter(Boolean).join(', ')})`);
    }
  }

  if (input.random_blood_glucose != null && input.random_blood_glucose >= 11.1) {
    add('gestational_diabetes', `High random blood sugar: ${input.random_blood_glucose} mmol/L`);
  }

  if (hasItem(input.current_symptoms, /seizure|convulsion/i)) {
    add('seizures_reported', 'Seizures / convulsions reported (exclude eclampsia)');
  }

  if (input.rhesus && /neg|^-$|−/i.test(input.rhesus)) {
    add('rhesus_negative', 'Rhesus negative (check for antibodies / plan anti-D)');
  }

  // ─── 4. Maternal demographic / obstetric factors ──────────────
  if (input.age != null) {
    if (input.age < 18) add('very_young_age', 'Maternal age under 18');
    if (input.age >= 35) add('advanced_maternal_age', `Advanced maternal age (${input.age})`);
  }

  if (input.parity != null && input.parity >= 5) add('grand_multiparity', `Grand multiparity: parity ${input.parity}`);

  if (input.bmi != null) {
    if (input.bmi >= 30) add('obesity_or_severe_underweight', `Obesity: BMI ${input.bmi}`);
    else if (input.bmi < 17) add('obesity_or_severe_underweight', `Severe underweight: BMI ${input.bmi}`);
  }

  // ─── 5. Gynaecological / uterine factors (from past surgeries) ─
  const surgeries = input.surgeries || [];
  if (hasItem(surgeries, /myomectomy|fibroid|hysterotomy|uterine surgery/i)) {
    add('previous_uterine_surgery', 'Previous uterine surgery / myomectomy (from past surgeries)');
  }
  if (hasItem(surgeries, /cerclage|cervical stitch|shirodkar|mcdonald/i)) {
    add('cervical_insufficiency', 'Cervical stitch (cerclage) in the past');
  }
  if (hasItem(surgeries, /cone biopsy|leep|lletz|conisation|conization|cervical surgery/i)) {
    add('previous_cervical_surgery', 'Previous cervical surgery (from past surgeries)');
  }

  // ─── Other findings ───────────────────────────────────────────
  // FIGO 2025: anaemia = Hb < 11 g/dL in all trimesters; mild 10–10.9, moderate 7–9.9, severe < 7.
  // The clinic records PCV (%); Hb ≈ PCV / 3, so severe < 21%, moderate 21–29%, mild 30–32%.
  const pph = ' (raises PPH risk; FIGO: treat with oral iron)';
  if (input.hemoglobin != null) {
    if (input.hemoglobin < 7) add('severe_anaemia', `Severe anaemia: Hb ${input.hemoglobin} g/dL (raises PPH risk)`);
    else if (input.hemoglobin < 10) add('moderate_anaemia', `Moderate anaemia: Hb ${input.hemoglobin} g/dL${pph}`);
    else if (input.hemoglobin < 11) add('mild_anaemia', `Mild anaemia: Hb ${input.hemoglobin} g/dL${pph}`);
  } else if (input.pcv != null) {
    if (input.pcv < 21) add('severe_anaemia', `Severe anaemia: PCV ${input.pcv}% (raises PPH risk)`);
    else if (input.pcv < 30) add('moderate_anaemia', `Moderate anaemia: PCV ${input.pcv}%${pph}`);
    else if (input.pcv < 33) add('mild_anaemia', `Mild anaemia: PCV ${input.pcv}%${pph}`);
  }

  // ─── Doctor-ticked checklist ──────────────────────────────────
  for (const id of input.clinician_flags || []) {
    if (!CHECKLIST_CONDITION_IDS.has(id) || matches.some((m) => m.id === id)) continue;
    add(id, `${RISK_CONDITIONS_BY_ID.get(id)!.label} (noted by doctor)`, 'doctor');
  }

  // First pregnancy plus a significant (listed, HIGH) risk factor — not mild findings or unconfirmed hints
  const isPrimigravida = input.gravidity === 1 || (input.gravidity == null && input.parity === 0 && csCount === 0);
  if (isPrimigravida && matches.some((m) => m.tier === 'HIGH')) {
    add('primigravida_with_risk_factors', 'First pregnancy with other risk factors');
  }

  // ─── Tier ─────────────────────────────────────────────────────
  let tier: RiskTier = 'LOW';
  for (const m of matches) if (TIER_ORDER[m.tier] > TIER_ORDER[tier]) tier = m.tier;
  const reasons = matches.map((m) => m.reason);

  // ─── Missing-data handling ────────────────────────────────────
  for (const field of HARD_CRITICAL_FIELDS) {
    if (input[field] === undefined || input[field] === null) {
      tier = escalateTier(tier);
      reasons.push(`Missing critical field: ${field}`);
    }
  }

  // Unconfirmed genotype — note for care team, do not escalate by itself
  if (knownGenotype === null) {
    reasons.push('Genotype not confirmed');
  }

  for (const field of SOFT_INCOMPLETE_FIELDS) {
    if (input[field] === undefined || input[field] === null) {
      reasons.push(`Incomplete clinic data: ${field}`);
    }
  }

  // FIGO 2025: screen for anaemia at booking and again at 28 weeks
  if (input.hemoglobin == null && input.pcv == null) {
    reasons.push('Incomplete clinic data: pcv (FIGO: screen for anaemia at booking and 28 weeks)');
  }

  return {
    tier,
    reasons,
    matches,
    engine_version: ENGINE_VERSION,
  };
}
