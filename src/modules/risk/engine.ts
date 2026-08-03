/**
 * MAMA CARE AI — Risk Stratification Engine
 *
 * CLINICAL SAFETY CRITICAL CODE
 * This is a PURE FUNCTION. No database access, no side effects.
 * Input is a snapshot object, output is { tier, reasons[], engine_version }.
 *
 * Rules validated against WHO Antenatal Care Guidelines and
 * Nigerian Federal Ministry of Health ANC protocols.
 *
 * GRACEFUL DEGRADATION POLICY:
 * If a critical input is missing or null, NEVER downgrade.
 * Escalate one tier and add the missing field to reasons.
 */

import { RiskInput, RiskOutput, RiskTier } from '../../utils/types';

export const ENGINE_VERSION = '1.0.0';

// Critical fields — if missing, we escalate
const CRITICAL_FIELDS: (keyof RiskInput)[] = [
  'age',
  'bp_systolic',
  'bp_diastolic',
  'genotype',
];

function escalateTier(current: RiskTier): RiskTier {
  if (current === 'LOW') return 'MEDIUM';
  return 'HIGH'; // MEDIUM → HIGH, HIGH stays HIGH
}

/** Known clinical genotypes. "Not sure" / Unknown / empty → null (missing). */
function normalizeGenotype(value: string | null | undefined): string | null {
  if (value == null) return null;
  const gt = String(value).trim().toUpperCase();
  if (!gt || gt === 'NOT SURE' || gt === 'UNKNOWN' || gt === 'N/A') return null;
  return gt;
}

export function runRiskEngine(input: RiskInput): RiskOutput {
  let tier: RiskTier = 'LOW';
  const reasons: string[] = [];

  // ─── Rule evaluation ──────────────────────────────────────────

  // Age rules
  if (input.age != null) {
    if (input.age < 18) {
      tier = applyTier(tier, 'MEDIUM');
      reasons.push('Maternal age under 18');
    }
    if (input.age > 35) {
      tier = applyTier(tier, 'MEDIUM');
      reasons.push('Advanced maternal age (>35)');
    }
  }

  // Blood pressure rules
  if (input.bp_systolic != null && input.bp_diastolic != null) {
    if (input.bp_systolic >= 140 || input.bp_diastolic >= 90) {
      tier = applyTier(tier, 'HIGH');
      reasons.push(`Elevated BP: ${input.bp_systolic}/${input.bp_diastolic} mmHg`);
    }
  }

  // Hemoglobin rules
  if (input.hemoglobin != null) {
    if (input.hemoglobin < 7) {
      tier = applyTier(tier, 'HIGH');
      reasons.push(`Severe anaemia: Hb ${input.hemoglobin} g/dL`);
    } else if (input.hemoglobin >= 7 && input.hemoglobin <= 10) {
      tier = applyTier(tier, 'MEDIUM');
      reasons.push(`Moderate anaemia: Hb ${input.hemoglobin} g/dL`);
    }
  }

  // Genotype rules — "Not sure" / unknown values are treated as missing (see graceful degradation)
  const knownGenotype = normalizeGenotype(input.genotype);
  if (knownGenotype != null) {
    if (knownGenotype === 'SS' || knownGenotype === 'SC') {
      tier = applyTier(tier, 'HIGH');
      reasons.push(`High-risk genotype: ${knownGenotype}`);
    }
  }

  // Previous C-section
  if (input.previous_csection === true) {
    tier = applyTier(tier, 'MEDIUM');
    reasons.push('Previous caesarean section');
  }

  // Previous stillbirth
  if (input.previous_stillbirth === true) {
    tier = applyTier(tier, 'HIGH');
    reasons.push('History of stillbirth');
  }

  // Previous eclampsia
  if (input.previous_eclampsia === true) {
    tier = applyTier(tier, 'HIGH');
    reasons.push('History of eclampsia');
  }

  // Grand multiparity
  if (input.parity != null && input.parity >= 5) {
    tier = applyTier(tier, 'MEDIUM');
    reasons.push(`Grand multiparity: parity ${input.parity}`);
  }

  // Twin pregnancy
  if (input.is_twin_pregnancy === true) {
    tier = applyTier(tier, 'MEDIUM');
    reasons.push('Twin/multiple pregnancy');
  }

  // HIV status
  if (input.hiv_positive === true) {
    tier = applyTier(tier, 'MEDIUM');
    reasons.push('HIV positive');
  }

  // ─── Graceful degradation ─────────────────────────────────────
  // Check for missing critical fields. If any are missing,
  // escalate the tier and flag the missing field.

  for (const field of CRITICAL_FIELDS) {
    if (field === 'genotype') {
      // Treat "Not sure" / Unknown as missing critical genotype data
      if (normalizeGenotype(input.genotype) === null) {
        tier = escalateTier(tier);
        reasons.push(`Missing critical field: ${field}`);
      }
      continue;
    }
    if (input[field] === undefined || input[field] === null) {
      tier = escalateTier(tier);
      reasons.push(`Missing critical field: ${field}`);
    }
  }

  return {
    tier,
    reasons,
    engine_version: ENGINE_VERSION,
  };
}

/**
 * Apply a new tier, keeping the highest severity.
 * HIGH > MEDIUM > LOW
 */
function applyTier(current: RiskTier, incoming: RiskTier): RiskTier {
  const order: Record<RiskTier, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };
  return order[incoming] > order[current] ? incoming : current;
}
