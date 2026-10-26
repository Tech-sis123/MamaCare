/**
 * High-risk pregnancy conditions used by the risk engine.
 *
 * Source: the clinical team's "High-risk pregnancy conditions" guideline (Oct 2026),
 * sections 1–6 below. Every condition on that list is HIGH. A few extra entries
 * (marked `extra: true`) are signals the app can detect that point towards a listed
 * condition without confirming it; those are MEDIUM so a doctor reviews them.
 *
 * To change how a condition is graded, change its `tier` here — nothing else.
 */

import { RiskTier } from '../../utils/types';

export type RiskCategory =
  | 'medical'
  | 'obstetric_history'
  | 'current_pregnancy'
  | 'demographic'
  | 'gynaecological'
  | 'social'
  | 'other';

export interface RiskCondition {
  id: string;
  label: string;
  category: RiskCategory;
  tier: RiskTier;
  /** Doctors can tick it on the checklist (false = detected from data only) */
  checklist: boolean;
  /** Not on the clinical team's list; a detectable hint towards one of its conditions */
  extra?: boolean;
}

export const RISK_CATEGORY_LABELS: Record<RiskCategory, string> = {
  medical: '1. Maternal medical conditions',
  obstetric_history: '2. Previous obstetric history',
  current_pregnancy: '3. Current pregnancy complications',
  demographic: '4. Maternal demographic / obstetric factors',
  gynaecological: '5. Gynaecological / uterine factors',
  social: '6. Social / other factors',
  other: 'Other findings',
};

const c = (
  id: string,
  label: string,
  category: RiskCategory,
  tier: RiskTier = 'HIGH',
  opts: { checklist?: boolean; extra?: boolean } = {}
): RiskCondition => ({ id, label, category, tier, checklist: opts.checklist ?? true, extra: opts.extra });

export const RISK_CONDITIONS: RiskCondition[] = [
  // 1. Maternal medical conditions
  c('chronic_hypertension', 'Chronic hypertension', 'medical'),
  c('heart_disease', 'Heart disease', 'medical'),
  c('diabetes', 'Diabetes mellitus / gestational diabetes with complications', 'medical'),
  c('renal_disease', 'Renal disease', 'medical'),
  c('liver_disease', 'Liver disease', 'medical'),
  c('thyroid_disease', 'Thyroid disease', 'medical'),
  c('sickle_cell_disease', 'Sickle cell disease', 'medical'),
  c('epilepsy', 'Epilepsy', 'medical'),
  c('autoimmune_disease', 'Autoimmune disease (e.g. SLE/APS)', 'medical'),
  c('hiv_or_significant_infection', 'HIV/AIDS or significant infection', 'medical'),
  c('severe_asthma', 'Severe asthma', 'medical'),
  c('thrombophilia', 'Thrombophilia', 'medical'),
  c('asthma_unspecified', 'Asthma (severity not recorded)', 'medical', 'MEDIUM', { checklist: false, extra: true }),
  c('cardiorespiratory_symptoms', 'Chest pain, palpitations or breathing difficulty reported', 'medical', 'MEDIUM', {
    checklist: false,
    extra: true,
  }),

  // 2. Previous obstetric history
  c('previous_preeclampsia', 'Previous pre-eclampsia / eclampsia', 'obstetric_history'),
  c('previous_stillbirth_neonatal_death', 'Previous stillbirth / neonatal death', 'obstetric_history'),
  c('previous_preterm_birth', 'Previous preterm birth', 'obstetric_history'),
  c('previous_fgr', 'Previous FGR / IUGR', 'obstetric_history'),
  c('previous_shoulder_dystocia', 'Previous shoulder dystocia', 'obstetric_history'),
  c('previous_pph', 'Previous postpartum haemorrhage', 'obstetric_history'),
  c('previous_uterine_rupture', 'Previous uterine rupture', 'obstetric_history'),
  c('previous_caesarean', 'Previous caesarean section', 'obstetric_history'),
  c('previous_molar_pregnancy', 'Previous molar pregnancy', 'obstetric_history'),
  c('recurrent_pregnancy_loss', 'Recurrent pregnancy loss', 'obstetric_history'),
  c('previous_child_death_after_birth', 'A previous child died after birth (confirm if neonatal)', 'obstetric_history', 'MEDIUM', {
    checklist: false,
    extra: true,
  }),
  c('previous_low_birth_weight', 'Previous baby under 2.5 kg (possible preterm birth or FGR)', 'obstetric_history', 'MEDIUM', {
    checklist: false,
    extra: true,
  }),
  c('two_miscarriages', 'Two previous miscarriages', 'obstetric_history', 'MEDIUM', { checklist: false, extra: true }),

  // 3. Current pregnancy complications
  c('preeclampsia_gestational_hypertension', 'Pre-eclampsia / gestational hypertension', 'current_pregnancy'),
  c('multiple_pregnancy', 'Multiple pregnancy', 'current_pregnancy'),
  c('placenta_previa_accreta', 'Placenta previa / accreta spectrum', 'current_pregnancy'),
  c('antepartum_haemorrhage', 'Antepartum haemorrhage', 'current_pregnancy'),
  c('prom_pprom', 'PPROM / PROM', 'current_pregnancy'),
  c('preterm_labour', 'Preterm labour', 'current_pregnancy'),
  c('fetal_growth_restriction', 'Fetal growth restriction', 'current_pregnancy'),
  c('liquor_abnormality', 'Oligohydramnios / polyhydramnios', 'current_pregnancy'),
  c('malpresentation', 'Malpresentation', 'current_pregnancy'),
  c('congenital_fetal_anomaly', 'Congenital fetal anomaly', 'current_pregnancy'),
  c('rh_isoimmunisation', 'Rh isoimmunisation', 'current_pregnancy'),
  c('gestational_diabetes', 'Gestational diabetes', 'current_pregnancy'),
  c('chorioamnionitis', 'Chorioamnionitis / intra-amniotic infection', 'current_pregnancy'),
  c('seizures_reported', 'Seizures / convulsions reported', 'current_pregnancy', 'HIGH', { checklist: false, extra: true }),
  c('rhesus_negative', 'Rhesus negative (check for antibodies / anti-D)', 'current_pregnancy', 'MEDIUM', {
    checklist: false,
    extra: true,
  }),

  // 4. Maternal demographic / obstetric factors
  c('very_young_age', 'Very young maternal age', 'demographic'),
  c('advanced_maternal_age', 'Advanced maternal age (35 or older)', 'demographic'),
  c('grand_multiparity', 'Grand multiparity', 'demographic'),
  c('primigravida_with_risk_factors', 'Primigravida with significant risk factors', 'demographic'),
  c('obesity_or_severe_underweight', 'Obesity or severe underweight', 'demographic'),
  c('poor_anc_unbooked', 'Poor antenatal care / unbooked pregnancy', 'demographic'),

  // 5. Gynaecological / uterine factors
  c('uterine_fibroids', 'Significant uterine fibroids', 'gynaecological'),
  c('previous_uterine_surgery', 'Previous major uterine surgery / myomectomy', 'gynaecological'),
  c('cervical_insufficiency', 'Cervical insufficiency', 'gynaecological'),
  c('uterine_anomaly', 'Uterine anomaly', 'gynaecological'),
  c('previous_cervical_surgery', 'Previous cervical surgery', 'gynaecological'),

  // 6. Social / other factors
  c('substance_alcohol_use', 'Substance / alcohol use', 'social'),
  c('significant_malnutrition', 'Significant malnutrition', 'social'),
  c('severe_psychosocial_problems', 'Severe psychosocial problems', 'social'),
  c('limited_emergency_access', 'Limited access to emergency obstetric care', 'social'),

  // Anaemia, graded per FIGO 2025 (Hb < 11 g/dL; mild 10–10.9, moderate 7–9.9, severe < 7).
  // Mild anaemia is shown to the care team for treatment but does not raise the tier.
  c('severe_anaemia', 'Severe anaemia', 'other', 'HIGH', { checklist: false, extra: true }),
  c('moderate_anaemia', 'Moderate anaemia', 'other', 'MEDIUM', { checklist: false, extra: true }),
  c('mild_anaemia', 'Mild anaemia', 'other', 'LOW', { checklist: false, extra: true }),
];

export const RISK_CONDITIONS_BY_ID = new Map(RISK_CONDITIONS.map((rc) => [rc.id, rc]));

/** Conditions a doctor can tick on the checklist. */
export const CHECKLIST_CONDITION_IDS = new Set(RISK_CONDITIONS.filter((rc) => rc.checklist).map((rc) => rc.id));

/** Plain-text version of the guideline for AI prompts. */
export function riskGuidelineText(): string {
  const lines: string[] = [];
  for (const [category, title] of Object.entries(RISK_CATEGORY_LABELS)) {
    const items = RISK_CONDITIONS.filter((rc) => rc.category === category && !rc.extra).map((rc) => rc.label);
    if (items.length) lines.push(`${title}: ${items.join('; ')}.`);
  }
  return lines.join('\n');
}
