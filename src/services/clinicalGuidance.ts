/**
 * Published clinical guidance given to 9Care's AI assistants as context.
 *
 * Each entry summarises one source in our own words with its citation. Doctor
 * summaries can include doses; patient summaries stay general (the patient
 * assistant must never prescribe). To add a paper, append an entry here.
 */

export interface GuidanceSource {
  id: string;
  title: string;
  citation: string;
  /** Key recommendations for the doctor assistant */
  doctor: string[];
  /** Plain-language points the patient assistant may share */
  patient: string[];
}

export const CLINICAL_GUIDANCE: GuidanceSource[] = [
  {
    id: 'figo-anaemia-2025',
    title: 'FIGO good practice recommendations on anaemia in pregnancy, to reduce the incidence and impact of PPH',
    citation: 'Ubom AE, et al. Int J Gynecol Obstet. 2025;171:993–1007. doi:10.1002/ijgo.70529 (CC BY)',
    doctor: [
      'Screen every pregnant woman for anaemia at booking and again at 28 weeks with an FBC; Hb or PCV/haematocrit is acceptable where FBC is unavailable.',
      'Anaemia = Hb < 11.0 g/dL in all trimesters and postpartum (FIGO advises this cutoff over the 10 g/dL used in some African settings, to reduce PPH risk). Severity: mild 10–10.9, moderate 7–9.9, severe < 7 g/dL.',
      'Prevention: daily oral elemental iron 30–60 mg (60 mg where anaemia prevalence ≥ 40%, or with previous anaemia, multiple pregnancy, interpregnancy interval < 1 year, vegetarian diet). If daily iron is not tolerated: 120 mg weekly.',
      'Take iron in the morning on an empty stomach, 1 h before or 2 h after food and after calcium, PPIs, antacids, thyroxine, tea, coffee, milk, soy or eggs.',
      'Treatment of iron deficiency anaemia: oral iron 60–120 mg elemental daily until Hb ≥ 11 g/dL, then 30–60 mg for at least 3 months or 6 weeks postpartum, whichever is longer. Ferritin < 30 µg/L confirms iron deficiency; without ferritin, a rise of ≥ 1 g/dL after 2 weeks of oral iron is diagnostic.',
      'Parenteral iron (not in the first trimester): poor response to oral iron (< 1 g/dL rise in 2 weeks or < 2 g/dL in 4 weeks), intolerance or non-compliance, moderate–severe anaemia within 4–6 weeks of expected delivery, or malabsorption (gastric surgery, IBD).',
      'Blood transfusion: severe anaemia near term, acute severe bleeding or risk of further bleeding, or symptomatic anaemia with haemodynamic or cardiac compromise.',
      'Folic acid: 400 µg daily with iron throughout pregnancy. 5 mg daily for women at high risk of neural tube defects (until 12 weeks), and throughout pregnancy for haemoglobinopathies, BMI ≥ 30 or anti-folate drugs.',
      'Multiple micronutrient supplements (with ≤ 30 mg iron) should be considered over iron–folic acid alone in LMICs; add iron tablets when higher iron doses are needed.',
      'Malaria: IPTp-SP for all women in endemic areas from early second trimester, doses ≥ 4 weeks apart, at least 3 doses, given as directly observed therapy (3 tablets, 1500 mg sulfadoxine / 75 mg pyrimethamine). SP is contraindicated before 13 weeks, with other sulfa drugs (e.g. co-trimoxazole) or SP allergy.',
      'Do not give high-dose folic acid (≥ 5 mg) with SP — it reduces SP efficacy. Women on 5 mg folic acid should switch to low dose (0.4–1.5 mg) for 14 days after each SP dose.',
      'Deworming: single dose albendazole 400 mg or mebendazole 500 mg after the first trimester where helminth prevalence ≥ 20% and anaemia ≥ 40%.',
      'Haemoglobinopathy: screen all women with FBC and Hb electrophoresis at booking. In sickle cell disease give 5 mg folic acid daily (not weekly), iron only with proven deficiency (ferritin < 30 µg/L) — or 30 mg/day where ferritin is unavailable and there is no history of repeated transfusion — and daily proguanil malaria prophylaxis (also the Nigerian recommendation). Transfuse for acute anaemia (Hb < 5–7 g/dL, > 2 g/dL or > 20% below steady state); routine prophylactic transfusion is not recommended. Thalassaemia: maintain Hb around 10 g/dL.',
      'Correcting anaemia before delivery is a key strategy to reduce PPH: severely anaemic women can decompensate after as little as 250 mL blood loss.',
    ],
    patient: [
      'Low blood (anaemia) is common in pregnancy and makes heavy bleeding after delivery more dangerous, so the clinic checks her blood level at booking and again around 28 weeks.',
      'Take the iron and folic acid tablets the clinic gives every day. Iron works best on an empty stomach in the morning, and not within 1–2 hours of tea, coffee, milk, eggs or antacids.',
      'If iron tablets upset her stomach, tell the clinic instead of stopping — there are other ways to take them.',
      'Malaria can cause low blood. Take the malaria prevention tablets (IPT) given at the clinic from the second trimester, at least 3 doses, and sleep under a treated mosquito net every night.',
      'Women with sickle cell disease need special care in pregnancy (different folic acid and malaria medicine) and should make sure their doctor knows.',
      'Signs of low blood worth reporting: feeling very tired or weak, dizziness, fast heartbeat, shortness of breath, or very pale palms, eyes or lips.',
    ],
  },
];

export function doctorGuidanceText(): string {
  return CLINICAL_GUIDANCE.map(
    (g) => `${g.title} (${g.citation}):\n${g.doctor.map((line) => `- ${line}`).join('\n')}`
  ).join('\n\n');
}

export function patientGuidanceText(): string {
  return CLINICAL_GUIDANCE.flatMap((g) => g.patient.map((line) => `- ${line}`)).join('\n');
}
