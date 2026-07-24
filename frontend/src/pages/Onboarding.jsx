import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { upsertProfile, addPregnancy, saveIntake, submitIntake } from '../lib/api';
import { getPatientId } from '../lib/auth';

// ── Colours (sky-blue theme) ─────────────────────────────────────────────────
const C = {
  primary:       'sky-600',
  primaryLight:  'sky-50',
  primaryMid:    'sky-100',
  primaryText:   'sky-700',
  primaryBorder: 'sky-400',
  ring:          'ring-sky-400',
};

// ── Shared UI ────────────────────────────────────────────────────────────────
const Label = ({ children }) => (
  <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-2">{children}</p>
);

const RiskBadge = ({ text }) => (
  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 mt-2">
    <span className="text-red-600 font-bold text-sm mt-0.5">⚠</span>
    <p className="text-red-600 font-bold text-sm">{text}</p>
  </div>
);

const Field = ({ label, value, onChange, placeholder, type = 'text', hint, min, max }) => (
  <div>
    {label && <Label>{label}</Label>}
    <input
      type={type}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      min={min} max={max}
      className="w-full px-4 py-3 rounded-xl border-2 border-primary/20 bg-white text-slate-800 text-base focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
    />
    {hint && <p className="mt-1.5 text-xs text-slate-400">{hint}</p>}
  </div>
);

const YesNo = ({ value, onChange, yesLabel = 'Yes', noLabel = 'No' }) => (
  <div className="flex gap-3">
    {[{ v: true, l: yesLabel }, { v: false, l: noLabel }].map(opt => (
      <button key={String(opt.v)} onClick={() => onChange(opt.v)}
        className={`flex-1 py-4 rounded-xl border-2 text-base font-semibold transition-all active:scale-95 ${
          value === opt.v
            ? 'border-primary bg-primary text-white shadow-md'
            : 'border-primary/20 bg-white text-slate-700 hover:border-primary/50'
        }`}
      >{opt.l}</button>
    ))}
  </div>
);

const Chips = ({ options, value, onChange, multi = false }) => {
  const vals = multi ? (value || []) : null;
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const v = opt.value !== undefined ? opt.value : opt;
        const l = opt.label !== undefined ? opt.label : opt;
        const active = multi ? vals.includes(v) : value === v;
        return (
          <button key={String(v)} onClick={() => {
            if (multi) {
              if (vals.includes(v)) onChange(vals.filter(x => x !== v));
              else onChange([...vals, v]);
            } else onChange(v);
          }}
            className={`px-4 py-2.5 rounded-full border-2 text-sm font-semibold transition-all active:scale-95 ${
              active
                ? 'border-primary bg-primary text-white shadow-sm'
                : 'border-primary/20 bg-white text-slate-700 hover:border-primary/50'
            }`}
          >{l}</button>
        );
      })}
    </div>
  );
};

// ── Risk computation ──────────────────────────────────────────────────────────
function computeRisks(data) {
  const risks = [];
  const age = parseInt(data.age);
  if (!isNaN(age) && age > 35) risks.push({ field: 'age', text: 'Advanced maternal age (over 35)' });
  if (!isNaN(age) && age < 18) risks.push({ field: 'age', text: 'Teenage pregnancy (under 18)' });

  const parity = parseInt(data.parity);
  if (!isNaN(parity) && parity > 5) risks.push({ field: 'parity', text: 'Grand multiparity — more than 5 deliveries' });

  const children = data.children || [];
  const csCount = children.filter(c => c.deliveryMode === 'cs').length;
  if (csCount >= 2) risks.push({ field: 'children', text: '2 or more previous caesarean sections' });

  children.forEach((c, i) => {
    const w = parseFloat(c.birthWeight);
    if (!isNaN(w) && w >= 4) risks.push({ field: 'children', text: `Macrosomic baby — child ${i + 1} weighed ${w} kg` });
    if (c.stateNow === 'died_at_birth') risks.push({ field: 'children', text: `Bad obstetric history — child ${i + 1} died at birth` });
    if (c.anomaly) risks.push({ field: 'children', text: `Anomaly noted in child ${i + 1}` });
  });

  if (data.genotype === 'SS') risks.push({ field: 'genotype', text: 'Sickle cell disease (SS genotype)' });
  if (data.hivStatus === 'reactive') risks.push({ field: 'hivStatus', text: 'HIV reactive — PMTCT pathway required' });

  const bp = parseInt(data.bpSystolic);
  const bpd = parseInt(data.bpDiastolic);
  if ((!isNaN(bp) && bp >= 140) || (!isNaN(bpd) && bpd >= 90))
    risks.push({ field: 'bp', text: 'Elevated blood pressure at booking' });

  const pcv = parseInt(data.pcv);
  if (!isNaN(pcv) && pcv < 30) risks.push({ field: 'pcv', text: 'Anaemia — PCV below 30%' });

  return risks;
}

// ── G/P notation ─────────────────────────────────────────────────────────────
function computeGP(data) {
  const G = parseInt(data.gravidity);
  const P = parseInt(data.parity);
  const alive = parseInt(data.childrenAlive);
  if (isNaN(G) || isNaN(P)) return null;
  const losses = G - P;
  return `G${G}P${P}${losses > 0 ? `+${losses}` : ''}${!isNaN(alive) ? `(${alive}A)` : ''}`;
}

// ── Section definitions ───────────────────────────────────────────────────────
const SECTION_META = [
  { id: 'biodata',        label: 'Biodata',                icon: 'person', desc: 'Personal information' },
  { id: 'index',          label: 'Index Pregnancy',        icon: 'pregnant_woman', desc: 'About this pregnancy' },
  { id: 'obstetric',      label: 'Obstetric History',      icon: 'child_care', desc: 'Previous pregnancies & births' },
  { id: 'gynae',          label: 'Gynaecological History', icon: 'water_drop', desc: 'Menstrual & gynaecological' },
  { id: 'medical',        label: 'Medical History',        icon: 'medication', desc: 'Conditions, drugs, allergies' },
  { id: 'family_social',  label: 'Family & Social',        icon: 'family_restroom', desc: 'Partner and home life' },
  { id: 'systems',        label: 'Review of Systems',      icon: 'stethoscope', desc: 'Current symptoms by system' },
];

// ── Build slides per section (data-driven) ────────────────────────────────────
function buildSlides(sectionId, data) {
  switch (sectionId) {

    case 'biodata': return [
      { id: 'occupation',    question: 'What is your occupation?',                   field: 'occupation',    type: 'text',    required: false, placeholder: 'e.g. Trader, Teacher, Nurse' },
      { id: 'marital',       question: 'What is your marital status?',               field: 'marital',       type: 'chips',   required: false,
        options: ['Single', 'Married', 'Widowed', 'Divorced'] },
      { id: 'address',       question: 'What is your home address?',                  field: null,            type: 'address', required: false },
      { id: 'religion',      question: 'What is your religion?',                     field: 'religion',      type: 'chips',   required: false,
        options: ['Christian', 'Muslim', 'Traditional', 'Other'] },
      { id: 'christianDenom', question: 'Which denomination are you?',               field: 'christianDenom', type: 'chips',  required: false,
        condition: d => d.religion === 'Christian',
        options: ['Pentecostal', 'Catholic', "Jehovah's Witness", 'Other'] },
      { id: 'tribe',         question: 'What is your tribe / ethnicity?',            field: 'tribe',         type: 'text',    required: false, placeholder: 'e.g. Edo, Yoruba, Igbo' },
      { id: 'lmpKnown',     question: 'Do you know the exact date your last period started?', field: 'lmpKnown', type: 'yes_no', required: true },
      { id: 'lmpDate',      question: 'When did your last period start? (LMP)',      field: 'lmpDate',       type: 'date',    required: false,
        condition: d => d.lmpKnown === true,
        hint: 'This helps us calculate your due date and gestational age.' },
      { id: 'lmpMonthYear', question: 'Which month and year did your last period start?', field: null,      type: 'month_year', required: false,
        condition: d => d.lmpKnown === false,
        hint: 'Approximate is fine — just pick the month and year.' },
      { id: 'gravidity',     question: 'How many times have you been pregnant in total? (including this one, miscarriages and terminations)',
        field: 'gravidity',     type: 'number',  required: true,  placeholder: 'e.g. 3', min: 1, max: 20,
        hint: 'Count every pregnancy — include this one, miscarriages, terminations.' },
      { id: 'parity',        question: 'How many of those pregnancies reached 24 weeks (6 months) or more?',
        field: 'parity',        type: 'number',  required: true,  placeholder: 'e.g. 2', min: 0, max: 20,
        hint: 'This is your parity — babies born alive or stillborn after 24 weeks.',
        riskCheck: v => { const p = parseInt(v); if (p > 5) return 'Grand multiparity — more than 5 deliveries. Flagged as high risk.'; return null; } },
      { id: 'multiGestation', question: 'Did any of those pregnancies include multiple gestation?', field: 'multiGestation', type: 'yes_no', required: false },
      { id: 'childrenAlive', question: 'Of the children you have given birth to, how many are currently alive?',
        field: 'childrenAlive', type: 'number',  required: false, placeholder: 'e.g. 2', min: 0, max: 20,
        condition: d => parseInt(d.parity) > 0 },
    ];

    case 'index': return [
      { id: 'desired',        question: 'Was this pregnancy planned or desired?',        field: 'desired',        type: 'yes_no',  required: false },
      { id: 'conception',     question: 'How was this pregnancy achieved?',              field: 'conception',     type: 'chips',   required: false,
        options: [{ value: 'spontaneous', label: 'Spontaneous (natural)' }, { value: 'assisted', label: 'Assisted (IVF / IUI)' }] },
      { id: 'pregTestDone',   question: 'Did you do a pregnancy test to confirm this pregnancy?', field: 'pregTestDone', type: 'yes_no', required: false },
      { id: 'pregTestType',   question: 'What type of pregnancy test did you use?',      field: 'pregTestType',   type: 'chips',   required: false,
        condition: d => d.pregTestDone === true,
        options: [{ value: 'blood', label: 'Blood test' }, { value: 'strip', label: 'Urine strip' }] },
      { id: 'scanDone',       question: 'Did you have an ultrasound scan to confirm the pregnancy?', field: 'scanDone', type: 'yes_no', required: false },
      { id: 'scanDate',       question: 'When was the scan done?',                       field: 'scanDate',       type: 'date',    required: false,
        condition: d => d.scanDone === true,
        hint: 'Approximate date is fine.' },
      { id: 'bloodGroup',     question: 'What is your blood group?',                    field: 'bloodGroup',     type: 'chips',   required: false,
        options: ['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−'] },
      { id: 'genotype',       question: 'What is your genotype?',                       field: 'genotype',       type: 'chips',   required: false,
        options: ['AA', 'AS', 'SS', 'AC'],
        riskCheck: v => v === 'SS' ? 'Sickle cell disease — requires close monitoring.' : null },
    ];

    case 'obstetric': {
      const p = parseInt(data.parity) || 0;
      if (p === 0) return [{ id: 'obs_none', question: null, type: 'obs_none', required: false }];
      return Array.from({ length: p }, (_, i) => ({
        id: `child_${i}`, question: null, type: 'child_card', childIdx: i, required: false,
      }));
    }

    case 'gynae': return [
      { id: 'menarche',      question: 'At what age did you first see your period?',    field: 'menarche',       type: 'number',  required: false, placeholder: 'e.g. 13', min: 7, max: 20, hint: 'This is called your menarche age.' },
      { id: 'cycleLength',   question: 'How many days is your menstrual cycle?',        field: 'cycleLength',    type: 'number',  required: false, placeholder: 'e.g. 28', min: 14, max: 60, hint: 'Count from the first day of one period to the first day of the next.' },
      { id: 'flowDays',      question: 'How many days do you bleed for?',               field: 'flowDays',       type: 'number',  required: false, placeholder: 'e.g. 5',  min: 1,  max: 14 },
      { id: 'dysmenorrhea',  question: 'Do you experience pain during your periods?',   field: 'dysmenorrhea',   type: 'yes_no',  required: false },
      { id: 'missedPeriod',  question: 'Have you ever missed your period when you were not pregnant?', field: 'missedPeriod', type: 'yes_no', required: false },
      { id: 'heavyBleeding', question: 'Do you usually have heavy periods?',                    field: 'heavyBleeding',  type: 'yes_no',  required: false, hint: 'Heavy bleeding during periods' },
      { id: 'intermenstrual',question: 'Do you bleed between your periods?',            field: 'intermenstrual', type: 'yes_no',  required: false },
      { id: 'postcoital',    question: 'Do you bleed after sex?',                       field: 'postcoital',     type: 'yes_no',  required: false },
      { id: 'dyspareunia',   question: 'Do you have pain during sex?',                  field: 'dyspareunia',    type: 'yes_no',  required: false },
      { id: 'contraAware',   question: 'Do you know about contraceptives (family planning)?',             field: 'contraAware',    type: 'yes_no',  required: false },
      { id: 'contraUsed',    question: 'Have you ever used contraceptives?',            field: 'contraUsed',     type: 'yes_no',  required: false, condition: d => d.contraAware === true },
      { id: 'contraType',    question: 'Which type of contraceptive did you use?',      field: 'contraType',     type: 'chips',   required: false,
        condition: d => d.contraUsed === true,
        options: [{ value: 'pill', label: 'Pill' }, { value: 'injection', label: 'Injection' }, { value: 'implant', label: 'Implant' }, { value: 'iud', label: 'IUD / Coil' }, { value: 'condom', label: 'Condom' }, { value: 'other', label: 'Other' }] },
      { id: 'contraStartDate', question: 'When did you start using it?',                field: 'contraStartDate', type: 'text', required: false, condition: d => d.contraUsed === true && d.contraType && d.contraType !== 'condom', placeholder: 'e.g. Year (2020) is okay as a response' },
      { id: 'contraRemoved',   question: 'Did you stop taking it/have it removed before you got pregnant?',field: 'contraRemoved',  type: 'yes_no', required: false, condition: d => d.contraUsed === true && d.contraType && d.contraType !== 'condom' },
      { id: 'papSmearAware', question: 'Have you heard of a pap smear (cervical smear)?', field: 'papSmearAware', type: 'yes_no', required: false },
      { id: 'papSmearDone',  question: 'Have you had a pap smear done before?',         field: 'papSmearDone',   type: 'yes_no',  required: false, condition: d => d.papSmearAware === true },
      { id: 'topDone',       question: 'Have you ever had a termination of pregnancy (abortion)?', field: 'topDone',        type: 'yes_no',  required: false, hint: 'Any pregnancy you had to remove.' },
      { id: 'topCount',      question: 'How many terminations have you had?',           field: 'topCount',       type: 'number',  required: false, condition: d => d.topDone === true, placeholder: 'e.g. 1', min: 1, max: 10 },
      { id: 'topYear',       question: 'What year was the most recent termination?',    field: 'topYear',        type: 'number',  required: false, condition: d => d.topDone === true, placeholder: 'e.g. 2021', min: 1980, max: 2026 },
      { id: 'topMethod',     question: 'How was the termination done?',                 field: 'topMethod',      type: 'chips',   required: false,
        condition: d => d.topDone === true,
        options: [{ value: 'medical', label: 'Medical (drugs & injection)' }, { value: 'surgical', label: 'Surgical [ Manual Vacuum Aspiration (MVA), Dilatation & Curettage (D&C) ]' }, { value: 'unknown', label: 'Not sure' }] },
      { id: 'topComplications', question: 'Were there any complications after the termination?', field: 'topComplications', type: 'yes_no', required: false, condition: d => d.topDone === true },
    ];

    case 'medical': {
      const sCount = parseInt(data.surgeryCount) || 0;
      const surgeryFields = Array.from({ length: sCount }, (_, i) => ({
        id: `surgery_${i}`, question: null, type: 'surgery_card', surgeryIdx: i, required: false, condition: d => d.surgeries === true
      }));

      return [
        { id: 'conditions',    question: 'Do you have or have you ever had any of these conditions?', field: 'conditions', type: 'multi', required: false,
          options: ['Hypertension', 'Epilepsy', 'Asthma', 'Diabetes', 'Peptic ulcer disease', 'None of these'] },
        { id: 'surgeries',     question: 'Have you had any past surgeries?',               field: 'surgeries',      type: 'yes_no',  required: false },
        { id: 'surgeryCount',  question: 'How many surgeries have you had in the past?',   field: 'surgeryCount',   type: 'number',  required: false, condition: d => d.surgeries === true, placeholder: 'e.g. 1', min: 1, max: 20 },
        ...surgeryFields,
        { id: 'pregMeds',      question: 'Which pregnancy medications are you taking?',    field: 'pregMeds',       type: 'multi',   required: false, options: ['Folic acid', 'Iron', 'Calcium', 'Routine antenatal drugs', 'None'] },
        { id: 'routineMedsCheck', question: 'Are you routinely taking any drugs aside your pregnancy medications?', field: 'routineMedsCheck', type: 'yes_no', required: false, hint: 'including medications for blood pressure' },
        { id: 'currentMeds',   question: 'Other routine medications',                      field: 'currentMeds',    type: 'text',    required: false, condition: d => d.routineMedsCheck === true, placeholder: 'e.g. Labetalol…' },
        { id: 'drugAllergy',   question: 'Do you have any drug allergies?',                field: 'drugAllergy',    type: 'yes_no',  required: false },
        { id: 'allergyDetails',question: 'What are you allergic to?',                      field: 'allergyDetails', type: 'text',    required: false, condition: d => d.drugAllergy === true, placeholder: 'e.g. Penicillin, Sulpha drugs…' },
      ];
    }

    case 'family_social': return [
      { id: 'husbandOccupation', question: "What is your husband or partner's occupation?", field: 'husbandOccupation', type: 'text', required: false, placeholder: 'e.g. Driver, Civil Servant, Farmer' },
      { id: 'husbandAge',    question: "How old is your husband or partner?",            field: 'husbandAge',     type: 'number',  required: false, placeholder: 'e.g. 34', min: 15, max: 90 },
      { id: 'husbandGenotype', question: "What is your husband or partner's genotype?", field: 'husbandGenotype', type: 'chips',  required: false,
        options: ['AA', 'AS', 'SS', 'AC', 'Unknown'] },
      { id: 'husbandBloodGroup', question: "What is your husband or partner's blood group?", field: 'husbandBloodGroup', type: 'chips', required: false,
        options: ['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−', 'Unknown'] },
      { id: 'patientSmokes', question: 'Do you smoke?',                                  field: 'patientSmokes',  type: 'yes_no',  required: false },
      { id: 'patientDrinks', question: 'Do you drink alcohol?',                           field: 'patientDrinks',  type: 'yes_no',  required: false },
      { id: 'husbandSmokes', question: 'Does your husband or partner smoke?',             field: 'husbandSmokes',  type: 'yes_no',  required: false },
      { id: 'husbandDrinks', question: 'Does your husband or partner drink alcohol?',     field: 'husbandDrinks',  type: 'yes_no',  required: false },
      { id: 'supportive',    question: 'Is your husband or partner supportive of this pregnancy?', field: 'supportive', type: 'yes_no', required: false },
    ];

    case 'systems': return [
      { id: 'neuro',         question: 'Do you have any of these symptoms?',              field: 'neuroSymptoms', type: 'multi', required: false,
        options: ['Headaches', 'Seizures / convulsions', 'Dizziness', 'Fainting episodes', 'None of these'] },
      { id: 'cardio',        question: 'Do you have any of these chest symptoms?',        field: 'cardioSymptoms', type: 'multi', required: false,
        options: ['Chest pain', 'Cough', 'Palpitations', 'Difficulty breathing', 'None of these'] },
      { id: 'urinary',       question: 'Have you noticed any changes in how often or how much you urinate?', field: 'urinaryChanges', type: 'yes_no', required: false },
      { id: 'bowel',         question: 'Have you noticed any changes in how frequently you use the toilet?', field: 'bowelChanges', type: 'yes_no', required: false },
      { id: 'pain',          question: 'Do you have pain anywhere in your body?',         field: 'hasPain',       type: 'yes_no',  required: false },
      { id: 'painLocation',  question: 'Where is the pain, and how would you describe it?', field: 'painDetails', type: 'text', required: false,
        condition: d => d.hasPain === true, placeholder: 'e.g. Lower abdomen, sharp, comes and goes' },
    ];

    default: return [];
  }
}

// ── Completion check ──────────────────────────────────────────────────────────
function sectionComplete(sectionId, data) {
  const slides = buildSlides(sectionId, data).filter(s => !s.condition || s.condition(data));
  const required = slides.filter(s => s.required);
  if (required.length === 0) {
    const answered = slides.filter(s => s.field && (data[s.field] !== '' && data[s.field] !== null && data[s.field] !== undefined));
    return answered.length >= Math.min(3, slides.length);
  }
  return required.every(s => s.field && data[s.field] !== '' && data[s.field] !== null && data[s.field] !== undefined);
}

// ── Initial data ──────────────────────────────────────────────────────────────
const INIT = {
  // Biodata
  name: '', age: '', occupation: '', marital: null,
  addrHouse: '', addrStreet: '', addrCity: '', addrState: '',
  religion: null, christianDenom: null, tribe: '',
  lmpKnown: null, lmpDate: '', lmpMonth: '', lmpYear: '',
  gravidity: '', parity: '', twins: null, childrenAlive: '',
  // Index pregnancy
  desired: null, conception: null,
  pregTestDone: null, pregTestType: null,
  scanDone: null, scanDate: '',
  bloodGroup: null, genotype: null,
  // Children (obstetric)
  children: [],
  // Gynae
  menarche: '', cycleLength: '', flowDays: '',
  dysmenorrhea: null, missedPeriod: null, heavyBleeding: null,
  intermenstrual: null, postcoital: null, dyspareunia: null,
  contraAware: null, contraUsed: null, contraType: null, contraStartDate: '', contraRemoved: null,
  papSmearAware: null, papSmearDone: null,
  topDone: null, topCount: '', topYear: '', topMethod: null, topComplications: null,
  // Medical
  conditions: [], surgeries: null, surgeryCount: '', surgeryDetails: [], pregMeds: [], routineMedsCheck: null, currentMeds: '', drugAllergy: null, allergyDetails: '',
  // Family & Social
  husbandOccupation: '', husbandAge: '', husbandGenotype: null, husbandBloodGroup: null,
  patientSmokes: null, patientDrinks: null, husbandSmokes: null, husbandDrinks: null, supportive: null,
  // Systems
  neuroSymptoms: [], cardioSymptoms: [], urinaryChanges: null, bowelChanges: null, hasPain: null, painDetails: '',
};

// ── Surgery card ──────────────────────────────────────────────────────────────
const SurgeryCard = ({ idx, surgery, onChange }) => {
  const ordinals = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];
  const label = ordinals[idx] || `${idx + 1}th`;
  const set = (field, val) => onChange(idx, field, val);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-primary">{label} surgery</h2>
      <div className="grid grid-cols-1 gap-3">
        <div>
          <Label>What surgery was done?</Label>
          <input type="text" value={surgery.type || ''} onChange={e => set('type', e.target.value)}
            placeholder="e.g. Appendectomy, C-section"
            className="w-full px-4 py-3 rounded-xl border-2 border-primary/20 bg-white text-slate-800 focus:ring-2 focus:ring-primary/50 outline-none" />
        </div>
        <div>
          <Label>When was it done?</Label>
          <input type="text" value={surgery.year || ''} onChange={e => set('year', e.target.value)}
            placeholder="e.g. 2021"
            className="w-full px-4 py-3 rounded-xl border-2 border-primary/20 bg-white text-slate-800 focus:ring-2 focus:ring-primary/50 outline-none" />
        </div>
      </div>
    </div>
  );
};

// ── Child card ────────────────────────────────────────────────────────────────
const ChildCard = ({ idx, child, onChange }) => {
  const ordinals = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];
  const label = ordinals[idx] || `${idx + 1}th`;
  const set = (field, val) => onChange(idx, field, val);

  const weight = parseFloat(child.birthWeight);
  const isMacro = !isNaN(weight) && weight >= 4;
  const csRisk = child.deliveryMode === 'cs';

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-primary">{label} child</h2>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Year of birth</Label>
          <input type="number" value={child.year || ''} onChange={e => set('year', e.target.value)}
            placeholder="e.g. 2020" min={1980} max={2026}
            className="w-full px-4 py-3 rounded-xl border-2 border-primary/20 bg-white text-slate-800 focus:ring-2 focus:ring-primary/50 outline-none" />
        </div>
        <div>
          <Label>Gender</Label>
          <div className="flex gap-2">
            {['Male', 'Female'].map(g => (
              <button key={g} onClick={() => set('gender', g.toLowerCase())}
                className={`flex-1 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                  child.gender === g.toLowerCase()
                    ? 'border-primary bg-primary text-white'
                    : 'border-primary/20 bg-white text-slate-700 hover:border-primary/50'
                }`}>{g}</button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <Label>Mode of delivery</Label>
        <div className="flex gap-2">
          {[{ v: 'vaginal', l: 'Vaginal delivery' }, { v: 'cs', l: 'Caesarean section (CS)' }].map(opt => (
            <button key={opt.v} onClick={() => set('deliveryMode', opt.v)}
              className={`flex-1 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                child.deliveryMode === opt.v
                  ? 'border-primary bg-primary text-white'
                  : 'border-primary/20 bg-white text-slate-700 hover:border-primary/50'
              }`}>{opt.l}</button>
          ))}
        </div>
        {csRisk && <p className="text-red-600 font-bold text-xs mt-1">⚠ CS delivery noted</p>}
      </div>

      <div>
        <Label>Did the baby cry well at birth?</Label>
        <div className="flex gap-2">
          {[{ v: true, l: 'Yes' }, { v: false, l: 'No / Delayed' }].map(opt => (
            <button key={String(opt.v)} onClick={() => set('criedWell', opt.v)}
              className={`flex-1 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                child.criedWell === opt.v
                  ? 'border-primary bg-primary text-white'
                  : 'border-primary/20 bg-white text-slate-700 hover:border-primary/50'
              }`}>{opt.l}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Birth weight (kg)</Label>
          <input type="number" step="0.1" value={child.birthWeight || ''} onChange={e => set('birthWeight', e.target.value)}
            placeholder="e.g. 3.2" min={0.5} max={7}
            className="w-full px-4 py-3 rounded-xl border-2 border-primary/20 bg-white text-slate-800 focus:ring-2 focus:ring-primary/50 outline-none" />
          {isMacro && <p className="text-red-600 font-bold text-xs mt-1">⚠ Macrosomic baby (≥ 4 kg) — high risk</p>}
        </div>
        <div>
          <Label>How many days did you spend in the hospital after your delivery?</Label>
          <input type="number" value={child.daysInHospital || ''} onChange={e => set('daysInHospital', e.target.value)}
            placeholder="e.g. 3" min={1} max={365}
            className="w-full px-4 py-3 rounded-xl border-2 border-primary/20 bg-white text-slate-800 focus:ring-2 focus:ring-primary/50 outline-none" />
        </div>
      </div>

      <div>
        <Label>State of child now</Label>
        <div className="grid grid-cols-2 gap-2">
          {[{ v: 'alive_well', l: 'Alive and well' }, { v: 'alive_unwell', l: 'Alive, health issues' }, { v: 'died_at_birth', l: 'Died at birth' }, { v: 'died_later', l: 'Died later' }].map(opt => (
            <button key={opt.v} onClick={() => set('stateNow', opt.v)}
              className={`py-3 px-2 rounded-xl border-2 text-xs font-semibold transition-all text-center ${
                child.stateNow === opt.v
                  ? 'border-primary bg-primary text-white'
                  : 'border-primary/20 bg-white text-slate-700 hover:border-primary/50'
              }`}>{opt.l}</button>
          ))}
        </div>
        {(child.stateNow === 'died_at_birth' || child.stateNow === 'died_later') &&
          <p className="text-red-600 font-bold text-xs mt-1">⚠ Bad obstetric history — flagged as high risk</p>}
      </div>

      <div>
        <Label>Any abnormalities in this child?</Label>
        <div className="flex gap-2">
          {[{ v: true, l: 'Yes' }, { v: false, l: 'No' }].map(opt => (
            <button key={String(opt.v)} onClick={() => set('anomaly', opt.v)}
              className={`flex-1 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                child.anomaly === opt.v
                  ? 'border-primary bg-primary text-white'
                  : 'border-primary/20 bg-white text-slate-700 hover:border-primary/50'
              }`}>{opt.l}</button>
          ))}
        </div>
        {child.anomaly && <p className="text-red-600 font-bold text-xs mt-1">⚠ Anomaly noted — flagged as high risk</p>}
      </div>

      <div>
        <Label>Did any of these happen during this pregnancy?</Label>
        <div className="flex flex-wrap gap-2">
          {[{id:'Diabetes', l:'High blood sugar'}, {id:'Hypertension', l:'High blood pressure (BP)'}, {id:'Malaria', l:'Malaria'}, {id:'Bleeding', l:'Bleeding'}, {id:'Anaemia', l:'Low blood levels (Anaemia)'}, {id:'None', l:'None'}].map(e => {
            const events = child.events || [];
            const active = events.includes(e.id);
            return (
              <button key={e.id} onClick={() => {
                if (e.id === 'None') set('events', active ? [] : ['None']);
                else {
                  const filtered = events.filter(x => x !== 'None');
                  set('events', active ? filtered.filter(x => x !== e.id) : [...filtered, e.id]);
                }
              }}
                className={`px-3 py-2 rounded-full border-2 text-xs font-semibold transition-all ${
                  active ? 'border-primary bg-primary text-white' : 'border-primary/20 bg-white text-slate-700 hover:border-primary/50'
                }`}>{e.l}</button>
            );
          })}
        </div>
      </div>

      <div>
        <Label>Did any issue arise immediately after delivery or within 6 months after delivery?</Label>
        <div className="flex gap-2 mb-4">
          {[{ v: true, l: 'Yes' }, { v: false, l: 'No' }].map(opt => (
            <button key={String(opt.v)} onClick={() => {
              set('hasPostnatalComplication', opt.v);
              if (!opt.v) {
                set('postnatalIssues', []);
                set('postnatalOther', '');
              }
            }}
              className={`flex-1 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                child.hasPostnatalComplication === opt.v
                  ? 'border-primary bg-primary text-white'
                  : 'border-primary/20 bg-white text-slate-700 hover:border-primary/50'
              }`}>{opt.l}</button>
          ))}
        </div>
        
        {child.hasPostnatalComplication && (
          <>
            <Label>What were the issues? (select all that apply)</Label>
            <div className="flex flex-wrap gap-2 mb-4">
              {['Excessive bleeding', 'Infection', 'High blood pressure', 'Depression / severe mood swings', 'Breast issues (mastitis)'].map(issue => {
                const issues = child.postnatalIssues || [];
                const active = issues.includes(issue);
                return (
                  <button key={issue} onClick={() => {
                    set('postnatalIssues', active ? issues.filter(x => x !== issue) : [...issues, issue]);
                  }}
                    className={`px-3 py-2 rounded-full border-2 text-xs font-semibold transition-all ${
                      active ? 'border-primary bg-primary text-white' : 'border-primary/20 bg-white text-slate-700 hover:border-primary/50'
                    }`}>{issue}</button>
                );
              })}
            </div>
            <Label>Other issues (if any)</Label>
            <input type="text" value={child.postnatalOther || ''} onChange={e => set('postnatalOther', e.target.value)}
              placeholder="e.g. Jaundice…"
              className="w-full px-4 py-3 rounded-xl border-2 border-primary/20 bg-white text-slate-800 focus:ring-2 focus:ring-primary/50 outline-none" />
          </>
        )}
      </div>
    </div>
  );
};

// ── Slide renderer ────────────────────────────────────────────────────────────
const SlideContent = ({ slide, data, set, setChild }) => {
  if (!slide) return null;
  const val = slide.field ? data[slide.field] : null;
  const risk = slide.riskCheck ? slide.riskCheck(val, data) : null;

  if (slide.type === 'text') return (
    <div className="space-y-3">
      <Field value={val} onChange={v => set(slide.field, v)} placeholder={slide.placeholder} hint={slide.hint} />
      {risk && <RiskBadge text={risk} />}
    </div>
  );

  if (slide.type === 'number') return (
    <div className="space-y-3">
      <Field value={val} onChange={v => set(slide.field, v)} type="number" placeholder={slide.placeholder} hint={slide.hint} min={slide.min} max={slide.max} />
      {risk && <RiskBadge text={risk} />}
    </div>
  );

  if (slide.type === 'date') return (
    <div className="space-y-3">
      <input type="date" value={val || ''} max={new Date().toISOString().split('T')[0]}
        onChange={e => set(slide.field, e.target.value)}
        className="w-full px-4 py-3 rounded-xl border-2 border-primary/20 bg-white text-slate-800 text-base focus:ring-2 focus:ring-primary/50 outline-none" />
      {slide.hint && <p className="text-xs text-slate-400">{slide.hint}</p>}
    </div>
  );

  if (slide.type === 'month_year') return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <Label>Month</Label>
        <select value={data.lmpMonth || ''} onChange={e => set('lmpMonth', e.target.value)}
          className="w-full px-4 py-3 rounded-xl border-2 border-primary/20 bg-white text-slate-800 focus:ring-2 focus:ring-primary/50 outline-none">
          <option value="">Select month</option>
          {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
            <option key={m} value={String(i + 1)}>{m}</option>
          ))}
        </select>
      </div>
      <div>
        <Label>Year</Label>
        <input type="number" value={data.lmpYear || ''} onChange={e => set('lmpYear', e.target.value)}
          placeholder="e.g. 2026" min={2020} max={2026}
          className="w-full px-4 py-3 rounded-xl border-2 border-primary/20 bg-white text-slate-800 focus:ring-2 focus:ring-primary/50 outline-none" />
      </div>
    </div>
  );

  if (slide.type === 'chips') return (
    <div className="space-y-3">
      <Chips options={slide.options} value={val} onChange={v => set(slide.field, v)} />
      {risk && <RiskBadge text={risk} />}
    </div>
  );

  if (slide.type === 'multi') return (
    <Chips options={slide.options} value={val || []} onChange={v => set(slide.field, v)} multi />
  );

  if (slide.type === 'yes_no') return (
    <div className="space-y-3">
      <YesNo value={val} onChange={v => set(slide.field, v)} />
      {risk && <RiskBadge text={risk} />}
    </div>
  );

  if (slide.type === 'address') return (
    <div className="space-y-3">
      <Field label="House / Flat number" value={data.addrHouse} onChange={v => set('addrHouse', v)} placeholder="e.g. 12B" />
      <Field label="Street name" value={data.addrStreet} onChange={v => set('addrStreet', v)} placeholder="e.g. Mission Road" />
      <Field label="City / Town" value={data.addrCity} onChange={v => set('addrCity', v)} placeholder="e.g. NATIONWIDE" />
      <Field label="State" value={data.addrState} onChange={v => set('addrState', v)} placeholder="e.g. Nationwide" />
    </div>
  );

  if (slide.type === 'gp_summary') {
    const gp = computeGP(data);
    if (!gp) return <p className="text-slate-400 text-center py-8">Fill in gravidity and parity above to see your G/P summary.</p>;
    return (
      <div className="bg-primary/5 border-2 border-primary/20 rounded-2xl p-8 text-center space-y-4">
        <p className="text-5xl font-bold text-primary tracking-wide">{gp}</p>
        <div className="text-sm text-slate-500 space-y-1">
          <p>G = Gravidity (total pregnancies)</p>
          <p>P = Parity (births after 24 weeks)</p>
          {(parseInt(data.gravidity) - parseInt(data.parity)) > 0 && <p>+{parseInt(data.gravidity) - parseInt(data.parity)} = pregnancy losses</p>}
          {data.childrenAlive !== '' && <p>({data.childrenAlive}A) = children alive</p>}
        </div>
      </div>
    );
  }

  if (slide.type === 'obs_none') return (
    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-8 text-center">
      <p className="text-4xl mb-4">🌱</p>
      <p className="text-primary font-semibold">This is your first delivery — no previous obstetric history to record.</p>
    </div>
  );

  if (slide.type === 'child_card') {
    const children = data.children || [];
    const child = children[slide.childIdx] || {};
    return <ChildCard idx={slide.childIdx} child={child} onChange={setChild} />;
  }

  if (slide.type === 'surgery_card') {
    const surgeries = data.surgeryDetails || [];
    const surgery = surgeries[slide.surgeryIdx] || {};
    return <SurgeryCard idx={slide.surgeryIdx} surgery={surgery} onChange={setSurgery} />;
  }

  return null;
};

// ── Main component ────────────────────────────────────────────────────────────
const IntakeQuestionnaire = () => {
  const navigate = useNavigate();
  const [view, setView] = useState('overview');
  const [secIdx, setSecIdx] = useState(0);
  const [slideIdx, setSlideIdx] = useState(0);
  const [data, setData] = useState(INIT);
  const [loading, setLoading] = useState(false);

  const set = (key, val) => setData(prev => ({ ...prev, [key]: val }));

  const setChild = (idx, field, val) => {
    setData(prev => {
      const parity = parseInt(prev.parity) || 0;
      const children = Array.from({ length: parity }, (_, i) => prev.children?.[i] || {});
      children[idx] = { ...(children[idx] || {}), [field]: val };
      return { ...prev, children };
    });
  };

  const setSurgery = (idx, field, val) => {
    setData(prev => {
      const count = parseInt(prev.surgeryCount) || 0;
      const surgeries = Array.from({ length: count }, (_, i) => prev.surgeryDetails?.[i] || {});
      surgeries[idx] = { ...(surgeries[idx] || {}), [field]: val };
      return { ...prev, surgeryDetails: surgeries };
    });
  };

  const risks = useMemo(() => computeRisks(data), [data]);
  const gp    = useMemo(() => computeGP(data), [data]);

  // Sync children array length when parity changes
  const parity = parseInt(data.parity) || 0;
  const ensuredChildren = Array.from({ length: parity }, (_, i) => data.children?.[i] || {});
  
  const ensuredSurgeries = Array.from({ length: parseInt(data.surgeryCount) || 0 }, (_, i) => data.surgeryDetails?.[i] || {});

  const getSlides = (sId) => {
    const all = buildSlides(sId, { ...data, children: ensuredChildren, surgeryDetails: ensuredSurgeries });
    return all.filter(s => !s.condition || s.condition(data));
  };

  const enterSection = (idx) => {
    setSecIdx(idx);
    setSlideIdx(0);
    setView('section');
  };

  const goNext = async () => {
    const slides = getSlides(SECTION_META[secIdx].id);
    if (slideIdx < slides.length - 1) {
      setSlideIdx(s => s + 1);
      window.scrollTo(0, 0);
    } else {
      // Section complete — save & return to overview
      await autoSave(secIdx);
      setView('overview');
      window.scrollTo(0, 0);
    }
  };

  const goBack = () => {
    if (slideIdx > 0) { setSlideIdx(s => s - 1); window.scrollTo(0, 0); }
    else { setView('overview'); window.scrollTo(0, 0); }
  };

  const autoSave = async (sIdx) => {
    const patientId = getPatientId();
    if (!patientId) return;
    const sId = SECTION_META[sIdx].id;
    try {
      if (sId === 'biodata') {
        await upsertProfile({
          name: data.name || undefined,
          age: Number(data.age) || undefined,
          occupation: data.occupation || undefined,
          marital_status: data.marital?.toLowerCase() || undefined,
          address: [data.addrHouse, data.addrStreet, data.addrCity, data.addrState].filter(Boolean).join(', ') || undefined,
          religion: data.religion?.toLowerCase() || undefined,
          ethnicity: data.tribe || undefined,
        }).catch(() => {});
      }
      if (sId === 'index') {
        const lmp = data.lmpKnown ? data.lmpDate : (data.lmpYear && data.lmpMonth ? `${data.lmpYear}-${String(data.lmpMonth).padStart(2, '0')}-01` : undefined);
        await addPregnancy({
          lmp_date: lmp ? new Date(lmp).toISOString() : undefined,
          blood_group: data.bloodGroup || undefined,
          genotype: data.genotype || undefined,
          gravidity: Number(data.gravidity) || undefined,
          parity: Number(data.parity) || undefined,
        }).catch(() => {});
      }
      const domainMap = {
        obstetric: 'obstetric', gynae: 'gynae', medical: 'medical',
        family_social: 'social', systems: 'symptoms',
      };
      if (domainMap[sId]) {
        const responses = buildDomainResponses(sId, data, ensuredChildren);
        if (responses.length) await saveIntake(patientId, domainMap[sId], responses).catch(() => {});
      }
    } catch (_) {}
  };

  const handleSubmit = async () => {
    setLoading(true);
    const patientId = getPatientId();
    if (patientId) {
      try {
        for (let i = 0; i < SECTION_META.length; i++) await autoSave(i);
        const { data: res } = await submitIntake(patientId);
        const tier = res?.risk_tier || res?.tier || res?.risk;
        if (tier) localStorage.setItem('mc_risk_tier', tier.toUpperCase());
      } catch (_) {}
    }
    setTimeout(() => navigate('/risk-result'), 2800);
  };

  const allDone = SECTION_META.every(s => sectionComplete(s.id, { ...data, children: ensuredChildren }));

  // ── Overview page ──────────────────────────────────────────────────────────
  if (view === 'overview') {
    return (
      <div className="min-h-screen bg-primary/5 font-body-md">
        <header className="bg-primary px-6 pt-10 pb-16">
          <div className="max-w-[640px] mx-auto">
            <button onClick={() => navigate(-1)} className="mb-6 flex items-center gap-2 text-primary-fixed/80 text-sm">
              ← Back
            </button>
            <h1 className="text-white text-3xl font-bold">Health Profile</h1>
            <p className="text-primary-fixed mt-1 text-sm">Fill in each section — tap any card to begin.</p>
            {gp && (
              <div className="mt-4 inline-block bg-white/20 text-white rounded-full px-4 py-1.5 text-sm font-semibold">
                {gp}
              </div>
            )}
          </div>
        </header>

        <main className="max-w-[640px] mx-auto px-4 -mt-8 pb-32">
          {/* Risk summary */}
          {risks.length > 0 && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-2xl p-4">
              <p className="text-red-700 font-bold text-sm mb-2">⚠ High-risk flags detected</p>
              <ul className="space-y-1">
                {risks.map((r, i) => (
                  <li key={i} className="text-red-600 font-bold text-xs">• {r.text}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Section cards */}
          <div className="space-y-3">
            {SECTION_META.map((s, i) => {
              const done = sectionComplete(s.id, { ...data, children: ensuredChildren });
              const slides = getSlides(s.id);
              const answered = slides.filter(sl => sl.field && data[sl.field] !== '' && data[sl.field] !== null && data[sl.field] !== undefined).length;
              const total = slides.filter(sl => sl.field).length;
              return (
                <button key={s.id} onClick={() => enterSection(i)}
                  className="w-full bg-white rounded-2xl p-5 flex items-center gap-4 shadow-sm border border-primary/10 hover:border-primary/30 hover:shadow-md transition-all text-left active:scale-[0.99]">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0 ${done ? 'bg-emerald-100' : 'bg-primary/10'}`}>
                    <span className="material-symbols-outlined text-2xl">{s.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-800">{s.label}</p>
                      {!done && (
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">INCOMPLETE</span>
                      )}
                    </div>
                    <p className="text-slate-400 text-xs mt-0.5">{s.desc}</p>
                    {total > 0 && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-primary/10 rounded-full overflow-hidden">
                          <div className="h-full bg-primary/50 rounded-full transition-all" style={{ width: `${Math.min(100, (answered / total) * 100)}%` }} />
                        </div>
                        <span className="text-[10px] text-slate-400">{answered}/{total}</span>
                      </div>
                    )}
                  </div>
                  {done ? (
                    <span className="text-emerald-500 text-xl flex-shrink-0">✓</span>
                  ) : (
                    <span className="text-primary/50 text-xl flex-shrink-0">›</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Submit */}
          <div className="mt-6">
            {allDone ? (
              <button onClick={handleSubmit}
                className="w-full py-5 bg-primary text-white font-bold text-lg rounded-2xl shadow-lg hover:bg-primary active:scale-95 transition-all">
                Submit & Get Risk Assessment
              </button>
            ) : (
              <div className="text-center">
                <p className="text-slate-400 text-sm mb-3">Complete all sections to submit</p>
                <button onClick={handleSubmit}
                  className="w-full py-4 bg-primary/20 text-primary font-bold rounded-2xl transition-all hover:bg-primary/30">
                  Submit anyway (partial)
                </button>
              </div>
            )}
          </div>
        </main>

        {loading && <LoadingOverlay />}
      </div>
    );
  }

  // ── Carousel section view ──────────────────────────────────────────────────
  const sec = SECTION_META[secIdx];
  const slides = getSlides(sec.id);
  const slide = slides[slideIdx];
  const progress = ((slideIdx + 1) / slides.length) * 100;
  const isLast = slideIdx === slides.length - 1;

  return (
    <div className="min-h-screen flex flex-col bg-white font-body-md">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-primary/10">
        <div className="max-w-[640px] mx-auto px-6 py-4 flex items-center gap-4">
          <button onClick={goBack} className="p-2 -ml-2 rounded-full hover:bg-primary/5 transition-colors">
            <span className="text-primary font-bold text-lg">←</span>
          </button>
          <div className="flex-1">
            <p className="text-primary font-bold text-sm">{sec.label}</p>
            <p className="text-slate-400 text-xs">{slideIdx + 1} of {slides.length}</p>
          </div>
          <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>{sec.icon}</span>
        </div>
        <div className="h-1 bg-primary/10">
          <div className="h-full bg-primary/50 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </header>

      {/* Slide */}
      <main className="flex-1 flex flex-col px-6 py-10 max-w-[640px] mx-auto w-full">
        {slide?.question && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-800 leading-snug">{slide.question}</h2>
            {slide.hint && <p className="text-slate-400 text-sm mt-2">{slide.hint}</p>}
          </div>
        )}
        {slide?.type === 'gp_summary' && (
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-800">Your obstetric summary</h2>
          </div>
        )}
        {slide?.type === 'obs_none' && (
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-800">Obstetric history</h2>
          </div>
        )}
        {slide?.type === 'child_card' && (
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-800">Tell us about each of your previous children</h2>
          </div>
        )}

        <SlideContent slide={slide} data={{ ...data, children: ensuredChildren }} set={set} setChild={setChild} />
      </main>

      {/* Footer nav */}
      <footer className="sticky bottom-0 bg-white border-t border-primary/10 px-6 py-4">
        <div className="max-w-[640px] mx-auto flex gap-3">
          <button onClick={goBack}
            className="flex-1 py-4 font-bold text-primary border-2 border-primary/20 rounded-2xl hover:bg-primary/5 transition-all active:scale-95">
            Back
          </button>
          <button onClick={goNext}
            className="flex-[2] py-4 font-bold text-white bg-primary rounded-2xl shadow-lg hover:bg-primary transition-all active:scale-95 flex items-center justify-center gap-2">
            {isLast ? `Finish ${sec.label}` : 'Next'}
            <span>→</span>
          </button>
        </div>
      </footer>

      {loading && <LoadingOverlay />}
    </div>
  );
};

// ── Domain response builder ───────────────────────────────────────────────────
function buildDomainResponses(sId, data, children) {
  switch (sId) {
    case 'obstetric': return (children || []).flatMap((c, i) => [
      { question_key: `child_${i}_year`,          answer: String(c.year || '') },
      { question_key: `child_${i}_gender`,         answer: c.gender || '' },
      { question_key: `child_${i}_delivery_mode`,  answer: c.deliveryMode || '' },
      { question_key: `child_${i}_cried_well`,     answer: c.criedWell ? 'yes' : 'no' },
      { question_key: `child_${i}_birth_weight`,   answer: String(c.birthWeight || '') },
      { question_key: `child_${i}_state_now`,      answer: c.stateNow || '' },
      { question_key: `child_${i}_anomaly`,        answer: c.anomaly ? 'yes' : 'no' },
      { question_key: `child_${i}_events`,         answer: (c.events || []).join(',') },
      { question_key: `child_${i}_postnatal_issues`, answer: c.hasPostnatalComplication ? [...(c.postnatalIssues || []), c.postnatalOther].filter(Boolean).join(', ') : 'no' },
    ]);
    case 'gynae': return [
      { question_key: 'menarche_age',    answer: data.menarche || '' },
      { question_key: 'cycle_days',      answer: data.cycleLength || '' },
      { question_key: 'flow_days',       answer: data.flowDays || '' },
      { question_key: 'dysmenorrhea',    answer: data.dysmenorrhea ? 'yes' : 'no' },
      { question_key: 'heavy_bleeding',  answer: data.heavyBleeding ? 'yes' : 'no' },
      { question_key: 'intermenstrual',  answer: data.intermenstrual ? 'yes' : 'no' },
      { question_key: 'postcoital',      answer: data.postcoital ? 'yes' : 'no' },
      { question_key: 'contraceptive',   answer: data.contraUsed ? 'yes' : 'no' },
      { question_key: 'contraceptive_type', answer: data.contraType || '' },
      { question_key: 'contraceptive_start_date', answer: data.contraStartDate || '' },
      { question_key: 'contraceptive_removed_before_pregnancy', answer: data.contraRemoved === true ? 'yes' : data.contraRemoved === false ? 'no' : '' },
      { question_key: 'pap_smear',       answer: data.papSmearDone ? 'yes' : 'no' },
      { question_key: 'top',             answer: data.topDone ? 'yes' : 'no' },
      { question_key: 'top_count',       answer: String(data.topCount || '') },
    ];
    case 'medical': return [
      ...(data.conditions || []).filter(c => c !== 'None of these').map(c => ({ question_key: c.toLowerCase().replace(/ /g, '_'), answer: 'yes' })),
      { question_key: 'surgery',          answer: data.surgeries ? 'yes' : 'no' },
      { question_key: 'surgery_count',    answer: String(data.surgeryCount || '') },
      ...(data.surgeryDetails || []).flatMap((s, i) => [
        { question_key: `surgery_${i}_type`, answer: s.type || '' },
        { question_key: `surgery_${i}_year`, answer: String(s.year || '') },
      ]),
      { question_key: 'pregnancy_medications', answer: (data.pregMeds || []).join(', ') },
      { question_key: 'routine_medications',   answer: data.routineMedsCheck ? 'yes' : 'no' },
      { question_key: 'other_medications',     answer: data.currentMeds || '' },
      { question_key: 'drug_allergy',     answer: data.drugAllergy ? 'yes' : 'no' },
      { question_key: 'allergy_details',  answer: data.allergyDetails || '' },
    ];
    case 'family_social': return [
      { question_key: 'husband_occupation',   answer: data.husbandOccupation || '' },
      { question_key: 'husband_age',          answer: String(data.husbandAge || '') },
      { question_key: 'husband_genotype',     answer: data.husbandGenotype || '' },
      { question_key: 'husband_blood_group',  answer: data.husbandBloodGroup || '' },
      { question_key: 'patient_smokes',       answer: data.patientSmokes ? 'yes' : 'no' },
      { question_key: 'patient_drinks',       answer: data.patientDrinks ? 'yes' : 'no' },
      { question_key: 'husband_smokes',       answer: data.husbandSmokes ? 'yes' : 'no' },
      { question_key: 'husband_drinks',       answer: data.husbandDrinks ? 'yes' : 'no' },
      { question_key: 'supportive',           answer: data.supportive ? 'yes' : 'no' },
    ];
    case 'systems': return [
      ...(data.neuroSymptoms || []).map(s => ({ question_key: s.toLowerCase().replace(/ \/ /g, '_').replace(/ /g, '_'), answer: 'yes' })),
      ...(data.cardioSymptoms || []).map(s => ({ question_key: s.toLowerCase().replace(/ /g, '_'), answer: 'yes' })),
      { question_key: 'urinary_changes',  answer: data.urinaryChanges ? 'yes' : 'no' },
      { question_key: 'bowel_changes',    answer: data.bowelChanges ? 'yes' : 'no' },
      { question_key: 'pain',             answer: data.hasPain ? 'yes' : 'no' },
      { question_key: 'pain_details',     answer: data.painDetails || '' },
    ];
    default: return [];
  }
}

// ── Loading overlay ───────────────────────────────────────────────────────────
const LoadingOverlay = () => (
  <div className="fixed inset-0 bg-primary/5/95 z-[100] flex flex-col items-center justify-center p-8">
    <div className="relative w-24 h-24 mb-8">
      <div className="absolute inset-0 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="material-symbols-outlined text-4xl text-primary">pregnant_woman</span>
      </div>
    </div>
    <h3 className="font-bold text-primary text-2xl">Calculating your risk…</h3>
    <p className="text-slate-500 text-center max-w-xs mt-3">Our clinical AI is reviewing your profile using WHO-validated guidelines.</p>
    <div className="mt-8 flex gap-2">
      {[0, 1, 2].map(i => (
        <div key={i} className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
  </div>
);

export default IntakeQuestionnaire;
