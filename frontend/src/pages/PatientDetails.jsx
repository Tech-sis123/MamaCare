import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  getPatientSummary,
  saveVisitNotes,
  getDoctorPatientDetail,
  updateDoctorPregnancy,
} from '../lib/api';

/** Short unique code shown to doctors for search (MC-XXXXXX). */
const formatPatientCode = (id) =>
  id ? `MC-${String(id).replace(/-/g, '').slice(0, 6).toUpperCase()}` : '';

const MOCK = {
  name: 'Ngozi Okonkwo',
  age: 29,
  risk: 'HIGH',
  edd: 'Sep 12, 2025',
  lmp: 'Dec 05, 2024',
  ega: 'Week 24',
  bloodType: 'O+',
  gravida: 2,
  para: 1,
  childrenAlive: 1,
};

const calcEgaWeeks = (lmpRaw) => {
  if (!lmpRaw) return null;
  const lmp = new Date(lmpRaw);
  if (Number.isNaN(lmp.getTime())) return null;
  const days = Math.floor((Date.now() - lmp.getTime()) / (1000 * 60 * 60 * 24));
  return Math.floor(days / 7);
};

const formatEgaLabel = (weeks) => {
  if (weeks == null || Number.isNaN(Number(weeks))) return '—';
  const w = Number(weeks);
  if (w < 0) return '—';
  if (w > 42) return `Week ${w} (check LMP)`;
  return `Week ${w}`;
};

const formatGP = (G, P, alive) => {
  const g = Number(G);
  const p = Number(P);
  if (Number.isNaN(g) || Number.isNaN(p)) return null;
  let s = `G${g}P${p}`;
  if (alive != null && !Number.isNaN(Number(alive))) s += `(${Number(alive)}A)`;
  return s;
};

const toDateInput = (raw) => {
  if (!raw) return '';
  try {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw).slice(0, 10);
    return d.toISOString().slice(0, 10);
  } catch {
    return '';
  }
};

const formatDisplayDate = (raw) => {
  if (!raw) return '—';
  try {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);
    return d.toLocaleDateString('en-GB');
  } catch {
    return String(raw);
  }
};

const formatDisplayDateTime = (raw) => {
  if (!raw) return '—';
  try {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);
    return d.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(raw);
  }
};

const BOOKING_STATUS_STYLE = {
  booked: 'bg-amber-100 text-amber-800',
  completed: 'bg-primary/15 text-primary',
  cancelled: 'bg-surface-container text-on-surface-variant',
  no_show: 'bg-secondary/15 text-secondary',
};

const formatBookingStatus = (status) => {
  const s = String(status || '').toLowerCase();
  if (s === 'no_show') return 'No show';
  if (!s) return '—';
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const ans = (map, key) => {
  const v = map[key];
  if (v == null) return null;
  if (typeof v === 'object') return v;
  return String(v);
};

const newId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const emptyVitalsDraft = () => ({
  date: new Date().toISOString().slice(0, 10),
  pr: '',
  rr: '',
  bp_systolic: '',
  bp_diastolic: '',
  temp_c: '',
  weight_kg: '',
  height_cm: '',
});

const emptyInvestigations = () => ({
  blood_group: '',
  genotype: '',
  rhesus: '',
  rvd_status: '',
  vdrl: '',
  pcv: '',
  hep_b: '',
  hep_c: '',
  malaria_parasite: '',
  urinalysis: '',
  rbg: '',
  ogtt: '',
  tetanus_history: '',
  ipt_history: '',
  uss_date: '',
  uss_ega_weeks: '',
  uss_notes: '',
});

/** Expandable clinic section */
const ClinicSection = ({ title, open, onToggle, children, badge }) => (
  <div className="bg-white border border-outline-variant/40 rounded-xl overflow-hidden shadow-sm">
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between p-4 text-left hover:bg-surface-container-low transition-colors"
    >
      <span className="font-label-sm text-on-surface font-semibold text-sm flex items-center gap-2">
        {title}
        {badge != null && badge !== '' && (
          <span className="font-label-sm text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            {badge}
          </span>
        )}
      </span>
      <span
        className={`material-symbols-outlined text-on-surface-variant transition-transform ${open ? 'rotate-180' : ''}`}
      >
        expand_more
      </span>
    </button>
    {open && (
      <div className="px-4 pb-4 border-t border-outline-variant/25 space-y-3">
        {children}
      </div>
    )}
  </div>
);

const FieldRow = ({ label, children }) => (
  <div className="flex items-center justify-between gap-3 py-1.5">
    <label className="font-label-sm text-on-surface-variant text-xs uppercase shrink-0 max-w-[40%]">
      {label}
    </label>
    <div className="w-[60%] flex justify-end">{children}</div>
  </div>
);

const inputCls =
  'bg-surface-container-low text-sm px-2 py-1.5 rounded-lg w-full text-right text-on-surface border border-outline/20 focus:border-primary outline-none';

const PatientDetailPanel = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { patient: passedPatient, appointment_id } = location.state || {};
  const isReal =
    !!passedPatient?.id &&
    typeof passedPatient.id === 'string' &&
    passedPatient.id.length > 8;

  const [fullPatient, setFullPatient] = useState(null);
  const [aiSummary, setAiSummary] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [openSection, setOpenSection] = useState('bookings');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const [vitalsLog, setVitalsLog] = useState([]);
  const [showLogVitals, setShowLogVitals] = useState(false);
  const [vitalDraft, setVitalDraft] = useState(emptyVitalsDraft);

  const [investigations, setInvestigations] = useState(emptyInvestigations);
  const [consultationNotes, setConsultationNotes] = useState('');

  const reloadPatient = useCallback(() => {
    if (!isReal) return Promise.resolve();
    return getDoctorPatientDetail(passedPatient.id)
      .then((r) => setFullPatient(r.data?.patient || null))
      .catch(() => {});
  }, [isReal, passedPatient?.id]);

  useEffect(() => {
    if (!isReal) return;
    reloadPatient();
  }, [isReal, passedPatient?.id, reloadPatient]);

  useEffect(() => {
    if (!isReal) return;
    setLoadingSummary(true);
    getPatientSummary(passedPatient.id)
      .then((r) => setAiSummary(r.data?.summary || ''))
      .catch(() => {})
      .finally(() => setLoadingSummary(false));
  }, [isReal, passedPatient?.id]);

  // Hydrate from pregnancy + intake
  useEffect(() => {
    if (!fullPatient) {
      if (!isReal) {
        setVitalsLog([
          {
            id: 'demo-1',
            date: '2026-07-06',
            bp_systolic: 110,
            bp_diastolic: 80,
            pr: 86,
            weight_kg: 80,
            height_cm: 169,
            rr: 18,
            temp_c: 37,
          },
        ]);
        setInvestigations({
          ...emptyInvestigations(),
          blood_group: 'O+',
          genotype: 'AA',
          pcv: '32',
          rvd_status: 'Negative',
        });
        setConsultationNotes('');
      }
      return;
    }

    const pr = fullPatient.pregnancies?.[0] || {};
    setVitalsLog(Array.isArray(pr.vitals_log) ? pr.vitals_log : []);

    setInvestigations({
      blood_group: pr.blood_group || '',
      genotype: pr.genotype || '',
      rhesus: pr.rhesus || '',
      rvd_status: pr.rvd_status || '',
      vdrl: pr.vdrl || '',
      pcv: pr.pcv != null && pr.pcv !== '' ? String(pr.pcv) : '',
      hep_b: pr.hep_b || '',
      hep_c: pr.hep_c || '',
      malaria_parasite: pr.malaria_parasite || '',
      urinalysis: pr.urinalysis || '',
      rbg: pr.rbg || '',
      ogtt: pr.ogtt || '',
      tetanus_history: pr.tetanus_history || '',
      ipt_history: pr.ipt_history || '',
      uss_date: toDateInput(pr.uss_date),
      uss_ega_weeks: pr.uss_ega_weeks != null ? String(pr.uss_ega_weeks) : '',
      uss_notes: pr.uss_notes || '',
    });

    setConsultationNotes(pr.important_remarks || '');
  }, [fullPatient, isReal]);

  // ── Derived display ──────────────────────────────────────────────────────
  const preg = fullPatient?.pregnancies?.[0] || {};
  const bookingHistory = isReal
    ? Array.isArray(fullPatient?.booking_history)
      ? fullPatient.booking_history
      : []
    : [
        {
          id: 'demo-b1',
          slot_start: '2026-08-10T09:00:00',
          slot_end: '2026-08-10T09:30:00',
          status: 'completed',
          doctor: { name: 'Dr. Adebayo' },
          notes: 'ANC review — BP stable',
        },
        {
          id: 'demo-b2',
          slot_start: '2026-08-17T10:00:00',
          slot_end: '2026-08-17T10:30:00',
          status: 'booked',
          doctor: { name: 'Dr. Adebayo' },
          notes: null,
        },
      ];

  const intakeMap = {};
  (fullPatient?.intake_responses || []).forEach((r) => {
    if (r?.question_key) intakeMap[r.question_key] = r.answer;
  });

  let childrenAlive = 0;
  let childEntries = 0;
  for (let i = 0; i < 20; i += 1) {
    const state = ans(intakeMap, `child_${i}_state_now`);
    if (state == null || state === '') continue;
    childEntries += 1;
    const s = String(state).toLowerCase();
    if (s.includes('alive') || s === 'well' || s === 'healthy' || s === 'living') {
      childrenAlive += 1;
    }
  }

  const liveEga = preg.lmp_date
    ? calcEgaWeeks(preg.lmp_date)
    : passedPatient?.ega_weeks != null
      ? Number(passedPatient.ega_weeks)
      : null;

  const gravida = preg.gravidity ?? passedPatient?.gravida ?? (isReal ? null : MOCK.gravida);
  const para = preg.parity ?? passedPatient?.para ?? (isReal ? null : MOCK.para);
  if (childEntries === 0 && para != null && !Number.isNaN(Number(para))) {
    childrenAlive = Math.max(0, Number(para));
  }
  if (!isReal && childEntries === 0) childrenAlive = MOCK.childrenAlive;

  const gpStr = formatGP(gravida, para, childrenAlive);

  const name = fullPatient?.name || passedPatient?.name || MOCK.name;
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const risk = (
    passedPatient?.risk_tier ||
    fullPatient?.risk_assessments?.[0]?.tier ||
    passedPatient?.risk ||
    MOCK.risk
  ).toUpperCase();
  const riskBadgeClass =
    risk === 'HIGH' ? 'bg-secondary' : risk === 'MEDIUM' ? 'bg-amber-500' : 'bg-primary';

  const age = fullPatient?.age || passedPatient?.age || MOCK.age;
  const lmp = preg.lmp_date
    ? new Date(preg.lmp_date).toLocaleDateString('en-GB')
    : passedPatient?.lmp || (isReal ? '—' : MOCK.lmp);
  const edd = preg.edd_computed
    ? new Date(preg.edd_computed).toLocaleDateString('en-GB')
    : passedPatient?.edd || (isReal ? '—' : MOCK.edd);
  const bloodType =
    investigations.blood_group ||
    preg.blood_group ||
    passedPatient?.bloodType ||
    passedPatient?.blood_group ||
    (isReal ? '—' : MOCK.bloodType);
  const patientCode =
    fullPatient?.patient_code || formatPatientCode(fullPatient?.id || passedPatient?.id);
  const weeks = liveEga != null && !Number.isNaN(liveEga) ? liveEga : null;

  const fallbackSummary = isReal
    ? `Mrs. ${name}, ${age != null ? age : 'age unknown'}, ${gpStr || 'G?P?'}, currently ${weeks != null ? `${weeks} weeks` : 'EGA unknown'}. Risk: ${risk}.`
    : `Mrs. ${MOCK.name}, ${MOCK.age}, ${formatGP(MOCK.gravida, MOCK.para, MOCK.childrenAlive)}, currently 24 weeks. Presenting with severe headache, blurred vision. Known hypertensive. Risk: HIGH. Last BP: 160/100.`;

  const toggle = (key) => setOpenSection((o) => (o === key ? null : key));

  const setInv = (field, value) =>
    setInvestigations((prev) => ({ ...prev, [field]: value }));

  const addVital = () => {
    const hasAny =
      vitalDraft.pr ||
      vitalDraft.rr ||
      vitalDraft.bp_systolic ||
      vitalDraft.bp_diastolic ||
      vitalDraft.temp_c ||
      vitalDraft.weight_kg ||
      vitalDraft.height_cm;
    if (!hasAny) return;
    const entry = { id: newId(), ...vitalDraft };
    setVitalsLog((list) => [entry, ...list]);
    setVitalDraft(emptyVitalsDraft());
    setShowLogVitals(false);
  };

  const buildReviewPayload = () => {
    const inv = investigations;
    const pcvNum = inv.pcv !== '' && inv.pcv != null ? Number(inv.pcv) : undefined;
    const ussEga =
      inv.uss_ega_weeks !== '' && inv.uss_ega_weeks != null
        ? Number(inv.uss_ega_weeks)
        : undefined;

    return {
      vitals_log: vitalsLog,
      important_remarks: consultationNotes || null,
      blood_group: inv.blood_group || null,
      genotype: inv.genotype || null,
      rhesus: inv.rhesus || null,
      rvd_status: inv.rvd_status || null,
      vdrl: inv.vdrl || null,
      pcv: pcvNum != null && !Number.isNaN(pcvNum) ? pcvNum : null,
      hep_b: inv.hep_b || null,
      hep_c: inv.hep_c || null,
      malaria_parasite: inv.malaria_parasite || null,
      urinalysis: inv.urinalysis || null,
      rbg: inv.rbg || null,
      ogtt: inv.ogtt || null,
      tetanus_history: inv.tetanus_history || null,
      ipt_history: inv.ipt_history || null,
      uss_date: inv.uss_date || null,
      uss_ega_weeks: ussEga != null && !Number.isNaN(ussEga) ? ussEga : null,
      uss_notes: inv.uss_notes || null,
    };
  };

  const handleSaveReview = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      if (isReal) {
        const payload = buildReviewPayload();
        Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
        await updateDoctorPregnancy(passedPatient.id, payload);
        if (appointment_id && consultationNotes.trim()) {
          try {
            await saveVisitNotes(appointment_id, consultationNotes, { complete: false });
          } catch {
            /* non-blocking */
          }
        }
        await reloadPatient();
      }
      try {
        localStorage.setItem(
          `mamacare_review_${passedPatient?.id || 'demo'}`,
          JSON.stringify({ vitalsLog, investigations, consultationNotes })
        );
      } catch {
        /* ignore */
      }
      setSaveMsg('Review saved');
    } catch (e) {
      try {
        localStorage.setItem(
          `mamacare_review_${passedPatient?.id || 'demo'}`,
          JSON.stringify({ vitalsLog, investigations, consultationNotes })
        );
      } catch {
        /* ignore */
      }
      setSaveMsg(e?.response?.data?.error || e?.message || 'Save failed — draft kept locally');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkSeen = async () => {
    if (!appointment_id) {
      navigate('/provider');
      return;
    }
    try {
      await handleSaveReview();
      await saveVisitNotes(
        appointment_id,
        consultationNotes.trim() || 'Appointment completed.',
        { complete: true }
      );
      navigate('/provider');
    } catch {
      navigate('/provider');
    }
  };

  const invFilledCount = Object.values(investigations).filter(
    (v) => v != null && String(v).trim() !== ''
  ).length;

  return (
    <div className="bg-background text-on-surface font-body-md min-h-screen flex flex-col">
      <div className="grain-overlay pointer-events-none" />

      {/* Patient header — full width on all breakpoints */}
      <header className="bg-[#1A1A18] text-white shrink-0">
        <div className="max-w-4xl mx-auto w-full p-5 sm:p-6">
          <div className="flex justify-between items-start mb-4">
            <button
              type="button"
              onClick={() => navigate('/provider')}
              className="text-white/60 hover:text-white transition-colors"
              aria-label="Close"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <div
              className={`${riskBadgeClass} text-white px-3 py-1 rounded-full font-label-sm text-xs flex items-center gap-1`}
            >
              <span
                className="material-symbols-outlined text-[14px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                {risk === 'HIGH' ? 'error' : risk === 'MEDIUM' ? 'warning' : 'check_circle'}
              </span>
              {risk} RISK
            </div>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-900/50 flex items-center justify-center shrink-0 border border-amber-400/20">
              <span className="font-bold text-xl text-white">{initials}</span>
            </div>
            <div className="min-w-0">
              <h2 className="font-headline-lg text-2xl mb-0.5 truncate">{name}</h2>
              <p className="font-body-md text-white/70">
                Age {age || '—'} · {gpStr || 'G—P—'}
                {weeks != null ? ` · ${formatEgaLabel(weeks)}` : isReal ? '' : ` · ${MOCK.ega}`}
              </p>
              {patientCode && (
                <p className="font-mono text-xs text-amber-200/80 mt-1 tracking-wide">{patientCode}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: 'EDD', value: edd },
              { label: 'LMP', value: lmp },
              { label: 'Blood Type', value: bloodType },
            ].map((item) => (
              <div key={item.label} className="bg-white/10 rounded-xl p-2.5">
                <p className="font-label-sm text-white/50 text-[10px] uppercase">{item.label}</p>
                <p className="font-body-md text-white text-xs mt-0.5 font-medium">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Main content — full-width container (desktop + mobile) */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-5 space-y-4 pb-36">
        {/* AI Pre-Consult Summary */}
        <section>
          <h3 className="font-label-sm text-on-surface-variant uppercase tracking-widest mb-3">
            AI Pre-Consult Summary
          </h3>
          <div className="bg-white border-l-4 border-primary p-4 rounded-r-lg shadow-sm border border-outline-variant/30 border-l-primary">
            {loadingSummary ? (
              <p className="font-body-md text-on-surface-variant text-sm italic">Generating summary…</p>
            ) : (
              <p className="font-body-md text-on-surface leading-relaxed text-sm">
                {aiSummary || fallbackSummary}
              </p>
            )}
          </div>
        </section>

        {/* 1. Booking History */}
        <ClinicSection
          title="Booking History"
          open={openSection === 'bookings'}
          onToggle={() => toggle('bookings')}
          badge={bookingHistory.length ? `${bookingHistory.length}` : null}
        >
          <div className="pt-3 space-y-2">
            {bookingHistory.length === 0 ? (
              <p className="font-body-md text-sm text-on-surface-variant italic">
                No appointments booked yet.
              </p>
            ) : (
              bookingHistory.map((b) => {
                const statusKey = String(b.status || '').toLowerCase();
                const statusCls =
                  BOOKING_STATUS_STYLE[statusKey] ||
                  'bg-surface-container text-on-surface-variant';
                return (
                  <div
                    key={b.id || b.slot_start}
                    className="p-3 bg-surface-container-low rounded-lg border border-outline-variant/30"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-body-md text-sm font-medium text-on-surface">
                          {formatDisplayDateTime(b.slot_start)}
                        </p>
                        <p className="font-body-md text-xs text-on-surface-variant mt-0.5">
                          {b.doctor?.name ? `with ${b.doctor.name}` : 'Doctor —'}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 px-2 py-0.5 rounded-full font-label-sm text-[10px] uppercase tracking-wide ${statusCls}`}
                      >
                        {formatBookingStatus(b.status)}
                      </span>
                    </div>
                    {b.notes ? (
                      <p className="font-body-md text-xs text-on-surface-variant mt-2 border-t border-outline-variant/20 pt-2">
                        {b.notes}
                      </p>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </ClinicSection>

        {/* 2. Investigations done */}
        <ClinicSection
          title="Investigations done"
          open={openSection === 'investigations'}
          onToggle={() => toggle('investigations')}
          badge={invFilledCount ? `${invFilledCount}` : null}
        >
          <div className="pt-3 space-y-1">
            <p className="font-body-md text-xs text-on-surface-variant mb-2">
              Edit lab results, blood work, and ultrasound findings for this patient.
            </p>
            <FieldRow label="Blood group">
              <input
                className={inputCls}
                value={investigations.blood_group}
                onChange={(e) => setInv('blood_group', e.target.value)}
                placeholder="e.g. O+"
              />
            </FieldRow>
            <FieldRow label="Genotype">
              <input
                className={inputCls}
                value={investigations.genotype}
                onChange={(e) => setInv('genotype', e.target.value)}
                placeholder="e.g. AA"
              />
            </FieldRow>
            <FieldRow label="Rhesus">
              <input
                className={inputCls}
                value={investigations.rhesus}
                onChange={(e) => setInv('rhesus', e.target.value)}
                placeholder="e.g. Positive"
              />
            </FieldRow>
            <FieldRow label="RVD status">
              <input
                className={inputCls}
                value={investigations.rvd_status}
                onChange={(e) => setInv('rvd_status', e.target.value)}
                placeholder="e.g. Negative"
              />
            </FieldRow>
            <FieldRow label="VDRL">
              <input
                className={inputCls}
                value={investigations.vdrl}
                onChange={(e) => setInv('vdrl', e.target.value)}
                placeholder="e.g. Non-reactive"
              />
            </FieldRow>
            <FieldRow label="PCV">
              <input
                type="number"
                className={inputCls}
                value={investigations.pcv}
                onChange={(e) => setInv('pcv', e.target.value)}
                placeholder="e.g. 32"
              />
            </FieldRow>
            <FieldRow label="Hep B">
              <input
                className={inputCls}
                value={investigations.hep_b}
                onChange={(e) => setInv('hep_b', e.target.value)}
                placeholder="e.g. Negative"
              />
            </FieldRow>
            <FieldRow label="Hep C">
              <input
                className={inputCls}
                value={investigations.hep_c}
                onChange={(e) => setInv('hep_c', e.target.value)}
                placeholder="e.g. Negative"
              />
            </FieldRow>
            <FieldRow label="Malaria parasite">
              <input
                className={inputCls}
                value={investigations.malaria_parasite}
                onChange={(e) => setInv('malaria_parasite', e.target.value)}
                placeholder="e.g. Negative"
              />
            </FieldRow>
            <FieldRow label="Urinalysis">
              <input
                className={inputCls}
                value={investigations.urinalysis}
                onChange={(e) => setInv('urinalysis', e.target.value)}
                placeholder="e.g. NAD"
              />
            </FieldRow>
            <FieldRow label="RBG">
              <input
                className={inputCls}
                value={investigations.rbg}
                onChange={(e) => setInv('rbg', e.target.value)}
                placeholder="e.g. 5.2"
              />
            </FieldRow>
            <FieldRow label="OGTT">
              <input
                className={inputCls}
                value={investigations.ogtt}
                onChange={(e) => setInv('ogtt', e.target.value)}
                placeholder="Result"
              />
            </FieldRow>
            <FieldRow label="TT history">
              <input
                className={inputCls}
                value={investigations.tetanus_history}
                onChange={(e) => setInv('tetanus_history', e.target.value)}
                placeholder="e.g. TT2 @ 20w"
              />
            </FieldRow>
            <FieldRow label="IPT history">
              <input
                className={inputCls}
                value={investigations.ipt_history}
                onChange={(e) => setInv('ipt_history', e.target.value)}
                placeholder="e.g. IPT1 @ 16w"
              />
            </FieldRow>
            <div className="pt-2 border-t border-outline-variant/25 mt-2">
              <p className="font-label-sm text-on-surface-variant text-xs uppercase mb-2">
                Ultrasound
              </p>
              <FieldRow label="USS date">
                <input
                  type="date"
                  className={inputCls}
                  value={investigations.uss_date}
                  onChange={(e) => setInv('uss_date', e.target.value)}
                />
              </FieldRow>
              <FieldRow label="USS EGA (weeks)">
                <input
                  type="number"
                  className={inputCls}
                  value={investigations.uss_ega_weeks}
                  onChange={(e) => setInv('uss_ega_weeks', e.target.value)}
                  placeholder="weeks"
                />
              </FieldRow>
              <FieldRow label="USS notes">
                <input
                  className={inputCls}
                  value={investigations.uss_notes}
                  onChange={(e) => setInv('uss_notes', e.target.value)}
                  placeholder="Findings…"
                />
              </FieldRow>
            </div>
          </div>
        </ClinicSection>

        {/* 3. Consultation notes */}
        <ClinicSection
          title="Consultation notes"
          open={openSection === 'notes'}
          onToggle={() => toggle('notes')}
          badge={consultationNotes.trim() ? 'saved' : null}
        >
          <div className="pt-3">
            <p className="font-body-md text-xs text-on-surface-variant mb-2">
              Clinical notes for this patient. Once saved, they reappear on later consultations.
            </p>
            <textarea
              value={consultationNotes}
              onChange={(e) => setConsultationNotes(e.target.value)}
              rows={6}
              placeholder="Start typing clinical notes…"
              className="w-full bg-surface-container-low border border-outline rounded-lg p-4 font-body-md text-sm focus:ring-2 focus:ring-primary outline-none resize-none"
            />
          </div>
        </ClinicSection>

        {/* 4. Vitals (end of list) */}
        <ClinicSection
          title="Vitals"
          open={openSection === 'vitals'}
          onToggle={() => toggle('vitals')}
          badge={vitalsLog.length ? `${vitalsLog.length}` : null}
        >
          <div className="pt-3 space-y-3">
            <p className="font-body-md text-xs text-on-surface-variant">
              Pulse rate, respiratory rate, blood pressure, temperature, weight, and height.
            </p>

            {vitalsLog.length === 0 ? (
              <p className="font-body-md text-sm text-on-surface-variant italic">
                No vitals logged yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse min-w-[520px]">
                  <thead>
                    <tr className="text-on-surface-variant text-left border-b border-outline-variant/40">
                      <th className="py-2 pr-2 font-label-sm">Date</th>
                      <th className="py-2 pr-2 font-label-sm">PR</th>
                      <th className="py-2 pr-2 font-label-sm">RR</th>
                      <th className="py-2 pr-2 font-label-sm">BP</th>
                      <th className="py-2 pr-2 font-label-sm">Temp</th>
                      <th className="py-2 pr-2 font-label-sm">Wt</th>
                      <th className="py-2 font-label-sm">Ht</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vitalsLog.map((v) => (
                      <tr key={v.id || v.date} className="border-b border-outline-variant/20">
                        <td className="py-2 pr-2 whitespace-nowrap">{formatDisplayDate(v.date)}</td>
                        <td className="py-2 pr-2">
                          {v.pr != null && v.pr !== '' ? `${v.pr} bpm` : '—'}
                        </td>
                        <td className="py-2 pr-2">
                          {v.rr != null && v.rr !== '' ? `${v.rr}` : '—'}
                        </td>
                        <td className="py-2 pr-2">
                          {v.bp_systolic || v.bp_diastolic
                            ? `${v.bp_systolic || '—'}/${v.bp_diastolic || '—'}`
                            : '—'}
                        </td>
                        <td className="py-2 pr-2">
                          {v.temp_c != null && v.temp_c !== '' ? `${v.temp_c}°C` : '—'}
                        </td>
                        <td className="py-2 pr-2">
                          {v.weight_kg != null && v.weight_kg !== '' ? `${v.weight_kg} kg` : '—'}
                        </td>
                        <td className="py-2">
                          {v.height_cm != null && v.height_cm !== '' ? `${v.height_cm} cm` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowLogVitals((s) => !s)}
              className="w-full bg-primary/10 text-primary border border-primary/30 py-2.5 rounded-lg font-label-sm text-xs hover:bg-primary/15 transition-all flex items-center justify-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Log vital signs
            </button>

            {showLogVitals && (
              <div className="p-3 bg-surface-container-low rounded-lg border border-outline-variant/30 space-y-1">
                <FieldRow label="Date">
                  <input
                    type="date"
                    className={inputCls}
                    value={vitalDraft.date}
                    onChange={(e) => setVitalDraft((d) => ({ ...d, date: e.target.value }))}
                  />
                </FieldRow>
                <FieldRow label="Pulse rate (bpm)">
                  <input
                    type="number"
                    className={inputCls}
                    placeholder="e.g. 86"
                    value={vitalDraft.pr}
                    onChange={(e) => setVitalDraft((d) => ({ ...d, pr: e.target.value }))}
                  />
                </FieldRow>
                <FieldRow label="Respiratory rate">
                  <input
                    type="number"
                    className={inputCls}
                    placeholder="e.g. 18"
                    value={vitalDraft.rr}
                    onChange={(e) => setVitalDraft((d) => ({ ...d, rr: e.target.value }))}
                  />
                </FieldRow>
                <FieldRow label="BP systolic">
                  <input
                    type="number"
                    className={inputCls}
                    placeholder="110"
                    value={vitalDraft.bp_systolic}
                    onChange={(e) => setVitalDraft((d) => ({ ...d, bp_systolic: e.target.value }))}
                  />
                </FieldRow>
                <FieldRow label="BP diastolic">
                  <input
                    type="number"
                    className={inputCls}
                    placeholder="80"
                    value={vitalDraft.bp_diastolic}
                    onChange={(e) => setVitalDraft((d) => ({ ...d, bp_diastolic: e.target.value }))}
                  />
                </FieldRow>
                <FieldRow label="Temperature (°C)">
                  <input
                    type="number"
                    step="0.1"
                    className={inputCls}
                    placeholder="37"
                    value={vitalDraft.temp_c}
                    onChange={(e) => setVitalDraft((d) => ({ ...d, temp_c: e.target.value }))}
                  />
                </FieldRow>
                <FieldRow label="Weight (kg)">
                  <input
                    type="number"
                    className={inputCls}
                    placeholder="80"
                    value={vitalDraft.weight_kg}
                    onChange={(e) => setVitalDraft((d) => ({ ...d, weight_kg: e.target.value }))}
                  />
                </FieldRow>
                <FieldRow label="Height (cm)">
                  <input
                    type="number"
                    className={inputCls}
                    placeholder="169"
                    value={vitalDraft.height_cm}
                    onChange={(e) => setVitalDraft((d) => ({ ...d, height_cm: e.target.value }))}
                  />
                </FieldRow>
                <button
                  type="button"
                  onClick={addVital}
                  className="w-full mt-2 bg-primary text-white py-2 rounded-lg font-label-sm text-xs"
                >
                  Add vital signs
                </button>
              </div>
            )}
          </div>
        </ClinicSection>

        {saveMsg && (
          <p
            className={`font-label-sm text-xs text-center ${
              saveMsg.includes('saved') || saveMsg.includes('Saved')
                ? 'text-primary'
                : 'text-secondary'
            }`}
          >
            {saveMsg}
          </p>
        )}
      </main>

      {/* Sticky footer — no Escalate / Refer */}
      <footer className="fixed bottom-0 inset-x-0 bg-surface/95 backdrop-blur border-t border-outline-variant z-40">
        <div className="max-w-4xl mx-auto w-full p-4 sm:p-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleSaveReview}
            disabled={saving}
            className="col-span-2 bg-primary text-white py-3.5 rounded-lg font-label-sm text-sm hover:opacity-90 transition-all disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save review'}
          </button>
          <button
            type="button"
            onClick={handleMarkSeen}
            className="col-span-2 sm:col-span-1 bg-surface-container-high text-on-surface py-3 rounded-lg font-label-sm text-sm hover:bg-surface-container-highest transition-all border border-outline/20"
          >
            {appointment_id ? 'Mark as Seen' : 'Back'}
          </button>
          {appointment_id ? (
            <button
              type="button"
              onClick={() => navigate('/provider')}
              className="col-span-2 sm:col-span-1 bg-surface-container-high text-on-surface py-3 rounded-lg font-label-sm text-sm border border-outline/20"
            >
              Back to queue
            </button>
          ) : null}
        </div>
      </footer>
    </div>
  );
};

export default PatientDetailPanel;
