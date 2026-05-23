import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// ── Mock clerking record for Ngozi Okonkwo ────────────────────────────────────
const PATIENT = {
  name: 'Ngozi Okonkwo',
  age: 29,
  initials: 'NO',
  risk: 'HIGH',
  edd: 'Sep 12, 2025',
  lmp: 'Dec 05, 2024',
  ega: '24w 3d',
  // Biodata
  occupation: 'Petty Trader',
  education: 'Secondary',
  marital: 'Married',
  state: 'Benin City, Edo',
  religion: 'Christian',
  ethnicity: 'Edo',
  // Index pregnancy
  desired: 'Yes',
  conception: 'Natural',
  ultrasound: 'Yes — 14th Jan 2025',
  bookingWeight: '71 kg',
  bookingHeight: '162 cm',
  // Obstetric history
  gravida: 2,
  para: 1,
  lastBirth: '2021 (C-section, UBTH, male, 3.1 kg, cried immediately)',
  twins: 'No',
  miscarriage: 'No',
  // Booking labs
  bloodType: 'O+',
  genotype: 'AA',
  bookingBP: '160/100 mmHg',
  urinalysis: 'Protein ++',
  hiv: 'Non-Reactive',
  vdrl: 'Non-Reactive',
  pcv: '29%',
  hepB: 'Negative',
  tetanus: 'Up to date',
  // Gynae history
  menarche: 14,
  cycleDays: 28,
  flowDays: 5,
  heavyBleeding: 'No',
  dysmenorrhea: 'No',
  intermenstrual: 'No',
  postcoital: 'No',
  discharge: 'No',
  contraceptive: 'Pill (stopped 2023)',
  papSmear: 'Not done',
  // Symptoms
  symptoms: ['Severe Headache', 'Blurred Vision', 'Swollen Hands/Face'],
  // Medical history
  conditions: ['Hypertension (diagnosed 2022)'],
  medications: 'Labetalol 200 mg twice daily, Folic acid',
  bloodTransfusion: 'No',
  surgeries: 'C-section (2021, UBTH)',
  drugAllergies: 'Penicillin',
  foodAllergies: 'None',
  // Social
  married: 'Married, Monogamous',
  patientSmokes: 'No',
  patientDrinks: 'No',
  husbandOccupation: 'Mechanic',
  husbandSmokes: 'Yes',
  husbandDrinks: 'Yes',
};

const APPT_HISTORY = [
  { date: 'TODAY - CURRENT', type: 'Emergency Consult', note: 'Attending: Dr. Emeka A.', active: true },
  { date: 'FEB 20, 2025', type: 'Routine ANC — 16 wks', note: 'Stable vitals, UBTH Branch', active: false },
  { date: 'JAN 14, 2025', type: 'Booking Visit', note: 'Ultrasound confirmed, labs done', active: false },
];

// ── Shared sub-components ─────────────────────────────────────────────────────

const Row = ({ label, value, highlight }) => (
  <div className="flex items-start justify-between gap-4 py-2 border-b border-outline-variant/15 last:border-0">
    <span className="font-label-sm text-on-surface-variant text-xs uppercase shrink-0">{label}</span>
    <span className={`font-body-md text-sm text-right ${highlight ? 'text-secondary font-bold' : 'text-on-surface font-medium'}`}>
      {value || '—'}
    </span>
  </div>
);

const SectionAccordion = ({ title, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex justify-between items-center p-4 hover:bg-surface-container-low transition-colors"
      >
        <span className="font-label-sm text-on-surface uppercase text-xs">{title}</span>
        <span className={`material-symbols-outlined text-on-surface-variant transition-transform ${open ? 'rotate-180' : ''}`}>
          expand_more
        </span>
      </button>
      {open && (
        <div className="p-4 pt-0 border-t border-outline-variant/30">
          {children}
        </div>
      )}
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

const PatientDetailPanel = () => {
  const navigate = useNavigate();
  const [clinicalNotes, setClinicalNotes] = useState('');

  return (
    <div className="bg-background text-on-surface font-body-md min-h-screen flex justify-end overflow-hidden">
      <div className="grain-overlay" />

      {/* Background dashboard ghost */}
      <main className="hidden md:flex flex-col flex-1 p-12 opacity-20 grayscale pointer-events-none">
        <header className="flex justify-between items-center mb-12">
          <h1 className="font-display-xl text-display-xl">Provider Dashboard</h1>
        </header>
        <div className="grid grid-cols-3 gap-8">
          <div className="h-64 rounded-xl bg-surface-container" />
          <div className="h-64 rounded-xl bg-surface-container" />
          <div className="h-64 rounded-xl bg-surface-container" />
        </div>
      </main>

      {/* Side Detail Panel */}
      <aside className="w-full md:w-[500px] bg-surface h-screen shadow-2xl flex flex-col relative z-50 border-l border-outline-variant">

        {/* Header */}
        <header className="bg-[#1A1A18] text-white p-6 shrink-0">
          <div className="flex justify-between items-start mb-4">
            <button onClick={() => navigate('/provider')} className="text-white/60 hover:text-white transition-colors">
              <span className="material-symbols-outlined">close</span>
            </button>
            <div className="bg-secondary text-white px-3 py-1 rounded-full font-label-sm text-xs flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
              HIGH RISK
            </div>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-900/50 flex items-center justify-center shrink-0 border border-amber-400/20">
              <span className="font-bold text-xl text-white">{PATIENT.initials}</span>
            </div>
            <div>
              <h2 className="font-headline-lg text-2xl mb-0.5">{PATIENT.name}</h2>
              <p className="font-body-md text-white/70">
                Age {PATIENT.age} · G{PATIENT.gravida}P{PATIENT.para} · {PATIENT.ega}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: 'EDD', value: PATIENT.edd },
              { label: 'LMP', value: PATIENT.lmp },
              { label: 'Blood Type', value: PATIENT.bloodType },
            ].map(item => (
              <div key={item.label} className="bg-white/10 rounded-xl p-2.5">
                <p className="font-label-sm text-white/50 text-[10px] uppercase">{item.label}</p>
                <p className="font-body-md text-white text-xs mt-0.5 font-medium">{item.value}</p>
              </div>
            ))}
          </div>
        </header>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">

          {/* AI Pre-Consult Summary */}
          <section>
            <h3 className="font-label-sm text-on-surface-variant uppercase tracking-widest mb-3">AI Pre-Consult Summary</h3>
            <div className="bg-surface-container-low border-l-4 border-primary p-4 rounded-r-lg shadow-sm">
              <p className="font-body-md text-on-surface leading-relaxed text-sm">
                {PATIENT.name}, {PATIENT.age}-year-old G{PATIENT.gravida}P{PATIENT.para}, presenting at {PATIENT.ega} gestation.
                Presenting complaints include:{' '}
                <strong className="text-secondary">{PATIENT.symptoms.join(', ')}</strong>.
                Booking BP: <strong className="text-secondary">{PATIENT.bookingBP}</strong>.
                Notable: known hypertension, anaemia (PCV {PATIENT.pcv}), previous C-section. Urinalysis: {PATIENT.urinalysis}.
              </p>
            </div>
          </section>

          {/* Clinical Flags */}
          <section>
            <h3 className="font-label-sm text-on-surface-variant uppercase tracking-widest mb-3">Clinical Flags</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: 'blood_pressure', label: 'Hypertension',       danger: true },
                { icon: 'vital_signs',    label: 'Active Bleeding',     danger: true },
                { icon: 'neurology',      label: 'Blurred Vision',      danger: true },
                { icon: 'vaccines',       label: 'Anaemia (PCV 29%)',   danger: false },
                { icon: 'monitor_weight', label: 'Normal BMI',          danger: false },
                { icon: 'medical_services', label: 'Tetanus Up-to-date', danger: false },
              ].map(f => (
                <div key={f.label}
                  className={`flex items-center gap-2 p-3 rounded-lg border ${
                    f.danger ? 'bg-secondary-fixed border-secondary/20' : 'bg-tertiary-fixed border-tertiary/20'
                  }`}
                >
                  <span className={`material-symbols-outlined ${f.danger ? 'text-secondary' : 'text-primary'}`}
                    style={{ fontVariationSettings: "'FILL' 1" }}>
                    {f.icon}
                  </span>
                  <span className={`font-label-sm text-xs ${f.danger ? 'text-on-secondary-fixed-variant' : 'text-on-tertiary-fixed-variant'}`}>
                    {f.label}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Full Clinical Intake — accordion sections */}
          <section className="space-y-2">
            <h3 className="font-label-sm text-on-surface-variant uppercase tracking-widest mb-3">Full Clerking Record</h3>

            <SectionAccordion title="Biodata">
              <div className="mt-3 space-y-0">
                <Row label="Name" value={PATIENT.name} />
                <Row label="Age" value={`${PATIENT.age} years`} />
                <Row label="Occupation" value={PATIENT.occupation} />
                <Row label="Education" value={PATIENT.education} />
                <Row label="Marital Status" value={PATIENT.marital} />
                <Row label="State / LGA" value={PATIENT.state} />
                <Row label="Religion" value={PATIENT.religion} />
                <Row label="Ethnicity" value={PATIENT.ethnicity} />
              </div>
            </SectionAccordion>

            <SectionAccordion title="Index Pregnancy" defaultOpen>
              <div className="mt-3 space-y-0">
                <Row label="LMP" value={PATIENT.lmp} />
                <Row label="EDD" value={PATIENT.edd} />
                <Row label="Gestational Age" value={PATIENT.ega} />
                <Row label="Pregnancy Desired" value={PATIENT.desired} />
                <Row label="Conception" value={PATIENT.conception} />
                <Row label="Ultrasound Confirmed" value={PATIENT.ultrasound} />
                <Row label="Booking Weight" value={PATIENT.bookingWeight} />
                <Row label="Booking Height" value={PATIENT.bookingHeight} />
              </div>
            </SectionAccordion>

            <SectionAccordion title="Booking Investigations" defaultOpen>
              <div className="mt-3 space-y-0">
                <Row label="Blood Group" value={PATIENT.bloodType} />
                <Row label="Genotype" value={PATIENT.genotype} />
                <Row label="Blood Pressure" value={PATIENT.bookingBP} highlight />
                <Row label="Urinalysis" value={PATIENT.urinalysis} highlight />
                <Row label="HIV (RVD)" value={PATIENT.hiv} />
                <Row label="VDRL" value={PATIENT.vdrl} />
                <Row label="PCV" value={PATIENT.pcv} highlight />
                <Row label="Hepatitis B" value={PATIENT.hepB} />
                <Row label="Tetanus" value={PATIENT.tetanus} />
              </div>
            </SectionAccordion>

            <SectionAccordion title="Obstetric History">
              <div className="mt-3 space-y-0">
                <Row label="Gravida" value={`G${PATIENT.gravida}`} />
                <Row label="Para" value={`P${PATIENT.para}`} />
                <Row label="Last Delivery" value={PATIENT.lastBirth} />
                <Row label="Twin / Multiple" value={PATIENT.twins} />
                <Row label="Miscarriage / TOP" value={PATIENT.miscarriage} />
              </div>
            </SectionAccordion>

            <SectionAccordion title="Gynaecological History">
              <div className="mt-3 space-y-0">
                <Row label="Menarche" value={`Age ${PATIENT.menarche}`} />
                <Row label="Cycle Length" value={`${PATIENT.cycleDays} days`} />
                <Row label="Flow Duration" value={`${PATIENT.flowDays} days`} />
                <Row label="Heavy Bleeding" value={PATIENT.heavyBleeding} />
                <Row label="Dysmenorrhea" value={PATIENT.dysmenorrhea} />
                <Row label="Intermenstrual Bleed" value={PATIENT.intermenstrual} />
                <Row label="Postcoital Bleed" value={PATIENT.postcoital} />
                <Row label="Abnormal Discharge" value={PATIENT.discharge} />
                <Row label="Contraceptive Hx" value={PATIENT.contraceptive} />
                <Row label="Pap Smear" value={PATIENT.papSmear} />
              </div>
            </SectionAccordion>

            <SectionAccordion title="Past Medical & Surgical History">
              <div className="mt-3 space-y-0">
                <Row label="Conditions" value={PATIENT.conditions.join(', ')} highlight />
                <Row label="Current Medications" value={PATIENT.medications} />
                <Row label="Blood Transfusion" value={PATIENT.bloodTransfusion} />
                <Row label="Surgeries" value={PATIENT.surgeries} />
                <Row label="Drug Allergies" value={PATIENT.drugAllergies} highlight />
                <Row label="Food Allergies" value={PATIENT.foodAllergies} />
              </div>
            </SectionAccordion>

            <SectionAccordion title="Family & Social History">
              <div className="mt-3 space-y-0">
                <Row label="Marital Type" value={PATIENT.married} />
                <Row label="Patient Smokes" value={PATIENT.patientSmokes} />
                <Row label="Patient Drinks" value={PATIENT.patientDrinks} />
                <Row label="Partner Occupation" value={PATIENT.husbandOccupation} />
                <Row label="Partner Smokes" value={PATIENT.husbandSmokes} />
                <Row label="Partner Drinks" value={PATIENT.husbandDrinks} />
              </div>
            </SectionAccordion>
          </section>

          {/* Appointment History */}
          <section>
            <h3 className="font-label-sm text-on-surface-variant uppercase tracking-widest mb-3">Appointment History</h3>
            <div className="relative pl-8 space-y-6 before:content-[''] before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-outline-variant">
              {APPT_HISTORY.map(appt => (
                <div key={appt.date} className={`relative ${!appt.active ? 'opacity-60' : ''}`}>
                  <div className={`absolute -left-8 top-1 w-6 h-6 rounded-full ring-4 ring-white flex items-center justify-center ${appt.active ? 'bg-secondary' : 'bg-primary'}`}>
                    <span className="material-symbols-outlined text-[14px] text-white">
                      {appt.active ? 'medical_services' : 'check'}
                    </span>
                  </div>
                  <span className={`font-label-sm text-xs ${appt.active ? 'text-secondary' : 'text-on-surface-variant'}`}>
                    {appt.date}
                  </span>
                  <p className="font-body-md font-medium text-on-surface">{appt.type}</p>
                  <p className="font-label-sm text-on-surface-variant text-xs mt-0.5">{appt.note}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Clinical Notes */}
          <section>
            <h3 className="font-label-sm text-on-surface-variant uppercase tracking-widest mb-3">Clinical Consultation Notes</h3>
            <div className="relative">
              <textarea
                value={clinicalNotes}
                onChange={e => setClinicalNotes(e.target.value)}
                className="w-full h-36 bg-surface-container-low border border-outline rounded-lg p-4 font-body-md text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-outline/60 resize-none"
                placeholder="Start typing clinical notes… (auto-saving)"
              />
              <div className="absolute bottom-3 right-3 flex items-center gap-1 text-[10px] text-primary uppercase font-bold tracking-tighter opacity-50">
                <span className="material-symbols-outlined text-[12px]">sync</span>
                SAVED
              </div>
            </div>
          </section>
        </div>

        {/* Action Footer */}
        <footer className="p-5 bg-surface border-t border-outline-variant grid grid-cols-2 gap-3 shrink-0">
          <button className="col-span-2 bg-secondary text-white py-4 rounded-lg font-label-sm text-sm hover:brightness-95 transition-all flex items-center justify-center gap-2">
            <span className="material-symbols-outlined">emergency_share</span>
            ESCALATE TO EMERGENCY
          </button>
          <button className="bg-surface-container-high text-on-surface py-3 rounded-lg font-label-sm text-sm hover:bg-surface-container-highest transition-all border border-outline/20">
            Mark as Seen
          </button>
          <button className="bg-primary text-white py-3 rounded-lg font-label-sm text-sm hover:bg-primary-container transition-all">
            Refer to Specialist
          </button>
        </footer>
      </aside>
    </div>
  );
};

export default PatientDetailPanel;
