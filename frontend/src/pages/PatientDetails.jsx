import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getPatientSymptoms, getPatientSummary, saveVisitNotes } from '../lib/api';

const MOCK = {
  name: 'Ngozi Okonkwo', age: 29, initials: 'NO', risk: 'HIGH',
  edd: 'Sep 12, 2025', lmp: 'Dec 05, 2024', ega: '24w 3d',
  bloodType: 'O+', gravida: 2, para: 1,
  symptoms: ['Severe Headache', 'Blurred Vision', 'Swollen Hands/Face'],
  bookingBP: '160/100 mmHg', urinalysis: 'Protein ++', pcv: '29%',
  conditions: ['Hypertension (diagnosed 2022)'],
  medications: 'Labetalol 200 mg BD, Folic acid',
  drugAllergies: 'Penicillin',
};

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

const PatientDetailPanel = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { patient: passedPatient, appointment_id } = location.state || {};

  const p = passedPatient || MOCK;
  const isReal = !!passedPatient?.id && typeof passedPatient.id === 'string' && passedPatient.id.length > 8;

  const name = p.name || MOCK.name;
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const risk = (p.risk || 'HIGH').toUpperCase();
  const riskBadgeClass = risk === 'HIGH' ? 'bg-secondary' : risk === 'MEDIUM' ? 'bg-amber-500' : 'bg-primary';

  const [clinicalNotes, setClinicalNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);

  const [symptoms, setSymptoms] = useState([]);
  const [loadingSymptoms, setLoadingSymptoms] = useState(false);

  const [aiSummary, setAiSummary] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(false);

  useEffect(() => {
    if (!isReal) return;
    setLoadingSymptoms(true);
    getPatientSymptoms(passedPatient.id, '30d')
      .then(r => {
        const data = r.data;
        setSymptoms(Array.isArray(data) ? data : data?.symptoms || []);
      })
      .catch(() => {})
      .finally(() => setLoadingSymptoms(false));
  }, [isReal, passedPatient?.id]);

  useEffect(() => {
    if (!isReal) return;
    setLoadingSummary(true);
    getPatientSummary(passedPatient.id)
      .then(r => setAiSummary(r.data?.summary || ''))
      .catch(() => {})
      .finally(() => setLoadingSummary(false));
  }, [isReal, passedPatient?.id]);

  const handleSaveNotes = async () => {
    if (!appointment_id || !clinicalNotes.trim()) return;
    setNotesSaving(true);
    try {
      await saveVisitNotes(appointment_id, clinicalNotes);
      setNotesSaved(true);
    } catch {
      // silently fail — doctor keeps notes locally
    } finally {
      setNotesSaving(false);
    }
  };

  const handleMarkSeen = async () => {
    if (!appointment_id) return;
    try {
      await saveVisitNotes(appointment_id, clinicalNotes || 'Appointment completed.');
      navigate('/provider');
    } catch {
      navigate('/provider');
    }
  };

  const displaySymptoms = symptoms.length > 0
    ? symptoms.map(s => s.symptom_key?.replace(/_/g, ' ') || s.name || s).filter(Boolean)
    : (p.symptoms || MOCK.symptoms);

  const fallbackSummary = `${name}, ${p.age}-year-old G${p.gravida ?? MOCK.gravida}P${p.para ?? MOCK.para}, presenting at ${p.weeks ? `week ${p.weeks}` : MOCK.ega} gestation. ${displaySymptoms.length > 0 ? `Presenting complaints: ${displaySymptoms.join(', ')}. ` : ''}${(p.bookingBP || MOCK.bookingBP) ? `BP: ${p.bookingBP || MOCK.bookingBP}.` : ''}`;

  return (
    <div className="bg-background text-on-surface font-body-md min-h-screen flex justify-end overflow-hidden">
      <div className="grain-overlay" />

      {/* Background ghost */}
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
            <div className={`${riskBadgeClass} text-white px-3 py-1 rounded-full font-label-sm text-xs flex items-center gap-1`}>
              <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                {risk === 'HIGH' ? 'error' : risk === 'MEDIUM' ? 'warning' : 'check_circle'}
              </span>
              {risk} RISK
            </div>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-900/50 flex items-center justify-center shrink-0 border border-amber-400/20">
              <span className="font-bold text-xl text-white">{initials}</span>
            </div>
            <div>
              <h2 className="font-headline-lg text-2xl mb-0.5">{name}</h2>
              <p className="font-body-md text-white/70">
                Age {p.age || '—'} · G{p.gravida ?? MOCK.gravida}P{p.para ?? MOCK.para}
                {p.weeks ? ` · Week ${p.weeks}` : ` · ${MOCK.ega}`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: 'EDD',        value: p.edd || MOCK.edd },
              { label: 'LMP',        value: p.lmp || MOCK.lmp },
              { label: 'Blood Type', value: p.bloodType || p.blood_group || MOCK.bloodType },
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
              {loadingSummary ? (
                <p className="font-body-md text-on-surface-variant text-sm italic">Generating summary…</p>
              ) : (
                <p className="font-body-md text-on-surface leading-relaxed text-sm">
                  {aiSummary || fallbackSummary}
                </p>
              )}
            </div>
          </section>

          {/* Clinical Flags */}
          {(p.flags?.length > 0 || !isReal) && (
            <section>
              <h3 className="font-label-sm text-on-surface-variant uppercase tracking-widest mb-3">Clinical Flags</h3>
              <div className="grid grid-cols-2 gap-2">
                {(p.flags?.length ? p.flags : ['High BP', 'Low Hb']).map(flag => (
                  <div key={flag} className="flex items-center gap-2 p-3 rounded-lg border bg-secondary-fixed border-secondary/20">
                    <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                    <span className="font-label-sm text-xs text-on-secondary-fixed-variant">{flag}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Symptom Timeline */}
          <section>
            <h3 className="font-label-sm text-on-surface-variant uppercase tracking-widest mb-3">
              Symptom Timeline {isReal ? '(Last 30 days)' : '(Demo)'}
            </h3>
            {loadingSymptoms && (
              <p className="text-on-surface-variant font-body-md text-sm">Loading symptoms…</p>
            )}
            {!loadingSymptoms && symptoms.length === 0 && !isReal && (
              <div className="space-y-2">
                {(p.symptoms || MOCK.symptoms).map((s, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-secondary/5 border border-secondary/20 rounded-lg">
                    <span className="material-symbols-outlined text-secondary text-sm">report</span>
                    <span className="font-body-md text-sm text-on-surface">{s}</span>
                  </div>
                ))}
              </div>
            )}
            {!loadingSymptoms && symptoms.length > 0 && (
              <div className="space-y-2">
                {symptoms.map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-surface-container-low border border-outline-variant/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className={`material-symbols-outlined text-sm ${s.severity === 'severe' ? 'text-secondary' : 'text-amber-500'}`}>
                        {s.severity === 'severe' ? 'error' : 'warning'}
                      </span>
                      <span className="font-body-md text-sm text-on-surface capitalize">
                        {(s.symptom_key || s.name || '').replace(/_/g, ' ')}
                      </span>
                    </div>
                    <span className="font-label-sm text-xs text-outline">
                      {s.severity || ''} · {s.logged_at ? new Date(s.logged_at).toLocaleDateString('en-GB') : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {!loadingSymptoms && symptoms.length === 0 && isReal && (
              <p className="text-on-surface-variant font-body-md text-sm italic">No symptoms logged in the last 30 days.</p>
            )}
          </section>

          {/* Full Clerking Record */}
          <section className="space-y-2">
            <h3 className="font-label-sm text-on-surface-variant uppercase tracking-widest mb-3">Full Clerking Record</h3>

            <SectionAccordion title="Biodata">
              <div className="mt-3 space-y-0">
                <Row label="Name"          value={name} />
                <Row label="Age"           value={p.age ? `${p.age} years` : '—'} />
                <Row label="Occupation"    value={p.occupation || '—'} />
                <Row label="Marital Status" value={p.marital || p.marital_status || '—'} />
                <Row label="State / LGA"   value={p.state || p.address || '—'} />
              </div>
            </SectionAccordion>

            <SectionAccordion title="Index Pregnancy" defaultOpen>
              <div className="mt-3 space-y-0">
                <Row label="LMP"              value={p.lmp || MOCK.lmp} />
                <Row label="EDD"              value={p.edd || MOCK.edd} />
                <Row label="Gestational Age"  value={p.weeks ? `Week ${p.weeks}` : MOCK.ega} />
                <Row label="Booking Weight"   value={p.bookingWeight || p.booking_weight || '—'} />
                <Row label="Booking Height"   value={p.bookingHeight || p.booking_height || '—'} />
              </div>
            </SectionAccordion>

            <SectionAccordion title="Booking Investigations" defaultOpen>
              <div className="mt-3 space-y-0">
                <Row label="Blood Group"   value={p.bloodType || p.blood_group || MOCK.bloodType} />
                <Row label="Genotype"      value={p.genotype || '—'} />
                <Row label="Blood Pressure" value={p.bookingBP || MOCK.bookingBP} highlight />
                <Row label="Urinalysis"    value={p.urinalysis || MOCK.urinalysis} highlight />
                <Row label="HIV (RVD)"     value={p.hiv || '—'} />
                <Row label="VDRL"          value={p.vdrl || '—'} />
                <Row label="PCV"           value={p.pcv || MOCK.pcv} highlight />
                <Row label="Hepatitis B"   value={p.hepB || p.hep_b || '—'} />
                <Row label="Tetanus"       value={p.tetanus || '—'} />
              </div>
            </SectionAccordion>

            <SectionAccordion title="Obstetric History">
              <div className="mt-3 space-y-0">
                <Row label="Gravida"    value={p.gravida != null ? `G${p.gravida}` : '—'} />
                <Row label="Para"       value={p.para != null ? `P${p.para}` : '—'} />
                <Row label="Miscarriage / TOP" value={p.miscarriage != null ? (p.miscarriage ? 'Yes' : 'No') : '—'} />
              </div>
            </SectionAccordion>

            <SectionAccordion title="Past Medical & Surgical History">
              <div className="mt-3 space-y-0">
                <Row label="Conditions"          value={Array.isArray(p.conditions) ? p.conditions.join(', ') : (p.conditions || MOCK.conditions.join(', '))} highlight />
                <Row label="Current Medications" value={p.medications || MOCK.medications} />
                <Row label="Drug Allergies"      value={p.drugAllergies || p.drug_allergies || MOCK.drugAllergies} highlight />
                <Row label="Food Allergies"      value={p.foodAllergies || p.food_allergies || 'None'} />
              </div>
            </SectionAccordion>
          </section>

          {/* Clinical Notes */}
          <section>
            <h3 className="font-label-sm text-on-surface-variant uppercase tracking-widest mb-3">Clinical Consultation Notes</h3>
            <div className="relative">
              <textarea
                value={clinicalNotes}
                onChange={e => { setClinicalNotes(e.target.value); setNotesSaved(false); }}
                className="w-full h-36 bg-surface-container-low border border-outline rounded-lg p-4 font-body-md text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-outline/60 resize-none"
                placeholder="Start typing clinical notes…"
              />
              {appointment_id && clinicalNotes.trim() && (
                <button
                  onClick={handleSaveNotes}
                  disabled={notesSaving || notesSaved}
                  className="mt-2 text-primary font-label-sm text-xs underline underline-offset-2 disabled:opacity-50"
                >
                  {notesSaving ? 'Saving…' : notesSaved ? 'Saved ✓' : 'Save notes'}
                </button>
              )}
              {!appointment_id && (
                <p className="mt-1 font-label-sm text-outline text-xs">
                  Notes can only be saved for queue appointments.
                </p>
              )}
            </div>
          </section>
        </div>

        {/* Action Footer */}
        <footer className="p-5 bg-surface border-t border-outline-variant grid grid-cols-2 gap-3 shrink-0">
          <button className="col-span-2 bg-secondary text-white py-4 rounded-lg font-label-sm text-sm hover:brightness-95 transition-all flex items-center justify-center gap-2">
            <span className="material-symbols-outlined">emergency_share</span>
            ESCALATE TO EMERGENCY
          </button>
          <button
            onClick={handleMarkSeen}
            className="bg-surface-container-high text-on-surface py-3 rounded-lg font-label-sm text-sm hover:bg-surface-container-highest transition-all border border-outline/20"
          >
            {appointment_id ? 'Mark as Seen' : 'Back'}
          </button>
          <button className="bg-primary text-white py-3 rounded-lg font-label-sm text-sm hover:opacity-90 transition-all">
            Refer to Specialist
          </button>
        </footer>
      </aside>
    </div>
  );
};

export default PatientDetailPanel;
