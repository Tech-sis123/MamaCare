import { describe, it, expect } from 'vitest';
import { runRiskEngine } from '../src/modules/risk/engine';
import { buildRiskInput } from '../src/modules/risk/inputs';
import { RISK_CONDITIONS, CHECKLIST_CONDITION_IDS, riskGuidelineText } from '../src/modules/risk/conditions';
import { RiskInput } from '../src/utils/types';

describe('Risk Stratification Engine v2', () => {
  const baseHappyInput: RiskInput = {
    age: 25,
    bp_systolic: 120,
    bp_diastolic: 80,
    pcv: 36,
    genotype: 'AA',
    previous_csection: false,
    previous_stillbirth: false,
    previous_eclampsia: false,
    parity: 1,
    gravidity: 2,
    is_twin_pregnancy: false,
    hiv_positive: false,
  };

  const tierFor = (overrides: Partial<RiskInput>) => runRiskEngine({ ...baseHappyInput, ...overrides });

  it('keeps a healthy patient LOW with no reasons', () => {
    const result = runRiskEngine(baseHappyInput);
    expect(result.tier).toBe('LOW');
    expect(result.reasons).toHaveLength(0);
  });

  describe('every condition on the clinical guideline is HIGH', () => {
    it.each([
      ['age under 18', { age: 16 }, 'Maternal age under 18'],
      ['age 35 (inclusive)', { age: 35 }, 'Advanced maternal age (35)'],
      ['BP 140/90', { bp_systolic: 140, bp_diastolic: 90 }, 'Elevated BP: 140/90 mmHg'],
      ['sickle cell genotype', { genotype: 'SS' }, 'High-risk genotype: SS'],
      ['one previous CS', { previous_csection: true }, 'Previous caesarean section'],
      ['two previous CS', { previous_cs_count: 2 }, 'Previous caesarean sections (2)'],
      ['previous stillbirth', { previous_stillbirth: true }, 'History of stillbirth'],
      ['previous eclampsia', { previous_eclampsia: true }, 'History of eclampsia'],
      ['grand multiparity', { parity: 5 }, 'Grand multiparity: parity 5'],
      ['twins', { is_twin_pregnancy: true }, 'Twin/multiple pregnancy'],
      ['HIV', { hiv_positive: true }, 'HIV positive'],
      ['hepatitis B', { hep_b_positive: true }, 'Hepatitis B positive'],
      ['chronic hypertension at intake', { medical_conditions: ['Hypertension'] }, 'Chronic hypertension (reported at intake)'],
      ['epilepsy at intake', { medical_conditions: ['Epilepsy'] }, 'Epilepsy (reported at intake)'],
      ['previous PPH', { previous_pph: true }, 'Excessive bleeding after a previous delivery (postpartum haemorrhage)'],
      ['recurrent pregnancy loss', { miscarriage_count: 3 }, 'Recurrent pregnancy loss (3 miscarriages)'],
      ['obesity', { bmi: 32.4 }, 'Obesity: BMI 32.4'],
      ['myomectomy', { surgeries: ['Myomectomy'] }, 'Previous uterine surgery / myomectomy (from past surgeries)'],
      ['seizures reported', { current_symptoms: ['Seizures / convulsions'] }, 'Seizures / convulsions reported (exclude eclampsia)'],
      ['high blood sugar', { random_blood_glucose: 12 }, 'High random blood sugar: 12 mmol/L'],
    ])('%s', (_name, overrides, reason) => {
      const result = tierFor(overrides as Partial<RiskInput>);
      expect(result.tier).toBe('HIGH');
      expect(result.reasons).toContain(reason);
    });
  });

  it('flags severe-range BP and protein in urine', () => {
    const result = tierFor({ bp_systolic: 165, bp_diastolic: 112, proteinuria: true });
    expect(result.reasons).toContain('Severe-range BP: 165/112 mmHg with protein in urine (possible pre-eclampsia)');
  });

  it('only flags malpresentation from 36 weeks', () => {
    expect(tierFor({ ega_weeks: 30, fetal_presentation: 'Breech' }).tier).toBe('LOW');
    expect(tierFor({ ega_weeks: 37, fetal_presentation: 'Breech' }).tier).toBe('HIGH');
  });

  describe('signals that only point towards a condition are MEDIUM', () => {
    it.each([
      ['asthma without severity', { medical_conditions: ['Asthma'] }],
      ['rhesus negative', { rhesus: 'Negative' }],
      ['two miscarriages', { miscarriage_count: 2 }],
      ['previous low birth weight baby', { previous_low_birth_weight: true }],
      ['chest pain reported', { current_symptoms: ['Chest pain'] }],
    ])('%s', (_name, overrides) => {
      expect(tierFor(overrides as Partial<RiskInput>).tier).toBe('MEDIUM');
    });
  });

  describe('anaemia', () => {
    it('reads PCV as a percentage (the old engine treated it as Hb and never flagged)', () => {
      expect(tierFor({ pcv: 33 }).tier).toBe('LOW');
      expect(tierFor({ pcv: 27 }).reasons).toContain('Moderate anaemia: PCV 27% (raises PPH risk; FIGO: treat with oral iron)');
      expect(tierFor({ pcv: 18 }).tier).toBe('HIGH');
    });

    it('prefers a real haemoglobin value when present', () => {
      expect(tierFor({ hemoglobin: 6.5, pcv: 36 }).reasons).toContain('Severe anaemia: Hb 6.5 g/dL (raises PPH risk)');
    });

    it('notes mild anaemia (FIGO Hb 10–10.9 / PCV 30–32%) without raising the tier', () => {
      const result = tierFor({ pcv: 31 });
      expect(result.tier).toBe('LOW');
      expect(result.reasons).toContain('Mild anaemia: PCV 31% (raises PPH risk; FIGO: treat with oral iron)');
      expect(tierFor({ hemoglobin: 10.5 }).tier).toBe('LOW');
      // Mild anaemia is not a "significant" factor for a first pregnancy
      expect(tierFor({ pcv: 31, gravidity: 1 }).tier).toBe('LOW');
    });

    it('asks for an anaemia screen when no PCV or Hb is recorded', () => {
      const result = tierFor({ pcv: null });
      expect(result.tier).toBe('LOW');
      expect(result.reasons).toContain('Incomplete clinic data: pcv (FIGO: screen for anaemia at booking and 28 weeks)');
    });
  });

  it('applies doctor-ticked conditions and ignores unknown ids', () => {
    const result = tierFor({ clinician_flags: ['heart_disease', 'not_a_condition'] });
    expect(result.tier).toBe('HIGH');
    expect(result.reasons).toEqual(['Heart disease (noted by doctor)']);
    expect(result.matches[0].source).toBe('doctor');
  });

  it('notes a first pregnancy with other risk factors', () => {
    expect(tierFor({ gravidity: 1, age: 38 }).reasons).toContain('First pregnancy with other risk factors');
    expect(tierFor({ gravidity: 1 }).reasons).not.toContain('First pregnancy with other risk factors');
  });

  // Missing-data policy (self-serve mothers often have no clinic BP yet)
  it('escalates when age is missing (hard critical)', () => {
    const result = tierFor({ age: null });
    expect(result.tier).toBe('MEDIUM');
    expect(result.reasons).toContain('Missing critical field: age');
  });

  it('does NOT escalate solely because BP is missing', () => {
    const result = tierFor({ bp_systolic: null, bp_diastolic: null });
    expect(result.tier).toBe('LOW');
    expect(result.reasons.some((r) => r.includes('Incomplete clinic data'))).toBe(true);
  });

  it('notes unconfirmed genotype without escalating by itself', () => {
    const result = tierFor({ genotype: 'Not sure' });
    expect(result.reasons).toContain('Genotype not confirmed');
    expect(result.tier).toBe('LOW');
  });
});

describe('Risk condition catalogue', () => {
  it('covers all 6 guideline sections and grades guideline items HIGH', () => {
    for (const rc of RISK_CONDITIONS.filter((r) => !r.extra)) expect(rc.tier).toBe('HIGH');
    expect(CHECKLIST_CONDITION_IDS.has('heart_disease')).toBe(true);
    expect(CHECKLIST_CONDITION_IDS.has('rhesus_negative')).toBe(false);
    expect(riskGuidelineText()).toContain('6. Social / other factors');
  });
});

describe('buildRiskInput', () => {
  const intake = (pairs: Record<string, unknown>) =>
    Object.entries(pairs).map(([question_key, answer]) => ({ question_key, answer: answer as any }));

  it('reads past deliveries, conditions and surgeries from intake answers', () => {
    const input = buildRiskInput(
      { age: 30 },
      null,
      intake({
        child_1_delivery_mode: 'cs',
        child_2_delivery_mode: 'cs',
        child_1_state_now: 'stillbirth',
        child_2_postnatal_issues: 'Excessive bleeding, Infection',
        child_1_events: 'Hypertension,Malaria',
        child_2_birth_weight: '2.1',
        medical_conditions: 'Hypertension, Asthma',
        systems_symptoms: 'Headaches, Seizures / convulsions',
        surgery_1_type: 'Myomectomy',
        miscarriage_count: '3',
        is_twin_pregnancy: 'yes',
      })
    );
    expect(input).toMatchObject({
      previous_cs_count: 2,
      previous_stillbirth: true,
      previous_pph: true,
      previous_hypertension_in_pregnancy: true,
      previous_low_birth_weight: true,
      miscarriage_count: 3,
      is_twin_pregnancy: true,
      surgeries: ['Myomectomy'],
    });
    expect(input.medical_conditions).toEqual(['Hypertension', 'Asthma']);
  });

  it('uses the newest doctor vitals, BMI, lab results and checklist ticks', () => {
    const pregnancy: any = {
      booking_bp_systolic: 110,
      booking_bp_diastolic: 70,
      booking_weight: 95,
      booking_height: 160,
      vitals_log: [
        { date: '2026-09-01', bp_systolic: 120, bp_diastolic: 80, protein: 'Nil' },
        { date: '2026-10-20', bp_systolic: '150', bp_diastolic: '95', protein: '2+' },
      ],
      pcv: 28,
      rvd_status: 'Non-reactive',
      hep_b: 'Positive',
      rbg: '220',
      blood_group: 'O−',
      rhesus: null,
      risk_factors: ['heart_disease'],
      examination: { presentation: 'Breech' },
      current_ega_weeks: 37,
    };
    const input = buildRiskInput({ age: 28 }, pregnancy, []);
    expect(input).toMatchObject({
      bp_systolic: 150,
      bp_diastolic: 95,
      proteinuria: true,
      bmi: 37.1,
      pcv: 28,
      hiv_positive: false,
      hep_b_positive: true,
      random_blood_glucose: 12.2,
      rhesus: 'negative',
      clinician_flags: ['heart_disease'],
      fetal_presentation: 'Breech',
    });
  });
});
