import { Request } from 'express';

// Extend Express Request with auth context
export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: 'patient' | 'doctor' | 'department_head' | 'admin';
    type: 'patient' | 'doctor' | 'admin';
  };
}

// Risk engine types
export type RiskTier = 'LOW' | 'MEDIUM' | 'HIGH';

export interface RiskInput {
  age?: number | null;
  /** Latest BP: newest doctor vitals entry, else booking BP */
  bp_systolic?: number | null;
  bp_diastolic?: number | null;
  /** Protein in urine on the latest dipstick (1+ or more) */
  proteinuria?: boolean | null;
  /** Haemoglobin in g/dL, when a lab value exists */
  hemoglobin?: number | null;
  /** Packed cell volume in % (what the clinic records as PCV) */
  pcv?: number | null;
  genotype?: string | null;
  rhesus?: string | null;
  hiv_positive?: boolean | null;
  hep_b_positive?: boolean | null;
  hep_c_positive?: boolean | null;
  vdrl_positive?: boolean | null;
  /** Random blood glucose in mmol/L */
  random_blood_glucose?: number | null;
  bmi?: number | null;
  gravidity?: number | null;
  parity?: number | null;
  ega_weeks?: number | null;
  fetal_presentation?: string | null;
  fetal_lie?: string | null;
  is_twin_pregnancy?: boolean | null;
  /** Intake "Do you have any of these conditions?" e.g. hypertension, diabetes, epilepsy, asthma */
  medical_conditions?: string[];
  /** Intake symptom list, e.g. "Seizures / convulsions", "Chest pain" */
  current_symptoms?: string[];
  previous_csection?: boolean | null;
  previous_cs_count?: number | null;
  previous_stillbirth?: boolean | null;
  previous_child_death_after_birth?: boolean | null;
  previous_eclampsia?: boolean | null;
  previous_hypertension_in_pregnancy?: boolean | null;
  previous_pph?: boolean | null;
  previous_low_birth_weight?: boolean | null;
  miscarriage_count?: number | null;
  /** Past surgery names as typed by the patient */
  surgeries?: string[];
  /** Condition ids ticked by a doctor on the high-risk checklist */
  clinician_flags?: string[];
}

export interface RiskMatch {
  id: string;
  tier: RiskTier;
  reason: string;
  source: 'detected' | 'doctor';
}

export interface RiskOutput {
  tier: RiskTier;
  reasons: string[];
  matches: RiskMatch[];
  engine_version: string;
}

// Danger sign types
export interface SymptomInput {
  symptom_key: string;
  severity: 'mild' | 'moderate' | 'severe';
  notes?: string;
}

export interface DangerTrigger {
  trigger_key: string;
  description: string;
  symptoms_involved: string[];
}

// SSE event
export interface SSEEvent {
  event?: string;
  data: string;
  id?: string;
}
