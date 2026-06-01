"use strict";
/**
 * Pre-consult Summary Generator
 *
 * Template-based, NOT AI at runtime. Produces a one-paragraph summary
 * for doctors to review before a patient consultation.
 *
 * Format:
 * "{title} {name}, {age}, G{gravidity}P{parity}, currently {ega_weeks} weeks.
 *  Presenting with {top_symptoms_or_'no current complaints'}.
 *  {chronic_conditions_or_'No chronic illness'}.
 *  Risk: {tier}. Last BP: {systolic}/{diastolic}."
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePreConsultSummary = generatePreConsultSummary;
function generatePreConsultSummary(input) {
    const title = 'Mrs.';
    const name = input.name || 'Unknown';
    const age = input.age != null ? `${input.age}` : 'age unknown';
    const gp = input.gravidity != null && input.parity != null
        ? `G${input.gravidity}P${input.parity}`
        : 'G?P?';
    const ega = input.ega_weeks != null ? `${input.ega_weeks} weeks` : 'EGA unknown';
    const symptoms = input.recent_symptoms.length > 0
        ? input.recent_symptoms.join(', ')
        : 'no current complaints';
    const chronic = input.chronic_conditions.length > 0
        ? input.chronic_conditions.join(', ')
        : 'No chronic illness';
    const tier = input.risk_tier || 'Not assessed';
    const bp = input.bp_systolic != null && input.bp_diastolic != null
        ? `${input.bp_systolic}/${input.bp_diastolic}`
        : 'N/A';
    return `${title} ${name}, ${age}, ${gp}, currently ${ega}. Presenting with ${symptoms}. ${chronic}. Risk: ${tier}. Last BP: ${bp}.`;
}
