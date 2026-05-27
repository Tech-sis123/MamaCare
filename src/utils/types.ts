import { Request } from 'express';

// Extend Express Request with auth context
export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: 'patient' | 'doctor' | 'department_head';
    type: 'patient' | 'doctor';
  };
}

// Risk engine types
export type RiskTier = 'LOW' | 'MEDIUM' | 'HIGH';

export interface RiskInput {
  age?: number | null;
  bp_systolic?: number | null;
  bp_diastolic?: number | null;
  hemoglobin?: number | null;
  genotype?: string | null;
  previous_csection?: boolean | null;
  previous_stillbirth?: boolean | null;
  previous_eclampsia?: boolean | null;
  parity?: number | null;
  is_twin_pregnancy?: boolean | null;
  hiv_positive?: boolean | null;
}

export interface RiskOutput {
  tier: RiskTier;
  reasons: string[];
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
