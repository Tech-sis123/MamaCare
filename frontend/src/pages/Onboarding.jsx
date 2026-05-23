import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

// ── Helpers ──────────────────────────────────────────────────────────────────

const calcEDD = (lmpStr) => {
  if (!lmpStr) return null;
  const d = new Date(lmpStr);
  d.setDate(d.getDate() + 280);
  return d;
};

const calcEGA = (lmpStr) => {
  if (!lmpStr) return null;
  const lmp = new Date(lmpStr);
  const today = new Date();
  const diffDays = Math.floor((today - lmp) / 86400000);
  if (diffDays < 0 || diffDays > 294) return null;
  return { weeks: Math.floor(diffDays / 7), days: diffDays % 7 };
};

const fmtDate = (d) =>
  d?.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) ?? '—';

// ── Step config ───────────────────────────────────────────────────────────────

const STEPS = [
  { id: 'biodata',   label: 'Biodata',      icon: 'person' },
  { id: 'pregnancy', label: 'Pregnancy',    icon: 'pregnant_woman' },
  { id: 'labs',      label: 'Booking Labs', icon: 'science' },
  { id: 'obstetric', label: 'Obs Hx',       icon: 'history' },
  { id: 'gynae',     label: 'Gynae Hx',     icon: 'female' },
  { id: 'symptoms',  label: 'Symptoms',     icon: 'medical_services' },
  { id: 'medical',   label: 'Medical Hx',   icon: 'medication' },
  { id: 'social',    label: 'Social',       icon: 'groups' },
];

const DANGER_SYMPTOMS = ['bleeding', 'blurred_vision', 'severe_headache', 'epigastric_pain', 'seizures'];

// ── Small shared UI pieces ────────────────────────────────────────────────────

const FieldLabel = ({ children }) => (
  <p className="font-label-sm text-on-surface-variant uppercase tracking-widest text-xs mb-2">{children}</p>
);

const TextInput = ({ label, value, onChange, placeholder, type = 'text', hint, max }) => (
  <div>
    {label && <FieldLabel>{label}</FieldLabel>}
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      max={max}
      className="w-full px-4 py-3 rounded-xl border-2 border-outline-variant bg-white text-on-surface font-body-md focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
    />
    {hint && <p className="mt-1.5 font-label-sm text-outline text-xs">{hint}</p>}
  </div>
);

const YesNo = ({ label, value, onChange, yesLabel = 'Yes', noLabel = 'No' }) => (
  <div>
    {label && <FieldLabel>{label}</FieldLabel>}
    <div className="flex gap-3">
      {[{ v: true, l: yesLabel }, { v: false, l: noLabel }].map(opt => (
        <button
          key={String(opt.v)}
          onClick={() => onChange(opt.v)}
          className={`flex-1 py-3 rounded-xl border-2 font-label-sm text-sm transition-all active:scale-95 ${
            value === opt.v
              ? 'border-primary bg-tertiary-fixed text-primary shadow-sm'
              : 'border-outline-variant bg-white text-on-surface hover:border-primary/30'
          }`}
        >
          {opt.l}
        </button>
      ))}
    </div>
  </div>
);

const Chips = ({ label, options, value, onChange }) => (
  <div>
    {label && <FieldLabel>{label}</FieldLabel>}
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const optVal = opt.value !== undefined ? opt.value : opt;
        const optLabel = opt.label !== undefined ? opt.label : opt;
        return (
          <button
            key={String(optVal)}
            onClick={() => onChange(optVal)}
            className={`px-4 py-2 rounded-full border-2 font-label-sm text-xs transition-all active:scale-95 ${
              value === optVal
                ? 'border-primary bg-primary text-white'
                : 'border-outline-variant bg-white text-on-surface hover:border-primary/40'
            }`}
          >
            {optLabel}
          </button>
        );
      })}
    </div>
  </div>
);

const WarnBanner = ({ text }) => (
  <div className="bg-secondary/10 border border-secondary/20 rounded-xl p-4 flex items-start gap-3">
    <span className="material-symbols-outlined text-secondary mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
    <p className="font-body-md text-secondary text-sm">{text}</p>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

const IntakeQuestionnaire = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showDangerBanner, setShowDangerBanner] = useState(false);

  const [answers, setAnswers] = useState({
    // Biodata
    name: '', age: '', education: '', occupation: '',
    marital: '', state: '', religion: '', ethnicity: '',
    // Index Pregnancy / LMP
    lmp: '', desired: null, conception: null,
    ultrasound: null, ultrasoundDate: '',
    bookingWeight: '', bookingHeight: '',
    // Booking Labs
    bloodType: null, genotype: null,
    bpSystolic: '', bpDiastolic: '',
    urinalysis: null, hiv: null, vdrl: null,
    pcv: '', hepB: null, tetanus: null,
    // Obstetric History
    gravida: null, para: null,
    lastBirthYear: '', twins: null, miscarriage: null,
    // Gynae History
    menarche: '', cycleDays: '', flowDays: '',
    heavyBleeding: null, dysmenorrhea: null,
    intermenstrual: null, postcoital: null, discharge: null,
    contraceptiveAware: null, contraceptiveUsed: null, contraceptiveType: '',
    papSmearAware: null, papSmearDone: null,
    // Symptoms
    symptoms: [],
    // Medical / Surgical / Allergies
    conditions: [],
    otherConditions: '', medications: '',
    bloodTransfusion: null,
    surgery: null, surgeryDetails: '',
    drugAllergies: '', foodAllergies: '',
    // Family & Social
    married: null, polygamous: null,
    patientSmokes: null, patientDrinks: null,
    husbandOccupation: '',
    husbandSmokes: null, husbandDrinks: null,
  });

  const set = (key, val) => setAnswers(prev => ({ ...prev, [key]: val }));

  const toggleMulti = (key, val) => {
    setAnswers(prev => {
      const arr = prev[key] || [];
      if (val === 'none') return { ...prev, [key]: ['none'] };
      const filtered = arr.filter(v => v !== 'none');
      const next = filtered.includes(val) ? filtered.filter(v => v !== val) : [...filtered, val];
      if (key === 'symptoms') {
        setShowDangerBanner(next.some(v => DANGER_SYMPTOMS.includes(v)));
      }
      return { ...prev, [key]: next };
    });
  };

  const edd = useMemo(() => calcEDD(answers.lmp), [answers.lmp]);
  const ega = useMemo(() => calcEGA(answers.lmp), [answers.lmp]);

  const aiSummary = useMemo(() => {
    const name = answers.name || 'Patient';
    const age = answers.age ? `${answers.age}-year-old` : '';
    const g = answers.gravida ?? '?';
    const p = answers.para ?? '?';
    const egaStr = ega ? `${ega.weeks} weeks ${ega.days} days` : 'unknown gestation';
    const riskSymptoms = answers.symptoms.filter(s => DANGER_SYMPTOMS.includes(s));
    const complaints = riskSymptoms.length
      ? `Presenting complaints include: ${riskSymptoms.map(s => s.replace(/_/g, ' ')).join(', ')}.`
      : 'No acute presenting complaints reported.';
    const bpVal = answers.bpSystolic && answers.bpDiastolic
      ? `Booking BP: ${answers.bpSystolic}/${answers.bpDiastolic} mmHg.` : '';
    const flags = [];
    if (answers.hiv === 'reactive') flags.push('HIV reactive — PMTCT pathway flagged');
    if (answers.genotype === 'SS') flags.push('sickle cell disease');
    if (answers.conditions.includes('hypertension')) flags.push('known hypertension');
    if (answers.conditions.includes('diabetes')) flags.push('known diabetes');
    if (parseInt(answers.pcv) < 30 && answers.pcv) flags.push('anaemia (PCV < 30%)');
    const flagStr = flags.length ? ` Notable: ${flags.join(', ')}.` : '';
    return `${name}, ${age} G${g}P${p}, presenting at ${egaStr} gestation. ${complaints} ${bpVal}${flagStr}`.trim();
  }, [answers, ega]);

  const canProceed = () => {
    if (step === 0) return answers.name.trim().length > 0;
    if (step === 1) return !!answers.lmp;
    if (step === 2) return !!(answers.bloodType && answers.genotype);
    if (step === 3) return answers.gravida !== null && answers.para !== null;
    return true;
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
      setShowDangerBanner(false);
      window.scrollTo(0, 0);
    } else {
      setLoading(true);
      setTimeout(() => navigate('/risk-result'), 2800);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(s => s - 1);
      setShowDangerBanner(false);
    } else {
      navigate(-1);
    }
    window.scrollTo(0, 0);
  };

  // ── Step renderers ─────────────────────────────────────────────────────────

  const renderBiodata = () => (
    <div className="space-y-5 animate-fade-in">
      <div>
        <p className="font-label-sm text-primary uppercase tracking-[0.2em] mb-3">Step 1 of 8 · Biodata</p>
        <h2 className="font-headline-lg text-primary text-2xl md:text-3xl leading-snug">
          Let's start with your basic details.
        </h2>
        <p className="font-body-md text-on-surface-variant mt-2">
          This creates your personal care record.
        </p>
      </div>

      <div className="sm:col-span-2">
        <TextInput label="Full Name *" value={answers.name} onChange={v => set('name', v)} placeholder="e.g. Blessing Efe" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <TextInput label="Age" value={answers.age} onChange={v => set('age', v)} placeholder="e.g. 27" type="number" />
        <TextInput label="Occupation" value={answers.occupation} onChange={v => set('occupation', v)} placeholder="e.g. Trader" />
      </div>

      <Chips label="Level of Education"
        value={answers.education} onChange={v => set('education', v)}
        options={['Primary', 'Secondary', 'Tertiary', 'None']} />

      <Chips label="Marital Status"
        value={answers.marital} onChange={v => set('marital', v)}
        options={['Single', 'Married', 'Widowed', 'Divorced']} />

      <div className="grid grid-cols-2 gap-4">
        <TextInput label="State / LGA" value={answers.state} onChange={v => set('state', v)} placeholder="e.g. Benin City, Edo" />
        <TextInput label="Ethnicity" value={answers.ethnicity} onChange={v => set('ethnicity', v)} placeholder="e.g. Yoruba, Edo…" />
      </div>

      <Chips label="Religion"
        value={answers.religion} onChange={v => set('religion', v)}
        options={['Christian', 'Muslim', 'Traditional', 'Other']} />
    </div>
  );

  const renderPregnancy = () => (
    <div className="space-y-6 animate-fade-in">
      <div>
        <p className="font-label-sm text-primary uppercase tracking-[0.2em] mb-3">Step 2 of 8 · Index Pregnancy</p>
        <h2 className="font-headline-lg text-primary text-2xl leading-snug">
          Tell us about this pregnancy.
        </h2>
      </div>

      <div>
        <FieldLabel>Last Menstrual Period (LMP) *</FieldLabel>
        <input
          type="date"
          value={answers.lmp}
          max={new Date().toISOString().split('T')[0]}
          onChange={e => set('lmp', e.target.value)}
          className="w-full px-4 py-3 rounded-xl border-2 border-outline-variant bg-white text-on-surface font-body-md focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
        />
        {edd && ega && (
          <div className="mt-3 bg-primary/5 border border-primary/15 rounded-xl p-4 grid grid-cols-2 gap-4">
            <div>
              <p className="font-label-sm text-on-surface-variant text-xs uppercase">Estimated Due Date</p>
              <p className="font-headline-md text-primary mt-1">{fmtDate(edd)}</p>
            </div>
            <div>
              <p className="font-label-sm text-on-surface-variant text-xs uppercase">Gestational Age</p>
              <p className="font-headline-md text-primary mt-1">{ega.weeks}w {ega.days}d</p>
            </div>
          </div>
        )}
      </div>

      <YesNo label="Was this pregnancy desired?" value={answers.desired} onChange={v => set('desired', v)} />

      <Chips label="How was it conceived?"
        value={answers.conception} onChange={v => set('conception', v)}
        options={[{ value: 'natural', label: 'Natural' }, { value: 'assisted', label: 'Assisted (IVF / IUI)' }]} />

      <YesNo label="Confirmed by ultrasound?" value={answers.ultrasound} onChange={v => set('ultrasound', v)} />
      {answers.ultrasound && (
        <TextInput label="Date of ultrasound confirmation" value={answers.ultrasoundDate}
          onChange={v => set('ultrasoundDate', v)} type="date"
          max={new Date().toISOString().split('T')[0]} />
      )}

      <div className="grid grid-cols-2 gap-4">
        <TextInput label="Booking Weight (kg)" value={answers.bookingWeight}
          onChange={v => set('bookingWeight', v)} placeholder="e.g. 62" type="number" />
        <TextInput label="Booking Height (cm)" value={answers.bookingHeight}
          onChange={v => set('bookingHeight', v)} placeholder="e.g. 165" type="number" />
      </div>
    </div>
  );

  const renderLabs = () => {
    const bpHigh = (parseInt(answers.bpSystolic) >= 140 || parseInt(answers.bpDiastolic) >= 90)
      && answers.bpSystolic && answers.bpDiastolic;
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <p className="font-label-sm text-primary uppercase tracking-[0.2em] mb-3">Step 3 of 8 · Booking Labs</p>
          <h2 className="font-headline-lg text-primary text-2xl leading-snug">
            Booking investigations & vitals.
          </h2>
        </div>

        <div>
          <FieldLabel>Blood Group *</FieldLabel>
          <div className="grid grid-cols-4 gap-2">
            {['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−'].map(bt => (
              <button key={bt} onClick={() => set('bloodType', bt)}
                className={`py-3 rounded-xl border-2 font-headline-md text-base transition-all active:scale-95 ${
                  answers.bloodType === bt
                    ? 'border-primary bg-tertiary-fixed text-primary shadow-sm'
                    : 'border-outline-variant bg-white text-on-surface hover:border-primary/40'
                }`}
              >{bt}</button>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel>Genotype *</FieldLabel>
          <div className="grid grid-cols-4 gap-2">
            {['AA', 'AS', 'SS', 'AC'].map(g => (
              <button key={g} onClick={() => set('genotype', g)}
                className={`py-4 rounded-xl border-2 font-headline-md text-xl transition-all active:scale-95 ${
                  answers.genotype === g
                    ? 'border-primary bg-tertiary-fixed text-primary shadow-sm'
                    : 'border-outline-variant bg-white text-on-surface hover:border-primary/40'
                }`}
              >{g}</button>
            ))}
          </div>
          {answers.genotype === 'SS' && (
            <div className="mt-3">
              <WarnBanner text="Sickle cell disease — will be flagged for closer monitoring." />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <TextInput label="BP Systolic (mmHg)" value={answers.bpSystolic}
            onChange={v => set('bpSystolic', v)} placeholder="e.g. 120" type="number" />
          <TextInput label="BP Diastolic (mmHg)" value={answers.bpDiastolic}
            onChange={v => set('bpDiastolic', v)} placeholder="e.g. 80" type="number" />
        </div>
        {bpHigh && <WarnBanner text="Elevated blood pressure detected. A high-risk flag will be raised." />}

        <Chips label="Urinalysis"
          value={answers.urinalysis} onChange={v => set('urinalysis', v)}
          options={[
            { value: 'normal', label: 'Normal' },
            { value: 'protein+', label: 'Protein +' },
            { value: 'protein++', label: 'Protein ++' },
            { value: 'glucose+', label: 'Glucose +' },
          ]} />

        <Chips label="HIV Status (RVD)"
          value={answers.hiv} onChange={v => set('hiv', v)}
          options={[
            { value: 'non_reactive', label: 'Non-Reactive' },
            { value: 'reactive', label: 'Reactive' },
            { value: 'unknown', label: 'Unknown' },
            { value: 'declined', label: 'Declined' },
          ]} />
        {answers.hiv === 'reactive' && (
          <WarnBanner text="HIV reactive — PMTCT (Prevention of Mother-to-Child Transmission) pathway flagged." />
        )}

        <Chips label="VDRL (Syphilis Screen)"
          value={answers.vdrl} onChange={v => set('vdrl', v)}
          options={[
            { value: 'non_reactive', label: 'Non-Reactive' },
            { value: 'reactive', label: 'Reactive' },
            { value: 'unknown', label: 'Unknown' },
          ]} />

        <div className="grid grid-cols-2 gap-4">
          <TextInput label="PCV (%)" value={answers.pcv}
            onChange={v => set('pcv', v)} placeholder="e.g. 33" type="number"
            hint="Anaemia flagged if < 30%" />
          <div>
            <FieldLabel>Hepatitis B</FieldLabel>
            <div className="flex gap-2">
              {['Negative', 'Positive', 'Unknown'].map(v => (
                <button key={v} onClick={() => set('hepB', v)}
                  className={`flex-1 py-3 rounded-xl border-2 font-label-sm text-xs transition-all active:scale-95 ${
                    answers.hepB === v ? 'border-primary bg-tertiary-fixed text-primary' : 'border-outline-variant bg-white text-on-surface hover:border-primary/30'
                  }`}
                >{v}</button>
              ))}
            </div>
          </div>
        </div>

        <Chips label="Tetanus Immunisation"
          value={answers.tetanus} onChange={v => set('tetanus', v)}
          options={[
            { value: 'up_to_date', label: 'Up to date' },
            { value: 'incomplete', label: 'Incomplete' },
            { value: 'none', label: 'None' },
            { value: 'unknown', label: 'Unknown' },
          ]} />
      </div>
    );
  };

  const renderObstetric = () => (
    <div className="space-y-6 animate-fade-in">
      <div>
        <p className="font-label-sm text-primary uppercase tracking-[0.2em] mb-3">Step 4 of 8 · Obstetric History</p>
        <h2 className="font-headline-lg text-primary text-2xl leading-snug">
          Your pregnancy history.
        </h2>
      </div>

      <div>
        <FieldLabel>Total times pregnant (including now) *</FieldLabel>
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, '5+'].map(v => (
            <button key={v} onClick={() => set('gravida', v)}
              className={`py-4 rounded-xl border-2 font-headline-md text-xl transition-all active:scale-95 ${
                answers.gravida === v
                  ? 'border-primary bg-tertiary-fixed text-primary shadow-sm'
                  : 'border-outline-variant bg-white text-on-surface hover:border-primary/40'
              }`}
            >{v}</button>
          ))}
        </div>
      </div>

      <div>
        <FieldLabel>Births after 24 weeks (Para) *</FieldLabel>
        <div className="grid grid-cols-5 gap-2">
          {[0, 1, 2, 3, '4+'].map(v => (
            <button key={v} onClick={() => set('para', v)}
              className={`py-4 rounded-xl border-2 font-headline-md text-xl transition-all active:scale-95 ${
                answers.para === v
                  ? 'border-primary bg-tertiary-fixed text-primary shadow-sm'
                  : 'border-outline-variant bg-white text-on-surface hover:border-primary/40'
              }`}
            >{v}</button>
          ))}
        </div>
      </div>

      {(answers.para !== null && answers.para !== 0) && (
        <TextInput label="Year of last delivery" value={answers.lastBirthYear}
          onChange={v => set('lastBirthYear', v)} placeholder="e.g. 2022" type="number" />
      )}

      <YesNo label="Any twin or multiple delivery?" value={answers.twins} onChange={v => set('twins', v)} />
      <YesNo label="Any previous miscarriage or termination?" value={answers.miscarriage} onChange={v => set('miscarriage', v)} />
    </div>
  );

  const renderGynae = () => (
    <div className="space-y-5 animate-fade-in">
      <div>
        <p className="font-label-sm text-primary uppercase tracking-[0.2em] mb-3">Step 5 of 8 · Gynaecological History</p>
        <h2 className="font-headline-lg text-primary text-2xl leading-snug">
          Menstrual & gynaecological history.
        </h2>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <TextInput label="Age at first period" value={answers.menarche}
          onChange={v => set('menarche', v)} placeholder="e.g. 13" type="number" />
        <TextInput label="Flow duration (days)" value={answers.flowDays}
          onChange={v => set('flowDays', v)} placeholder="e.g. 5" type="number" />
        <TextInput label="Cycle length (days)" value={answers.cycleDays}
          onChange={v => set('cycleDays', v)} placeholder="e.g. 28" type="number" />
      </div>

      <div className="space-y-4">
        <YesNo label="Heavy menstrual bleeding?" value={answers.heavyBleeding} onChange={v => set('heavyBleeding', v)} />
        <YesNo label="Painful periods (dysmenorrhea)?" value={answers.dysmenorrhea} onChange={v => set('dysmenorrhea', v)} />
        <YesNo label="Bleeding between periods?" value={answers.intermenstrual} onChange={v => set('intermenstrual', v)} />
        <YesNo label="Bleeding after sex (postcoital)?" value={answers.postcoital} onChange={v => set('postcoital', v)} />
        <YesNo label="Abnormal vaginal discharge?" value={answers.discharge} onChange={v => set('discharge', v)} />
      </div>

      <div className="space-y-4 pt-4 border-t border-outline-variant/20">
        <YesNo label="Aware of contraceptives?" value={answers.contraceptiveAware} onChange={v => set('contraceptiveAware', v)} />
        {answers.contraceptiveAware && (
          <YesNo label="Have you ever used a contraceptive?" value={answers.contraceptiveUsed} onChange={v => set('contraceptiveUsed', v)} />
        )}
        {answers.contraceptiveUsed && (
          <Chips label="Which type?"
            value={answers.contraceptiveType} onChange={v => set('contraceptiveType', v)}
            options={[
              { value: 'pill', label: 'Pill' },
              { value: 'injection', label: 'Injection' },
              { value: 'implant', label: 'Implant' },
              { value: 'iud', label: 'IUD' },
              { value: 'condom', label: 'Condom' },
              { value: 'other', label: 'Other' },
            ]} />
        )}
      </div>

      <div className="space-y-4 pt-4 border-t border-outline-variant/20">
        <YesNo label="Aware of cervical smear (Pap Smear)?" value={answers.papSmearAware} onChange={v => set('papSmearAware', v)} />
        {answers.papSmearAware && (
          <YesNo label="Have you had a pap smear done?" value={answers.papSmearDone} onChange={v => set('papSmearDone', v)} />
        )}
      </div>
    </div>
  );

  const SYMPTOM_LIST = [
    { id: 'nausea',          emoji: '🤢', label: 'Nausea / Vomiting',      risk: 'low' },
    { id: 'fatigue',         emoji: '😴', label: 'Fatigue',                 risk: 'low' },
    { id: 'severe_headache', emoji: '😫', label: 'Severe Headache',         risk: 'high' },
    { id: 'swelling',        emoji: '🦶', label: 'Swollen Hands / Face',    risk: 'medium' },
    { id: 'bleeding',        emoji: '🩸', label: 'Spotting / Bleeding',     risk: 'high' },
    { id: 'blurred_vision',  emoji: '👁️', label: 'Blurred Vision',          risk: 'high' },
    { id: 'back_pain',       emoji: '⚡', label: 'Back Pain',                risk: 'low' },
    { id: 'epigastric_pain', emoji: '🔥', label: 'Epigastric Pain',         risk: 'high' },
    { id: 'reduced_fetal',   emoji: '👶', label: 'Reduced Fetal Movement',  risk: 'medium' },
    { id: 'seizures',        emoji: '⚠️', label: 'Seizures / Fits',         risk: 'high' },
    { id: 'none',            emoji: '✅', label: 'None of these',            risk: 'none' },
  ];

  const renderSymptoms = () => (
    <div className="space-y-6 animate-fade-in">
      <div>
        <p className="font-label-sm text-primary uppercase tracking-[0.2em] mb-3">Step 6 of 8 · Presenting Symptoms</p>
        <h2 className="font-headline-lg text-primary text-2xl leading-snug">
          Are you experiencing any of these right now?
        </h2>
        <p className="font-body-md text-on-surface-variant mt-2">Select all that apply.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {SYMPTOM_LIST.map(s => {
          const selected = answers.symptoms.includes(s.id);
          return (
            <button key={s.id} onClick={() => toggleMulti('symptoms', s.id)}
              className={`flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 transition-all active:scale-95 text-center ${
                selected
                  ? s.risk === 'high' ? 'border-secondary bg-secondary/10 shadow-sm' : 'border-primary bg-tertiary-fixed shadow-sm'
                  : 'border-outline-variant bg-white hover:border-primary/30'
              }`}
            >
              <span className="text-3xl">{s.emoji}</span>
              <span className={`font-label-sm text-xs ${selected && s.risk === 'high' ? 'text-secondary font-bold' : 'text-on-surface'}`}>
                {s.label}
              </span>
              {selected && s.risk === 'high' && (
                <span className="font-label-sm text-[10px] bg-secondary/20 text-secondary px-2 py-0.5 rounded-full">
                  HIGH RISK
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  const CONDITION_LIST = [
    { id: 'hypertension', icon: 'blood_pressure', label: 'Hypertension' },
    { id: 'epilepsy',     icon: 'neurology',       label: 'Epilepsy' },
    { id: 'asthma',       icon: 'air',             label: 'Asthma' },
    { id: 'diabetes',     icon: 'glucose',         label: 'Diabetes' },
    { id: 'sickle_cell',  icon: 'vaccines',        label: 'Sickle Cell Disease' },
    { id: 'none',         icon: 'check_circle',    label: 'None of these' },
  ];

  const renderMedical = () => (
    <div className="space-y-6 animate-fade-in">
      <div>
        <p className="font-label-sm text-primary uppercase tracking-[0.2em] mb-3">Step 7 of 8 · Medical History</p>
        <h2 className="font-headline-lg text-primary text-2xl leading-snug">
          Past medical & surgical history.
        </h2>
      </div>

      <div>
        <FieldLabel>Past medical conditions (select all that apply)</FieldLabel>
        <div className="space-y-2">
          {CONDITION_LIST.map(c => {
            const selected = answers.conditions.includes(c.id);
            return (
              <button key={c.id} onClick={() => toggleMulti('conditions', c.id)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left active:scale-[0.99] ${
                  selected ? 'border-primary bg-tertiary-fixed shadow-sm' : 'border-outline-variant bg-white hover:border-primary/30'
                }`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                  selected ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant'
                }`}>
                  <span className="material-symbols-outlined text-sm" style={selected ? { fontVariationSettings: "'FILL' 1" } : {}}>
                    {selected ? 'check' : c.icon}
                  </span>
                </div>
                <span className="font-body-md font-medium">{c.label}</span>
                {selected && (
                  <span className="ml-auto material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                    check_circle
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <TextInput label="Other conditions (describe)" value={answers.otherConditions}
        onChange={v => set('otherConditions', v)} placeholder="Any other condition not listed above…" />
      <TextInput label="Current medications" value={answers.medications}
        onChange={v => set('medications', v)} placeholder="e.g. Folic acid, Ferrous sulfate, Labetalol…" />
      <YesNo label="History of blood transfusion?" value={answers.bloodTransfusion} onChange={v => set('bloodTransfusion', v)} />

      <div className="pt-4 border-t border-outline-variant/20 space-y-4">
        <YesNo label="Any previous surgeries?" value={answers.surgery} onChange={v => set('surgery', v)} />
        {answers.surgery && (
          <TextInput label="Surgery details (type & year)" value={answers.surgeryDetails}
            onChange={v => set('surgeryDetails', v)} placeholder="e.g. Appendectomy 2019, C-section 2021" />
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-outline-variant/20">
        <TextInput label="Drug allergies" value={answers.drugAllergies}
          onChange={v => set('drugAllergies', v)} placeholder="e.g. Penicillin" />
        <TextInput label="Food allergies" value={answers.foodAllergies}
          onChange={v => set('foodAllergies', v)} placeholder="e.g. Shellfish" />
      </div>
    </div>
  );

  const renderSocial = () => (
    <div className="space-y-5 animate-fade-in">
      <div>
        <p className="font-label-sm text-primary uppercase tracking-[0.2em] mb-3">Step 8 of 8 · Family & Social</p>
        <h2 className="font-headline-lg text-primary text-2xl leading-snug">
          A little about your home life.
        </h2>
        <p className="font-body-md text-on-surface-variant mt-2">
          This helps us support your full wellbeing.
        </p>
      </div>

      <YesNo label="Are you currently married?" value={answers.married} onChange={v => set('married', v)} />
      {answers.married && (
        <Chips label="Marriage type"
          value={answers.polygamous} onChange={v => set('polygamous', v)}
          options={[{ value: false, label: 'Monogamous' }, { value: true, label: 'Polygamous' }]} />
      )}

      <div className="space-y-4 pt-4 border-t border-outline-variant/20">
        <YesNo label="Do you smoke?" value={answers.patientSmokes} onChange={v => set('patientSmokes', v)} />
        <YesNo label="Do you drink alcohol?" value={answers.patientDrinks} onChange={v => set('patientDrinks', v)} />
      </div>

      <div className="space-y-4 pt-4 border-t border-outline-variant/20">
        <TextInput label="Husband / Partner occupation" value={answers.husbandOccupation}
          onChange={v => set('husbandOccupation', v)} placeholder="e.g. Trader, Civil Servant…" />
        <YesNo label="Does your partner smoke?" value={answers.husbandSmokes} onChange={v => set('husbandSmokes', v)} />
        <YesNo label="Does your partner drink alcohol?" value={answers.husbandDrinks} onChange={v => set('husbandDrinks', v)} />
      </div>

      {/* AI Pre-Consult Summary Preview */}
      <div className="mt-2 bg-[#1A1A18] text-white rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-amber-400" style={{ fontVariationSettings: "'FILL' 1" }}>
            smart_toy
          </span>
          <p className="font-label-sm text-amber-400 uppercase tracking-widest text-xs">AI Pre-Consult Summary</p>
        </div>
        <p className="font-body-md text-white/85 leading-relaxed text-sm">{aiSummary}</p>
        <p className="mt-3 font-label-sm text-white/40 text-xs">
          This summary will be shared with your doctor before your appointment.
        </p>
      </div>
    </div>
  );

  const STEP_RENDERERS = [
    renderBiodata,
    renderPregnancy,
    renderLabs,
    renderObstetric,
    renderGynae,
    renderSymptoms,
    renderMedical,
    renderSocial,
  ];

  // ── Loading overlay ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="fixed inset-0 bg-surface-container-low z-[100] flex flex-col items-center justify-center p-8">
        <div className="relative w-24 h-24 mb-8">
          <div className="absolute inset-0 border-4 border-primary-fixed border-t-primary-container rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary-container text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              pregnant_woman
            </span>
          </div>
        </div>
        <h3 className="font-headline-md text-primary text-2xl">Calculating your risk…</h3>
        <p className="font-body-md text-on-surface-variant text-center max-w-xs mt-3">
          Our clinical AI is reviewing your profile using WHO-validated guidelines.
        </p>
        <div className="mt-8 flex gap-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2 h-2 bg-primary rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col font-body-md text-on-surface">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-stone-50/90 backdrop-blur-md border-b border-primary/5">
        <div className="max-w-[640px] mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button onClick={handleBack} className="p-2 -ml-2 hover:bg-surface-container-high rounded-full transition-colors">
              <span className="material-symbols-outlined text-primary">arrow_back</span>
            </button>
            <div>
              <h1 className="font-headline-md text-primary text-lg">Health Profile</h1>
              <span className="flex items-center gap-1 font-label-sm text-primary/50 text-xs">
                <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                Auto-saved
              </span>
            </div>
          </div>
          <button className="px-3 py-1.5 rounded-full border border-primary/20 font-label-sm text-xs text-primary hover:bg-primary/5 transition-all">
            EN | Pidgin
          </button>
        </div>

        {/* Progress bar + step pills */}
        <div className="w-full bg-surface-container-low">
          <div className="h-0.5 bg-surface-container-highest">
            <div
              className="h-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
          <div className="max-w-[640px] mx-auto px-4 py-3 overflow-x-auto whitespace-nowrap scrollbar-hide flex gap-2">
            {STEPS.map((s, idx) => (
              <div key={s.id}
                className={`inline-flex items-center px-3 py-1 rounded-full font-label-sm border text-xs transition-all ${
                  idx === step
                    ? 'bg-primary text-white shadow-sm border-transparent'
                    : idx < step
                    ? 'bg-primary/10 text-primary border-primary/20'
                    : 'bg-white text-on-surface-variant border-outline-variant'
                }`}
              >
                <span
                  className="material-symbols-outlined text-[14px] mr-1"
                  style={idx <= step ? { fontVariationSettings: "'FILL' 1" } : {}}
                >
                  {idx < step ? 'check_circle' : s.icon}
                </span>
                {s.label}
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-grow flex flex-col items-center px-6 py-10 md:py-16">
        <div className="w-full max-w-[520px]">
          {STEP_RENDERERS[step]()}
        </div>
      </main>

      {/* Sticky footer */}
      <footer className="sticky bottom-0 w-full bg-white/95 backdrop-blur-xl border-t border-primary/5 p-4 md:p-6">
        <div className="max-w-[520px] mx-auto w-full space-y-3">
          {showDangerBanner && (
            <div className="bg-secondary text-white px-5 py-4 rounded-xl flex items-center gap-4 animate-slide-up">
              <span className="material-symbols-outlined flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
              <div className="flex-grow">
                <p className="font-bold font-body-md text-sm">Urgent symptom detected</p>
                <p className="font-label-sm text-xs opacity-90 mt-0.5">We will flag this for your nurse immediately.</p>
              </div>
              <button onClick={() => setShowDangerBanner(false)} className="p-1 hover:bg-white/10 rounded-full">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleBack}
              className="flex-1 py-4 font-bold text-primary border-2 border-primary/15 rounded-xl hover:bg-primary/5 transition-all active:scale-95"
            >
              Back
            </button>
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className={`flex-[2] py-4 font-bold text-white rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 ${
                canProceed()
                  ? 'bg-primary shadow-lg shadow-primary/20 hover:opacity-90'
                  : 'bg-outline-variant cursor-not-allowed'
              }`}
            >
              {step === STEPS.length - 1 ? 'Submit & Get Assessment' : 'Continue'}
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default IntakeQuestionnaire;
