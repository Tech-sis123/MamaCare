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
 * MISSING-DATA POLICY (self-serve + clinic hybrid):
 * - HARD critical (age): missing → escalate tier (identity must exist).
 * - SOFT incomplete (BP, unconfirmed genotype): flag for care team but do NOT
 *   escalate to HIGH just because clinic vitals were never entered.
 *   Escalating on missing BP alone was marking every mother HIGH.
 */

import { RiskInput, RiskOutput, RiskTier } from '../../utils/types';

export const ENGINE_VERSION = '1.1.0';

/** Missing these forces a tier escalate (mother-path must provide them). */
const HARD_CRITICAL_FIELDS: (keyof RiskInput)[] = ['age'];

/** Missing these are noted for clinicians but do not raise risk tier alone. */
const SOFT_INCOMPLETE_FIELDS: (keyof RiskInput)[] = [
  'bp_systolic',
  'bp_diastolic',
];

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

  // Blood pressure rules (only when measured)
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

  // Genotype rules — only known high-risk genotypes raise tier
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
