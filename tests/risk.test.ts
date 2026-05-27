import { describe, it, expect } from 'vitest';
import { runRiskEngine } from '../src/modules/risk/engine';
import { RiskInput } from '../src/utils/types';

describe('Risk Stratification Engine', () => {
  const baseHappyInput: RiskInput = {
    age: 25,
    bp_systolic: 120,
    bp_diastolic: 80,
    hemoglobin: 12,
    genotype: 'AA',
    previous_csection: false,
    previous_stillbirth: false,
    previous_eclampsia: false,
    parity: 1,
    is_twin_pregnancy: false,
    hiv_positive: false,
  };

  it('should categorize a healthy low-risk patient as LOW', () => {
    const result = runRiskEngine(baseHappyInput);
    expect(result.tier).toBe('LOW');
    expect(result.reasons).toHaveLength(0);
  });

  it('should trigger MEDIUM for age under 18', () => {
    const result = runRiskEngine({ ...baseHappyInput, age: 16 });
    expect(result.tier).toBe('MEDIUM');
    expect(result.reasons).toContain('Maternal age under 18');
  });

  it('should trigger MEDIUM for age over 35', () => {
    const result = runRiskEngine({ ...baseHappyInput, age: 38 });
    expect(result.tier).toBe('MEDIUM');
    expect(result.reasons).toContain('Advanced maternal age (>35)');
  });

  it('should trigger HIGH for high blood pressure', () => {
    const result = runRiskEngine({ ...baseHappyInput, bp_systolic: 140, bp_diastolic: 90 });
    expect(result.tier).toBe('HIGH');
    expect(result.reasons).toContain('Elevated BP: 140/90 mmHg');
  });

  it('should trigger HIGH for severe anaemia (Hb < 7)', () => {
    const result = runRiskEngine({ ...baseHappyInput, hemoglobin: 6.5 });
    expect(result.tier).toBe('HIGH');
    expect(result.reasons).toContain('Severe anaemia: Hb 6.5 g/dL');
  });

  it('should trigger MEDIUM for moderate anaemia (Hb 7-10)', () => {
    const result = runRiskEngine({ ...baseHappyInput, hemoglobin: 8.5 });
    expect(result.tier).toBe('MEDIUM');
    expect(result.reasons).toContain('Moderate anaemia: Hb 8.5 g/dL');
  });

  it('should trigger HIGH for genotype SS or SC', () => {
    const resultSS = runRiskEngine({ ...baseHappyInput, genotype: 'SS' });
    expect(resultSS.tier).toBe('HIGH');
    expect(resultSS.reasons).toContain('High-risk genotype: SS');

    const resultSC = runRiskEngine({ ...baseHappyInput, genotype: 'SC' });
    expect(resultSC.tier).toBe('HIGH');
    expect(resultSC.reasons).toContain('High-risk genotype: SC');
  });

  it('should trigger MEDIUM for previous C-section', () => {
    const result = runRiskEngine({ ...baseHappyInput, previous_csection: true });
    expect(result.tier).toBe('MEDIUM');
    expect(result.reasons).toContain('Previous caesarean section');
  });

  it('should trigger HIGH for previous stillbirth', () => {
    const result = runRiskEngine({ ...baseHappyInput, previous_stillbirth: true });
    expect(result.tier).toBe('HIGH');
    expect(result.reasons).toContain('History of stillbirth');
  });

  it('should trigger HIGH for previous eclampsia', () => {
    const result = runRiskEngine({ ...baseHappyInput, previous_eclampsia: true });
    expect(result.tier).toBe('HIGH');
    expect(result.reasons).toContain('History of eclampsia');
  });

  it('should trigger MEDIUM for grand multiparity (parity >= 5)', () => {
    const result = runRiskEngine({ ...baseHappyInput, parity: 5 });
    expect(result.tier).toBe('MEDIUM');
    expect(result.reasons).toContain('Grand multiparity: parity 5');
  });

  it('should trigger MEDIUM for twin pregnancy', () => {
    const result = runRiskEngine({ ...baseHappyInput, is_twin_pregnancy: true });
    expect(result.tier).toBe('MEDIUM');
    expect(result.reasons).toContain('Twin/multiple pregnancy');
  });

  it('should trigger MEDIUM for HIV positive status', () => {
    const result = runRiskEngine({ ...baseHappyInput, hiv_positive: true });
    expect(result.tier).toBe('MEDIUM');
    expect(result.reasons).toContain('HIV positive');
  });

  // Graceful degradation test
  it('should gracefully degrade by escalating and flagging missing critical fields', () => {
    const incompleteInput: RiskInput = {
      ...baseHappyInput,
      age: null, // missing critical field
      genotype: undefined, // missing critical field
    };

    const result = runRiskEngine(incompleteInput);
    // Should be elevated to HIGH because two critical fields are missing (LOW -> MEDIUM -> HIGH)
    expect(result.tier).toBe('HIGH');
    expect(result.reasons).toContain('Missing critical field: age');
    expect(result.reasons).toContain('Missing critical field: genotype');
  });
});
