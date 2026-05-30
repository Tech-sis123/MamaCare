"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const engine_1 = require("../src/modules/risk/engine");
(0, vitest_1.describe)('Risk Stratification Engine', () => {
    const baseHappyInput = {
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
    (0, vitest_1.it)('should categorize a healthy low-risk patient as LOW', () => {
        const result = (0, engine_1.runRiskEngine)(baseHappyInput);
        (0, vitest_1.expect)(result.tier).toBe('LOW');
        (0, vitest_1.expect)(result.reasons).toHaveLength(0);
    });
    (0, vitest_1.it)('should trigger MEDIUM for age under 18', () => {
        const result = (0, engine_1.runRiskEngine)({ ...baseHappyInput, age: 16 });
        (0, vitest_1.expect)(result.tier).toBe('MEDIUM');
        (0, vitest_1.expect)(result.reasons).toContain('Maternal age under 18');
    });
    (0, vitest_1.it)('should trigger MEDIUM for age over 35', () => {
        const result = (0, engine_1.runRiskEngine)({ ...baseHappyInput, age: 38 });
        (0, vitest_1.expect)(result.tier).toBe('MEDIUM');
        (0, vitest_1.expect)(result.reasons).toContain('Advanced maternal age (>35)');
    });
    (0, vitest_1.it)('should trigger HIGH for high blood pressure', () => {
        const result = (0, engine_1.runRiskEngine)({ ...baseHappyInput, bp_systolic: 140, bp_diastolic: 90 });
        (0, vitest_1.expect)(result.tier).toBe('HIGH');
        (0, vitest_1.expect)(result.reasons).toContain('Elevated BP: 140/90 mmHg');
    });
    (0, vitest_1.it)('should trigger HIGH for severe anaemia (Hb < 7)', () => {
        const result = (0, engine_1.runRiskEngine)({ ...baseHappyInput, hemoglobin: 6.5 });
        (0, vitest_1.expect)(result.tier).toBe('HIGH');
        (0, vitest_1.expect)(result.reasons).toContain('Severe anaemia: Hb 6.5 g/dL');
    });
    (0, vitest_1.it)('should trigger MEDIUM for moderate anaemia (Hb 7-10)', () => {
        const result = (0, engine_1.runRiskEngine)({ ...baseHappyInput, hemoglobin: 8.5 });
        (0, vitest_1.expect)(result.tier).toBe('MEDIUM');
        (0, vitest_1.expect)(result.reasons).toContain('Moderate anaemia: Hb 8.5 g/dL');
    });
    (0, vitest_1.it)('should trigger HIGH for genotype SS or SC', () => {
        const resultSS = (0, engine_1.runRiskEngine)({ ...baseHappyInput, genotype: 'SS' });
        (0, vitest_1.expect)(resultSS.tier).toBe('HIGH');
        (0, vitest_1.expect)(resultSS.reasons).toContain('High-risk genotype: SS');
        const resultSC = (0, engine_1.runRiskEngine)({ ...baseHappyInput, genotype: 'SC' });
        (0, vitest_1.expect)(resultSC.tier).toBe('HIGH');
        (0, vitest_1.expect)(resultSC.reasons).toContain('High-risk genotype: SC');
    });
    (0, vitest_1.it)('should trigger MEDIUM for previous C-section', () => {
        const result = (0, engine_1.runRiskEngine)({ ...baseHappyInput, previous_csection: true });
        (0, vitest_1.expect)(result.tier).toBe('MEDIUM');
        (0, vitest_1.expect)(result.reasons).toContain('Previous caesarean section');
    });
    (0, vitest_1.it)('should trigger HIGH for previous stillbirth', () => {
        const result = (0, engine_1.runRiskEngine)({ ...baseHappyInput, previous_stillbirth: true });
        (0, vitest_1.expect)(result.tier).toBe('HIGH');
        (0, vitest_1.expect)(result.reasons).toContain('History of stillbirth');
    });
    (0, vitest_1.it)('should trigger HIGH for previous eclampsia', () => {
        const result = (0, engine_1.runRiskEngine)({ ...baseHappyInput, previous_eclampsia: true });
        (0, vitest_1.expect)(result.tier).toBe('HIGH');
        (0, vitest_1.expect)(result.reasons).toContain('History of eclampsia');
    });
    (0, vitest_1.it)('should trigger MEDIUM for grand multiparity (parity >= 5)', () => {
        const result = (0, engine_1.runRiskEngine)({ ...baseHappyInput, parity: 5 });
        (0, vitest_1.expect)(result.tier).toBe('MEDIUM');
        (0, vitest_1.expect)(result.reasons).toContain('Grand multiparity: parity 5');
    });
    (0, vitest_1.it)('should trigger MEDIUM for twin pregnancy', () => {
        const result = (0, engine_1.runRiskEngine)({ ...baseHappyInput, is_twin_pregnancy: true });
        (0, vitest_1.expect)(result.tier).toBe('MEDIUM');
        (0, vitest_1.expect)(result.reasons).toContain('Twin/multiple pregnancy');
    });
    (0, vitest_1.it)('should trigger MEDIUM for HIV positive status', () => {
        const result = (0, engine_1.runRiskEngine)({ ...baseHappyInput, hiv_positive: true });
        (0, vitest_1.expect)(result.tier).toBe('MEDIUM');
        (0, vitest_1.expect)(result.reasons).toContain('HIV positive');
    });
    // Graceful degradation test
    (0, vitest_1.it)('should gracefully degrade by escalating and flagging missing critical fields', () => {
        const incompleteInput = {
            ...baseHappyInput,
            age: null, // missing critical field
            genotype: undefined, // missing critical field
        };
        const result = (0, engine_1.runRiskEngine)(incompleteInput);
        // Should be elevated to HIGH because two critical fields are missing (LOW -> MEDIUM -> HIGH)
        (0, vitest_1.expect)(result.tier).toBe('HIGH');
        (0, vitest_1.expect)(result.reasons).toContain('Missing critical field: age');
        (0, vitest_1.expect)(result.reasons).toContain('Missing critical field: genotype');
    });
});
