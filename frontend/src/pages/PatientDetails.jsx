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

const DIPSTICK = ['none', '+', '++', '+++'];
const LIE_OPTS = ['Transverse', 'Oblique', 'Longitudinal', 'Indeterminate'];
const PRES_OPTS = ['Cephalic', 'Breech', 'Face', 'Shoulder', 'Indeterminate'];

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

/** Expandable clinic section */
const ClinicSection = ({ title, open, onToggle, children, badge }) => (
  <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl overflow-hidden">
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
  const [openSection, setOpenSection] = useState('vitals');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Clinical review state
  const [vitalsLog, setVitalsLog] = useState([]);
  const [showLogVitals, setShowLogVitals] = useState(false);
  const [vitalDraft, setVitalDraft] = useState({
    date: new Date().toISOString().slice(0, 10),
    bp_systolic: '',
    bp_diastolic: '',
    pr: '',
    weight_kg: '',
    height_cm: '',
    rr: '',
    temp_c: '',
    protein: 'none',
    glucose: 'none',
  });

  const [medications, setMedications] = useState('');
  const [iptDoses, setIptDoses] = useState([{ dose: '', ga_weeks: '' }]);
  const [ttDoses, setTtDoses] = useState([{ dose: '', ga_weeks: '' }]);

  const [scansLog, setScansLog] = useState([]);
  const [scanDraft, setScanDraft] = useState({ date: '', ga_weeks: '', notes: '' });
  const [showAddScan, setShowAddScan] = useState(false);

  const [exam, setExam] = useState({
    lie: '',
    presentation: '',
    sfh: '',
    fetal_heart: '',
  });

  const [importantRemarks, setImportantRemarks] = useState('');

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

  // Hydrate review fields from pregnancy + intake
  useEffect(() => {
    if (!fullPatient) {
      if (!isReal) {
        // Demo seed
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
            protein: 'none',
            glucose: '+',
          },
        ]);
        setMedications('Labetalol 200 mg BD, Folic acid');
        setIptDoses([{ dose: 'IPT1', ga_weeks: '16' }]);
        setTtDoses([{ dose: 'TT2', ga_weeks: '20' }]);
        setScansLog([
          { id: 'demo-s1', date: '2026-05-01', ga_weeks: 7, notes: 'Confirmed IUP, singleton' },
        ]);
        setExam({ lie: 'Longitudinal', presentation: 'Cephalic', sfh: '24 cm', fetal_heart: '148 bpm' });
        setImportantRemarks('');
      }
      return;
    }

    const pr = fullPatient.pregnancies?.[0] || {};
    const intakeMap = {};
    (fullPatient.intake_responses || []).forEach((r) => {
      if (r?.question_key) intakeMap[r.question_key] = r.answer;
    });

    const rawVitals = Array.isArray(pr.vitals_log) ? pr.vitals_log : [];
    setVitalsLog(rawVitals);

    const dv = pr.drugs_vaccines && typeof pr.drugs_vaccines === 'object' ? pr.drugs_vaccines : {};
    const medsFromIntake =
      ans(intakeMap, 'pregnancy_medications') || ans(intakeMap, 'other_medications') || '';
    setMedications(dv.medications || medsFromIntake || '');

    if (Array.isArray(dv.ipt) && dv.ipt.length) {
      setIptDoses(dv.ipt.map((x) => ({ dose: x.dose || '', ga_weeks: x.ga_weeks != null ? String(x.ga_weeks) : '' })));
    } else if (pr.ipt_history) {
      setIptDoses([{ dose: String(pr.ipt_history), ga_weeks: '' }]);
    } else {
      setIptDoses([{ dose: '', ga_weeks: '' }]);
    }

    if (Array.isArray(dv.tt) && dv.tt.length) {
      setTtDoses(dv.tt.map((x) => ({ dose: x.dose || '', ga_weeks: x.ga_weeks != null ? String(x.ga_weeks) : '' })));
    } else if (pr.tetanus_history) {
      setTtDoses([{ dose: String(pr.tetanus_history), ga_weeks: '' }]);
    } else {
      setTtDoses([{ dose: '', ga_weeks: '' }]);
    }

    let scans = Array.isArray(pr.scans_log) ? [...pr.scans_log] : [];
    if (!scans.length && (pr.uss_date || pr.uss_ega_weeks || pr.uss_notes)) {
      scans = [
        {
          id: 'uss-seed',
          date: toDateInput(pr.uss_date),
          ga_weeks: pr.uss_ega_weeks ?? '',
          notes: pr.uss_notes || '',
        },
      ];
    }
    setScansLog(scans);

    const ex = pr.examination && typeof pr.examination === 'object' ? pr.examination : {};
    setExam({
      lie: ex.lie || '',
      presentation: ex.presentation || '',
      sfh: ex.sfh || '',
      fetal_heart: ex.fetal_heart || '',
    });

    // Persistent remarks — always show prior value
    setImportantRemarks(pr.important_remarks || '');
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
    preg.blood_group || passedPatient?.bloodType || passedPatient?.blood_group || (isReal ? '—' : MOCK.bloodType);
  const patientCode =
    fullPatient?.patient_code || formatPatientCode(fullPatient?.id || passedPatient?.id);
  const weeks = liveEga != null && !Number.isNaN(liveEga) ? liveEga : null;

  const fallbackSummary = isReal
    ? `Mrs. ${name}, ${age != null ? age : 'age unknown'}, ${gpStr || 'G?P?'}, currently ${weeks != null ? `${weeks} weeks` : 'EGA unknown'}. Risk: ${risk}.`
    : `Mrs. ${MOCK.name}, ${MOCK.age}, ${formatGP(MOCK.gravida, MOCK.para, MOCK.childrenAlive)}, currently 24 weeks. Presenting with severe headache, blurred vision. Known hypertensive. Risk: HIGH. Last BP: 160/100.`;

  const toggle = (key) => setOpenSection((o) => (o === key ? null : key));

  // ── Actions ──────────────────────────────────────────────────────────────
  const addVital = () => {
    if (!vitalDraft.bp_systolic && !vitalDraft.weight_kg && !vitalDraft.pr) return;
    const entry = { id: newId(), ...vitalDraft };
    setVitalsLog((list) => [entry, ...list]);
    setVitalDraft({
      date: new Date().toISOString().slice(0, 10),
      bp_systolic: '',
      bp_diastolic: '',
      pr: '',
      weight_kg: '',
      height_cm: '',
      rr: '',
      temp_c: '',
      protein: 'none',
      glucose: 'none',
    });
    setShowLogVitals(false);
  };

  const addScan = () => {
    if (!scanDraft.date && !scanDraft.ga_weeks && !scanDraft.notes) return;
    setScansLog((list) => [...list, { id: newId(), ...scanDraft }]);
    setScanDraft({ date: '', ga_weeks: '', notes: '' });
    setShowAddScan(false);
  };

  const buildReviewPayload = () => ({
    vitals_log: vitalsLog,
    drugs_vaccines: {
      medications: medications || null,
      ipt: iptDoses.filter((d) => d.dose || d.ga_weeks),
      tt: ttDoses.filter((d) => d.dose || d.ga_weeks),
    },
    scans_log: scansLog,
    examination: exam,
    important_remarks: importantRemarks || null,
    // Keep latest USS fields in sync with most recent scan
    ...(scansLog.length
      ? {
          uss_date: scansLog[scansLog.length - 1].date || undefined,
          uss_ega_weeks:
            scansLog[scansLog.length - 1].ga_weeks !== ''
              ? Number(scansLog[scansLog.length - 1].ga_weeks)
              : undefined,
          uss_notes: scansLog[scansLog.length - 1].notes || undefined,
        }
      : {}),
    // Keep string IPT/TT history readable
    ipt_history: iptDoses
      .filter((d) => d.dose)
      .map((d) => `${d.dose}${d.ga_weeks ? ` @ ${d.ga_weeks}w` : ''}`)
      .join('; ') || undefined,
    tetanus_history: ttDoses
      .filter((d) => d.dose)
      .map((d) => `${d.dose}${d.ga_weeks ? ` @ ${d.ga_weeks}w` : ''}`)
      .join('; ') || undefined,
  });

  const handleSaveReview = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      if (isReal) {
        const payload = buildReviewPayload();
        Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
        await updateDoctorPregnancy(passedPatient.id, payload);
        // Also attach remarks snapshot to the visit if opened from queue
        if (appointment_id && importantRemarks.trim()) {
          try {
            await saveVisitNotes(appointment_id, importantRemarks, { complete: false });
          } catch {
            /* non-blocking */
          }
        }
        await reloadPatient();
      }
      // Local draft backup
      try {
        localStorage.setItem(
          `mamacare_review_${passedPatient?.id || 'demo'}`,
          JSON.stringify({
            vitalsLog,
            medications,
            iptDoses,
            ttDoses,
            scansLog,
            exam,
            importantRemarks,
          })
        );
      } catch {
        /* ignore */
      }
      setSaveMsg('Review saved');
    } catch (e) {
      try {
        localStorage.setItem(
          `mamacare_review_${passedPatient?.id || 'demo'}`,
          JSON.stringify({
            vitalsLog,
            medications,
            iptDoses,
            ttDoses,
            scansLog,
            exam,
            importantRemarks,
          })
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
        importantRemarks.trim() || 'Appointment completed.',
        { complete: true }
      );
      navigate('/provider');
    } catch {
      navigate('/provider');
    }
  };

  return (
    <div className="bg-background text-on-surface font-body-md min-h-screen flex justify-end overflow-hidden">
      <div className="grain-overlay" />

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

      <aside className="w-full md:w-[500px] bg-surface h-screen shadow-2xl flex flex-col relative z-50 border-l border-outline-variant">
        {/* Header */}
        <header className="bg-[#1A1A18] text-white p-6 shrink-0">
          <div className="flex justify-between items-start mb-4">
            <button
              type="button"
              onClick={() => navigate('/provider')}
              className="text-white/60 hover:text-white transition-colors"
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
            <div>
              <h2 className="font-headline-lg text-2xl mb-0.5">{name}</h2>
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
        </header>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
          {/* AI Pre-Consult Summary */}
          <section>
            <h3 className="font-label-sm text-on-surface-variant uppercase tracking-widest mb-3">
              AI Pre-Consult Summary
            </h3>
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

          {/* ── Booking history (appointments) ───────────────────────────── */}
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
                            {b.slot_end
                              ? ` · ends ${formatDisplayDateTime(b.slot_end).split(', ').pop() || ''}`
                              : ''}
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

          {/* ── Vitals ───────────────────────────────────────────────────── */}
          <ClinicSection
            title="Vitals"
            open={openSection === 'vitals'}
            onToggle={() => toggle('vitals')}
            badge={vitalsLog.length ? `${vitalsLog.length}` : null}
          >
            <div className="pt-3 overflow-x-auto">
              {vitalsLog.length === 0 ? (
                <p className="font-body-md text-sm text-on-surface-variant italic mb-2">
                  No vitals logged yet.
                </p>
              ) : (
                <table className="w-full text-xs border-collapse min-w-[480px]">
                  <thead>
                    <tr className="text-on-surface-variant text-left border-b border-outline-variant/40">
                      <th className="py-2 pr-2 font-label-sm">Date</th>
                      <th className="py-2 pr-2 font-label-sm">BP/PR</th>
                      <th className="py-2 pr-2 font-label-sm">Wt</th>
                      <th className="py-2 pr-2 font-label-sm">Ht</th>
                      <th className="py-2 pr-2 font-label-sm">RR</th>
                      <th className="py-2 pr-2 font-label-sm">Temp</th>
                      <th className="py-2 font-label-sm">Urinalysis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vitalsLog.map((v) => (
                      <tr key={v.id || v.date} className="border-b border-outline-variant/20">
                        <td className="py-2 pr-2 whitespace-nowrap">{formatDisplayDate(v.date)}</td>
                        <td className="py-2 pr-2">
                          {v.bp_systolic || v.bp_diastolic
                            ? `${v.bp_systolic || '—'}/${v.bp_diastolic || '—'} mmHg`
                            : '—'}
                          {v.pr ? (
                            <span className="block text-on-surface-variant">{v.pr} bpm</span>
                          ) : null}
                        </td>
                        <td className="py-2 pr-2">{v.weight_kg != null && v.weight_kg !== '' ? `${v.weight_kg}` : '—'}</td>
                        <td className="py-2 pr-2">{v.height_cm != null && v.height_cm !== '' ? `${v.height_cm}` : '—'}</td>
                        <td className="py-2 pr-2">{v.rr != null && v.rr !== '' ? `${v.rr}` : '—'}</td>
                        <td className="py-2 pr-2">{v.temp_c != null && v.temp_c !== '' ? `${v.temp_c}` : '—'}</td>
                        <td className="py-2">
                          <span className="block">G: {v.glucose || '—'}</span>
                          <span className="block">P: {v.protein || '—'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowLogVitals((s) => !s)}
              className="w-full mt-2 bg-primary/10 text-primary border border-primary/30 py-2.5 rounded-lg font-label-sm text-xs hover:bg-primary/15 transition-all flex items-center justify-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Log vitals
            </button>

            {showLogVitals && (
              <div className="mt-2 p-3 bg-surface-container-low rounded-lg border border-outline-variant/30 space-y-1">
                <FieldRow label="Date done">
                  <input
                    type="date"
                    className={inputCls}
                    value={vitalDraft.date}
                    onChange={(e) => setVitalDraft((d) => ({ ...d, date: e.target.value }))}
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
                <FieldRow label="PR (bpm)">
                  <input
                    type="number"
                    className={inputCls}
                    placeholder="86"
                    value={vitalDraft.pr}
                    onChange={(e) => setVitalDraft((d) => ({ ...d, pr: e.target.value }))}
                  />
                </FieldRow>
                <FieldRow label="Wt (kg)">
                  <input
                    type="number"
                    className={inputCls}
                    placeholder="80"
                    value={vitalDraft.weight_kg}
                    onChange={(e) => setVitalDraft((d) => ({ ...d, weight_kg: e.target.value }))}
                  />
                </FieldRow>
                <FieldRow label="Ht (cm)">
                  <input
                    type="number"
                    className={inputCls}
                    placeholder="169"
                    value={vitalDraft.height_cm}
                    onChange={(e) => setVitalDraft((d) => ({ ...d, height_cm: e.target.value }))}
                  />
                </FieldRow>
                <FieldRow label="RR (cpm)">
                  <input
                    type="number"
                    className={inputCls}
                    placeholder="18"
                    value={vitalDraft.rr}
                    onChange={(e) => setVitalDraft((d) => ({ ...d, rr: e.target.value }))}
                  />
                </FieldRow>
                <FieldRow label="Temp (°C)">
                  <input
                    type="number"
                    step="0.1"
                    className={inputCls}
                    placeholder="37"
                    value={vitalDraft.temp_c}
                    onChange={(e) => setVitalDraft((d) => ({ ...d, temp_c: e.target.value }))}
                  />
                </FieldRow>
                <FieldRow label="Protein">
                  <select
                    className={inputCls}
                    value={vitalDraft.protein}
                    onChange={(e) => setVitalDraft((d) => ({ ...d, protein: e.target.value }))}
                  >
                    {DIPSTICK.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </FieldRow>
                <FieldRow label="Glucose">
                  <select
                    className={inputCls}
                    value={vitalDraft.glucose}
                    onChange={(e) => setVitalDraft((d) => ({ ...d, glucose: e.target.value }))}
                  >
                    {DIPSTICK.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </FieldRow>
                <button
                  type="button"
                  onClick={addVital}
                  className="w-full mt-2 bg-primary text-white py-2 rounded-lg font-label-sm text-xs"
                >
                  Add to vitals table
                </button>
              </div>
            )}
          </ClinicSection>

          {/* ── Drugs and vaccination ────────────────────────────────────── */}
          <ClinicSection
            title="Drugs and vaccination given"
            open={openSection === 'drugs'}
            onToggle={() => toggle('drugs')}
          >
            <div className="pt-3 space-y-3">
              <div>
                <p className="font-label-sm text-on-surface-variant text-xs uppercase mb-1">
                  All prescribed medications
                </p>
                <textarea
                  value={medications}
                  onChange={(e) => setMedications(e.target.value)}
                  rows={3}
                  placeholder="e.g. Labetalol 200 mg BD, Folic acid, FeSO4…"
                  className="w-full bg-surface-container-low border border-outline rounded-lg p-3 font-body-md text-sm focus:ring-2 focus:ring-primary outline-none resize-none"
                />
              </div>

              <div>
                <p className="font-label-sm text-on-surface-variant text-xs uppercase mb-2">
                  IPT (malaria) — dose & GA received
                </p>
                {iptDoses.map((row, i) => (
                  <div key={`ipt-${i}`} className="flex gap-2 mb-2">
                    <input
                      className={`${inputCls} text-left`}
                      placeholder="e.g. IPT1"
                      value={row.dose}
                      onChange={(e) => {
                        const next = [...iptDoses];
                        next[i] = { ...next[i], dose: e.target.value };
                        setIptDoses(next);
                      }}
                    />
                    <input
                      type="number"
                      className={`${inputCls} w-24 shrink-0`}
                      placeholder="GA wks"
                      value={row.ga_weeks}
                      onChange={(e) => {
                        const next = [...iptDoses];
                        next[i] = { ...next[i], ga_weeks: e.target.value };
                        setIptDoses(next);
                      }}
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setIptDoses((d) => [...d, { dose: '', ga_weeks: '' }])}
                  className="text-primary font-label-sm text-xs underline"
                >
                  + Add IPT dose
                </button>
              </div>

              <div>
                <p className="font-label-sm text-on-surface-variant text-xs uppercase mb-2">
                  Tetanus toxoid (TT) — dose & GA received
                </p>
                {ttDoses.map((row, i) => (
                  <div key={`tt-${i}`} className="flex gap-2 mb-2">
                    <input
                      className={`${inputCls} text-left`}
                      placeholder="e.g. TT2"
                      value={row.dose}
                      onChange={(e) => {
                        const next = [...ttDoses];
                        next[i] = { ...next[i], dose: e.target.value };
                        setTtDoses(next);
                      }}
                    />
                    <input
                      type="number"
                      className={`${inputCls} w-24 shrink-0`}
                      placeholder="GA wks"
                      value={row.ga_weeks}
                      onChange={(e) => {
                        const next = [...ttDoses];
                        next[i] = { ...next[i], ga_weeks: e.target.value };
                        setTtDoses(next);
                      }}
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setTtDoses((d) => [...d, { dose: '', ga_weeks: '' }])}
                  className="text-primary font-label-sm text-xs underline"
                >
                  + Add TT dose
                </button>
              </div>
            </div>
          </ClinicSection>

          {/* ── Scans ────────────────────────────────────────────────────── */}
          <ClinicSection
            title="Scans done during pregnancy"
            open={openSection === 'scans'}
            onToggle={() => toggle('scans')}
            badge={scansLog.length ? `${scansLog.length}` : null}
          >
            <div className="pt-3 space-y-2">
              {scansLog.length === 0 ? (
                <p className="font-body-md text-sm text-on-surface-variant italic">No scans recorded.</p>
              ) : (
                scansLog.map((s) => (
                  <div
                    key={s.id || `${s.date}-${s.ga_weeks}`}
                    className="p-3 bg-surface-container-low rounded-lg border border-outline-variant/30"
                  >
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="font-medium">{formatDisplayDate(s.date)}</span>
                      <span className="text-on-surface-variant">
                        {s.ga_weeks != null && s.ga_weeks !== '' ? `GA ${s.ga_weeks} wks` : 'GA —'}
                      </span>
                    </div>
                    {s.notes ? (
                      <p className="font-body-md text-xs text-on-surface-variant mt-1">{s.notes}</p>
                    ) : null}
                  </div>
                ))
              )}

              <button
                type="button"
                onClick={() => setShowAddScan((s) => !s)}
                className="w-full bg-primary/10 text-primary border border-primary/30 py-2.5 rounded-lg font-label-sm text-xs"
              >
                + Add scan
              </button>

              {showAddScan && (
                <div className="p-3 bg-surface-container-low rounded-lg border border-outline-variant/30 space-y-1">
                  <FieldRow label="Date scan done">
                    <input
                      type="date"
                      className={inputCls}
                      value={scanDraft.date}
                      onChange={(e) => setScanDraft((d) => ({ ...d, date: e.target.value }))}
                    />
                  </FieldRow>
                  <FieldRow label="Gestational age">
                    <input
                      type="number"
                      className={inputCls}
                      placeholder="weeks"
                      value={scanDraft.ga_weeks}
                      onChange={(e) => setScanDraft((d) => ({ ...d, ga_weeks: e.target.value }))}
                    />
                  </FieldRow>
                  <FieldRow label="Notes">
                    <input
                      className={inputCls}
                      placeholder="Findings…"
                      value={scanDraft.notes}
                      onChange={(e) => setScanDraft((d) => ({ ...d, notes: e.target.value }))}
                    />
                  </FieldRow>
                  <button
                    type="button"
                    onClick={addScan}
                    className="w-full mt-2 bg-primary text-white py-2 rounded-lg font-label-sm text-xs"
                  >
                    Save scan
                  </button>
                </div>
              )}
            </div>
          </ClinicSection>

          {/* ── Examination ──────────────────────────────────────────────── */}
          <ClinicSection
            title="Examination"
            open={openSection === 'exam'}
            onToggle={() => toggle('exam')}
          >
            <div className="pt-3 space-y-1">
              <FieldRow label="Lie">
                <select
                  className={inputCls}
                  value={exam.lie}
                  onChange={(e) => setExam((x) => ({ ...x, lie: e.target.value }))}
                >
                  <option value="">—</option>
                  {LIE_OPTS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </FieldRow>
              <FieldRow label="Presentation">
                <select
                  className={inputCls}
                  value={exam.presentation}
                  onChange={(e) => setExam((x) => ({ ...x, presentation: e.target.value }))}
                >
                  <option value="">—</option>
                  {PRES_OPTS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </FieldRow>
              <FieldRow label="SFH">
                <input
                  className={inputCls}
                  placeholder="e.g. 28 cm"
                  value={exam.sfh}
                  onChange={(e) => setExam((x) => ({ ...x, sfh: e.target.value }))}
                />
              </FieldRow>
              <FieldRow label="Fetal heart">
                <input
                  className={inputCls}
                  placeholder="e.g. 148 bpm"
                  value={exam.fetal_heart}
                  onChange={(e) => setExam((x) => ({ ...x, fetal_heart: e.target.value }))}
                />
              </FieldRow>
            </div>
          </ClinicSection>

          {/* ── Important Remarks ────────────────────────────────────────── */}
          <ClinicSection
            title="Important Remarks"
            open={openSection === 'remarks'}
            onToggle={() => toggle('remarks')}
            badge={importantRemarks.trim() ? 'saved' : null}
          >
            <div className="pt-3">
              <p className="font-body-md text-xs text-on-surface-variant mb-2">
                Additional notes on review. Once entered, these appear at every consultation and stay editable.
              </p>
              <textarea
                value={importantRemarks}
                onChange={(e) => setImportantRemarks(e.target.value)}
                rows={5}
                placeholder="Start typing important remarks…"
                className="w-full bg-surface-container-low border border-outline rounded-lg p-4 font-body-md text-sm focus:ring-2 focus:ring-primary outline-none resize-none"
              />
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
        </div>

        {/* Action Footer */}
        <footer className="p-5 bg-surface border-t border-outline-variant grid grid-cols-2 gap-3 shrink-0">
          <button
            type="button"
            className="col-span-2 bg-secondary text-white py-4 rounded-lg font-label-sm text-sm hover:brightness-95 transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined">emergency_share</span>
            ESCALATE TO EMERGENCY
          </button>
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
            className="bg-surface-container-high text-on-surface py-3 rounded-lg font-label-sm text-sm hover:bg-surface-container-highest transition-all border border-outline/20"
          >
            {appointment_id ? 'Mark as Seen' : 'Back'}
          </button>
          <button
            type="button"
            className="bg-surface-container-high text-on-surface py-3 rounded-lg font-label-sm text-sm border border-outline/20"
          >
            Refer to Specialist
          </button>
        </footer>
      </aside>
    </div>
  );
};

export default PatientDetailPanel;
