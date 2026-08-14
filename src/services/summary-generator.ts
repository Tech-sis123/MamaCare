/**
 * Pre-consult Summary Generator
 *
 * Template-based, NOT AI at runtime. Produces a one-paragraph summary
 * for doctors to review before a patient consultation.
 *
 * Format:
 * "Mrs. {name}, {age}, G{g}P{p}, currently {ega} weeks.
 *  Presenting with {symptoms}. {chronic}. Risk: {tier}. Last BP: {bp}."
 */

export interface SummaryInput {
  name: string;
  age: number | null;
  gravidity: number | null;
  parity: number | null;
  /** Number of children currently alive — shown as G2P1(1A) */
  children_alive: number | null;
  ega_weeks: number | null;
  recent_symptoms: string[];
  chronic_conditions: string[];
  risk_tier: string | null;
  bp_systolic: number | null;
  bp_diastolic: number | null;
}

/** Turn symptom_key / raw labels into readable clinical text */
export function humanizeSymptom(raw: string): string {
  if (!raw) return '';
  const key = String(raw).trim();
  const map: Record<string, string> = {
    severe_headache: 'severe headache',
    headache: 'headache',
    blurred_vision: 'blurred vision',
    visual_disturbance: 'visual disturbance',
    swelling: 'swelling',
    swollen_hands_face: 'swollen hands/face',
    epigastric_pain: 'epigastric pain',
    reduced_fetal_movement: 'reduced fetal movement',
    vaginal_bleeding: 'vaginal bleeding',
    severe_vomiting: 'severe vomiting',
    liquor_drainage: 'liquor drainage',
    convulsions: 'convulsions',
    chest_pain: 'chest pain',
    difficulty_breathing: 'difficulty breathing',
    fever: 'fever',
  };
  const slug = key.toLowerCase().replace(/\s+/g, '_');
  if (map[slug]) return map[slug];
  return key.replace(/_/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function generatePreConsultSummary(input: SummaryInput): string {
  const title = 'Mrs.';
  const name = input.name || 'Unknown';
  const age = input.age != null ? `${input.age}` : 'age unknown';
  let gp = 'G?P?';
  if (input.gravidity != null && input.parity != null) {
    gp = `G${input.gravidity}P${input.parity}`;
    // Children alive: G2P1(1A)
    if (input.children_alive != null && !Number.isNaN(Number(input.children_alive))) {
      gp += `(${Number(input.children_alive)}A)`;
    }
  }
  const ega = input.ega_weeks != null ? `${input.ega_weeks} weeks` : 'EGA unknown';

  const symptomList = input.recent_symptoms
    .map(humanizeSymptom)
    .filter(Boolean);
  // de-dupe while preserving order
  const seen = new Set<string>();
  const uniqueSymptoms = symptomList.filter((s) => {
    if (seen.has(s)) return false;
    seen.add(s);
    return true;
  });
  const symptoms =
    uniqueSymptoms.length > 0 ? uniqueSymptoms.join(', ') : 'no current complaints';

  const chronic =
    input.chronic_conditions.length > 0
      ? input.chronic_conditions.join('. ')
      : 'No chronic illness';
  const tier = input.risk_tier || 'Not assessed';
  const bp =
    input.bp_systolic != null && input.bp_diastolic != null
      ? `${input.bp_systolic}/${input.bp_diastolic}`
      : 'N/A';

  return `${title} ${name}, ${age}, ${gp}, currently ${ega}. Presenting with ${symptoms}. ${chronic}. Risk: ${tier}. Last BP: ${bp}.`;
}
