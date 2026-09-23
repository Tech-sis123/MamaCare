import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  getPatientSummary,
  saveVisitNotes,
  getDoctorPatientDetail,
  updateDoctorPregnancy,
} from '../lib/api';
import { isDoctorAuthenticated } from '../lib/auth';
import { readConsultationDraft, writeConsultationDraft } from '../lib/consultationDraft';
import {
  emptyInvestigations,
  mapPregnancyToInvestigations,
  migrateInvestigationsDraft,
  buildInvestigationsPayload,
  countFilledInvestigations,
  splitAboRh,
  formatBloodType,
} from '../lib/investigations';
import BookingInvestigations from './BookingInvestigations';
import ConsultationNotes from './ConsultationNotes';
import PatientSelfReported from './PatientSelfReported';
import {
  emptyConsult,
  mapPregnancyToConsult,
  migrateConsultDraft,
  buildConsultPayload,
  countFilledConsult,
} from '../lib/consultationNotes';

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
  if (alive != null && !Number.isNaN(Number(alive))) s += ` (${Number(alive)}A)`;
  return s;
};

const withGpAlive = (text, gp) => {
  if (!text || !gp) return text;
  return text.replace(/G\??\d*\s*P\??\d*(?:\s*\(\d+A\))?/, gp);
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

const ans = (map, key) => {
  const v = map[key];
  if (v == null) return null;
  if (typeof v === 'object') return v;
  return String(v);
};

const emptyBooking = () => ({
  booking_weight: '',
  booking_height: '',
  booking_bp_systolic: '',
  booking_bp_diastolic: '',
  blood_group: '',
  genotype: '',
  rhesus: '',
  booking_ga_weeks: '',
  booked_anc: null,
  booked_anc_facility: '',
  booking_date: '',
});

const bookingHasAnyValue = (b) => {
  if (!b) return false;
  return Object.entries(b).some(([k, v]) => {
    if (k === 'booked_anc') return v === true || v === false;
    return v != null && String(v).trim() !== '';
  });
};

const numOrNull = (v) => {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

/** Expandable clinic section */
const ClinicLinkRow = ({ title, badge, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full bg-white border border-outline-variant/40 rounded-xl overflow-hidden shadow-sm flex items-center justify-between p-4 text-left hover:bg-surface-container-low transition-colors"
  >
    <span className="font-label-sm text-on-surface font-semibold text-sm flex items-center gap-2">
      {title}
      {badge != null && badge !== '' && (
        <span className="font-label-sm text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
          {badge}
        </span>
      )}
    </span>
    <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
  </button>
);

const ClinicSection = ({ title, open, onToggle, children, badge, headerRight }) => (
  <div className="bg-white border border-outline-variant/40 rounded-xl overflow-hidden shadow-sm">
    <div className="flex items-center gap-2 pr-2">
      <button
        type="button"
        onClick={onToggle}
        className="flex-1 flex items-center justify-between p-4 text-left hover:bg-surface-container-low transition-colors min-w-0"
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
      {headerRight ? <div className="shrink-0 pr-2">{headerRight}</div> : null}
    </div>
    {open && (
      <div className="px-4 pb-4 border-t border-outline-variant/25 space-y-3">
        {children}
      </div>
    )}
  </div>
);

const FieldRow = ({ label, children }) => (
  <div className="flex items-center justify-between gap-3 py-1.5">
    <label className="font-label-sm text-on-surface-variant text-xs uppercase shrink-0 max-w-[45%]">
      {label}
    </label>
    <div className="w-[55%] flex justify-end">{children}</div>
  </div>
);

const inputCls =
  'bg-surface-container-low text-sm px-2 py-1.5 rounded-lg w-full text-right text-on-surface border border-outline/20 focus:border-primary outline-none';

const ynBtnCls = (active) =>
  `px-3 py-1.5 rounded-lg text-xs font-label-sm border transition-colors ${
    active
      ? 'bg-primary text-white border-primary'
      : 'bg-surface-container-low text-on-surface border-outline/20 hover:border-primary/40'
  }`;

const providerHomePath = (fromTab) => {
  if (fromTab && fromTab !== 'queue') return `/provider?tab=${encodeURIComponent(fromTab)}`;
  return '/provider';
};

const PatientDetailPanel = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const queryPatientId = searchParams.get('id') || searchParams.get('patient_id');

  const { patient: passedPatient, appointment_id, fromTab: fromTabState } = location.state || {};
  const [directPatient, setDirectPatient] = useState(null);
  const [loadingDirect, setLoadingDirect] = useState(false);

  const fromTab = fromTabState || (() => {
    try { return sessionStorage.getItem('mc_provider_tab'); } catch { return null; }
  })();
  const goBackToProvider = () => navigate(providerHomePath(fromTab));

  useEffect(() => {
    if (!passedPatient && queryPatientId) {
      if (!isDoctorAuthenticated()) {
        navigate('/provider', { replace: true });
        return;
      }
      setLoadingDirect(true);
      getDoctorPatientDetail(queryPatientId)
        .then((r) => {
          if (r.data?.patient) {
            setDirectPatient(r.data.patient);
            setFullPatient(r.data.patient);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingDirect(false));
    }
  }, [passedPatient, queryPatientId, navigate]);

  const activePatient = passedPatient || directPatient;
  const isReal =
    !!activePatient?.id &&
    typeof activePatient.id === 'string' &&
    activePatient.id.length > 8;

  const [fullPatient, setFullPatient] = useState(null);
  const [aiSummary, setAiSummary] = useState('');
  const [riskFlags, setRiskFlags] = useState([]);
  const [incompleteFlags, setIncompleteFlags] = useState([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [openSection, setOpenSection] = useState('bookings');
  const [clinicScreen, setClinicScreen] = useState('chart');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [hydrated, setHydrated] = useState(false);

  const [booking, setBooking] = useState(emptyBooking);
  const [showBookingForm, setShowBookingForm] = useState(false);

  const [investigations, setInvestigations] = useState(emptyInvestigations);
  const [consult, setConsult] = useState(emptyConsult);

  const patientKey = activePatient?.id || 'demo';
  const skipNextPersist = useRef(true);
  const persistInFlight = useRef(false);
  const persistToServerRef = useRef(async () => {});
  const stateRef = useRef({ booking, investigations, consult });
  stateRef.current = { booking, investigations, consult };

  const reloadPatient = useCallback(() => {
    if (!isReal) return Promise.resolve();
    return getDoctorPatientDetail(activePatient.id)
      .then((r) => setFullPatient(r.data?.patient || null))
      .catch(() => {});
  }, [isReal, activePatient?.id]);

  useEffect(() => {
    if (!isReal) return;
    reloadPatient();
  }, [isReal, activePatient?.id, reloadPatient]);

  useEffect(() => {
    if (!isReal) return;
    setLoadingSummary(true);
    getPatientSummary(activePatient.id)
      .then((r) => {
        setAiSummary(r.data?.summary || '');
        const clinical = Array.isArray(r.data?.risk_reasons) ? r.data.risk_reasons : [];
        const incomplete = Array.isArray(r.data?.incomplete_data) ? r.data.incomplete_data : [];
        const flags = Array.isArray(r.data?.flags) ? r.data.flags : [];
        setRiskFlags(clinical.length ? clinical : flags);
        setIncompleteFlags(incomplete);
      })
      .catch(() => {})
      .finally(() => setLoadingSummary(false));
  }, [isReal, activePatient?.id]);

  // Hydrate from pregnancy + local draft (draft wins so outages don't drop work)
  useEffect(() => {
    const applyDraft = (serverBooking, serverInv, serverConsult) => {
      const draft = readConsultationDraft(patientKey);
      let nextBooking = serverBooking;
      let nextInv = migrateInvestigationsDraft(serverInv);
      let nextConsult = migrateConsultDraft(serverConsult);
      let draftDiffers = false;
      if (draft?.data) {
        if (draft.data.booking) nextBooking = { ...serverBooking, ...draft.data.booking };
        if (draft.data.investigations) {
          nextInv = migrateInvestigationsDraft({ ...serverInv, ...draft.data.investigations });
        }
        if (draft.data.consult) {
          nextConsult = migrateConsultDraft(
            { ...serverConsult, ...draft.data.consult },
            draft.data.consultationNotes
          );
        } else if (typeof draft.data.consultationNotes === 'string') {
          nextConsult = { ...nextConsult, important_remarks: draft.data.consultationNotes };
        }
        draftDiffers =
          JSON.stringify({
            b: draft.data.booking,
            i: draft.data.investigations,
            c: draft.data.consult || draft.data.consultationNotes,
          }) !==
          JSON.stringify({ b: serverBooking, i: serverInv, c: serverConsult });
      }
      setBooking(nextBooking);
      setShowBookingForm(bookingHasAnyValue(nextBooking));
      setInvestigations(nextInv);
      setConsult(nextConsult);
      skipNextPersist.current = !draftDiffers;
      setHydrated(true);
    };

    if (!fullPatient) {
      if (!isReal) {
        const abo = splitAboRh('O+', 'Positive');
        const demo = {
          ...emptyBooking(),
          booking_weight: '68',
          booking_height: '162',
          booking_bp_systolic: '110',
          booking_bp_diastolic: '70',
          blood_group: abo.blood_group,
          genotype: 'AA',
          rhesus: abo.rhesus || '+',
          booking_ga_weeks: '16',
          booked_anc: false,
          booked_anc_facility: '',
          booking_date: '2026-04-12',
        };
        applyDraft(
          demo,
          { ...emptyInvestigations(), pcv: '32', hiv: 'Negative' },
          mapPregnancyToConsult({
            vitals_log: [
              {
                date: '2026-07-06',
                bp_systolic: '110',
                bp_diastolic: '80',
                pr: '86',
                weight_kg: '68',
                height_cm: '162',
                rr: '18',
                temp_c: '36.7',
                protein: 'none',
                glucose: 'none',
              },
            ],
          })
        );
      }
      return;
    }

    const pr = fullPatient.pregnancies?.[0] || {};
    const abo = splitAboRh(pr.blood_group || '', pr.rhesus || '');
    const nextBooking = {
      booking_weight: pr.booking_weight != null ? String(pr.booking_weight) : '',
      booking_height: pr.booking_height != null ? String(pr.booking_height) : '',
      booking_bp_systolic: pr.booking_bp_systolic != null ? String(pr.booking_bp_systolic) : '',
      booking_bp_diastolic: pr.booking_bp_diastolic != null ? String(pr.booking_bp_diastolic) : '',
      blood_group: abo.blood_group,
      genotype: pr.genotype || '',
      rhesus: abo.rhesus,
      booking_ga_weeks: pr.booking_ga_weeks != null ? String(pr.booking_ga_weeks) : '',
      booked_anc: typeof pr.booked_anc === 'boolean' ? pr.booked_anc : null,
      booked_anc_facility: pr.booked_anc_facility || '',
      booking_date: toDateInput(pr.booking_date),
    };
    applyDraft(nextBooking, mapPregnancyToInvestigations(pr), mapPregnancyToConsult(pr));
  }, [fullPatient, isReal, patientKey]);

  // ── Derived display ──────────────────────────────────────────────────────
  const preg = fullPatient?.pregnancies?.[0] || {};

  const intakeMap = {};
  (fullPatient?.intake_responses || []).forEach((r) => {
    if (r?.question_key) intakeMap[r.question_key] = r.answer;
  });

  let childrenAlive = null;
  if (intakeMap.children_alive != null && intakeMap.children_alive !== '') {
    const n = Number(intakeMap.children_alive);
    if (!Number.isNaN(n)) childrenAlive = n;
  }
  let childEntries = 0;
  let aliveCount = 0;
  for (let i = 0; i < 20; i += 1) {
    const state = ans(intakeMap, `child_${i}_state_now`);
    if (state == null || state === '') continue;
    childEntries += 1;
    const s = String(state).toLowerCase();
    if (s.includes('alive') || s === 'well' || s === 'healthy' || s === 'living') {
      aliveCount += 1;
    }
  }
  if (childrenAlive === null && childEntries > 0) {
    childrenAlive = aliveCount;
  }

  const liveEga = preg.lmp_date
    ? calcEgaWeeks(preg.lmp_date)
    : activePatient?.ega_weeks != null
      ? Number(activePatient.ega_weeks)
      : null;

  const gravida = preg.gravidity ?? activePatient?.gravida ?? (isReal ? null : MOCK.gravida);
  const para = preg.parity ?? activePatient?.para ?? (isReal ? null : MOCK.para);
  if (childrenAlive === null && para === 0) {
    childrenAlive = 0;
  }
  if (!isReal && childrenAlive === null) childrenAlive = MOCK.childrenAlive;

  const gpStr = formatGP(gravida, para, childrenAlive);

  const name = fullPatient?.name || activePatient?.name || MOCK.name;
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const risk = (
    activePatient?.risk_tier ||
    fullPatient?.risk_assessments?.[0]?.tier ||
    activePatient?.risk ||
    MOCK.risk
  ).toUpperCase();
  const riskBadgeClass =
    risk === 'HIGH' ? 'bg-secondary' : risk === 'MEDIUM' ? 'bg-amber-500' : 'bg-primary';

  const age = fullPatient?.age || activePatient?.age || MOCK.age;
  const lmp = preg.lmp_date
    ? new Date(preg.lmp_date).toLocaleDateString('en-GB')
    : activePatient?.lmp || (isReal ? '—' : MOCK.lmp);
  const edd = preg.edd_computed
    ? new Date(preg.edd_computed).toLocaleDateString('en-GB')
    : activePatient?.edd || (isReal ? '—' : MOCK.edd);
  const bloodType =
    formatBloodType(booking.blood_group, booking.rhesus) ||
    formatBloodType(preg.blood_group, preg.rhesus) ||
    activePatient?.bloodType ||
    activePatient?.blood_group ||
    (isReal ? '—' : MOCK.bloodType);
  const patientCode =
    fullPatient?.patient_code || formatPatientCode(fullPatient?.id || activePatient?.id);
  const weeks = liveEga != null && !Number.isNaN(liveEga) ? liveEga : null;

  const assessmentReasons = fullPatient?.risk_assessments?.[0]?.reasons;
  const displayClinical =
    riskFlags.length > 0
      ? riskFlags
      : Array.isArray(assessmentReasons)
        ? assessmentReasons.filter(
            (r) =>
              r &&
              !String(r).startsWith('Incomplete clinic data') &&
              !String(r).startsWith('Missing critical field') &&
              String(r) !== 'Genotype not confirmed'
          )
        : [];
  const displayIncomplete =
    incompleteFlags.length > 0
      ? incompleteFlags
      : Array.isArray(assessmentReasons)
        ? assessmentReasons.filter(
            (r) =>
              String(r).startsWith('Incomplete clinic data') ||
              String(r).startsWith('Missing critical field') ||
              String(r) === 'Genotype not confirmed'
          )
        : [];
  const lastSeenRaw = fullPatient?.last_seen_at;
  const lastSeenLabel = lastSeenRaw
    ? new Date(lastSeenRaw).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;
  const visitCount = fullPatient?.site_visit_count;

  const fallbackSummary = isReal
    ? `Mrs. ${name}, ${age != null ? age : 'age unknown'}, ${gpStr || 'G?P?'}, currently ${weeks != null ? `${weeks} weeks` : 'EGA unknown'}. Risk: ${risk}.`
    : `Mrs. ${MOCK.name}, ${MOCK.age}, ${formatGP(MOCK.gravida, MOCK.para, MOCK.childrenAlive)}, currently 24 weeks. Presenting with severe headache, blurred vision. Known hypertensive. Risk: HIGH. Last BP: 160/100.`;

  const toggle = (key) => setOpenSection((o) => (o === key ? null : key));

  const setBook = (field, value) => setBooking((prev) => ({ ...prev, [field]: value }));

  const handleAddBooking = () => {
    setOpenSection('bookings');
    setShowBookingForm(true);
  };

  const buildReviewPayload = useCallback((snap) => {
    const b = snap.booking;
    const inv = snap.investigations;
    const abo = splitAboRh(b.blood_group, b.rhesus);
    return {
      booking_weight: numOrNull(b.booking_weight),
      booking_height: numOrNull(b.booking_height),
      booking_bp_systolic: numOrNull(b.booking_bp_systolic),
      booking_bp_diastolic: numOrNull(b.booking_bp_diastolic),
      booking_ga_weeks: numOrNull(b.booking_ga_weeks),
      booked_anc: b.booked_anc,
      booked_anc_facility: b.booked_anc === true ? b.booked_anc_facility || null : null,
      booking_date: b.booking_date || null,
      ...buildInvestigationsPayload(inv, { ...b, blood_group: abo.blood_group, rhesus: abo.rhesus }),
      ...buildConsultPayload(snap.consult),
    };
  }, []);

  const persistToServer = useCallback(
    async ({ manual = false, reload = false } = {}) => {
      const snap = stateRef.current;
      writeConsultationDraft(patientKey, snap);
      if (!isReal) {
        if (manual) setSaveMsg('Review saved');
        return true;
      }
      if (persistInFlight.current && !manual) return false;
      persistInFlight.current = true;
      if (manual) {
        setSaving(true);
        setSaveMsg('');
      }
      try {
        const payload = buildReviewPayload(snap);
        Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
        await updateDoctorPregnancy(passedPatient.id, payload);
        if (manual && appointment_id && String(snap.consult?.important_remarks || '').trim()) {
          try {
            await saveVisitNotes(appointment_id, snap.consult.important_remarks, { complete: false });
          } catch {
            /* non-blocking */
          }
        }
        writeConsultationDraft(patientKey, snap);
        setSaveMsg(manual ? 'Review saved' : 'Saved');
        if (reload) {
          skipNextPersist.current = true;
          await reloadPatient();
        }
        return true;
      } catch (e) {
        setSaveMsg(
          e?.response?.data?.error || e?.message || 'Draft saved locally — will sync when online'
        );
        return false;
      } finally {
        persistInFlight.current = false;
        if (manual) setSaving(false);
      }
    },
    [isReal, patientKey, passedPatient?.id, appointment_id, reloadPatient, buildReviewPayload]
  );
  persistToServerRef.current = persistToServer;

  useEffect(() => {
    if (!hydrated) return;
    writeConsultationDraft(patientKey, stateRef.current);
    if (skipNextPersist.current) {
      skipNextPersist.current = false;
      return;
    }
    const t = setTimeout(() => {
      void persistToServerRef.current({ manual: false });
    }, 1500);
    return () => clearTimeout(t);
  }, [booking, investigations, consult, hydrated, patientKey]);

  useEffect(() => {
    const flush = () => {
      writeConsultationDraft(patientKey, stateRef.current);
      if (hydrated) void persistToServerRef.current({ manual: false });
    };
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [hydrated, patientKey]);

  const handleSaveReview = () => persistToServer({ manual: true, reload: true });

  const handleMarkSeen = async () => {
    if (!appointment_id) {
      goBackToProvider();
      return;
    }
    try {
      await handleSaveReview();
      await saveVisitNotes(
        appointment_id,
        (consult.important_remarks || '').trim() || 'Appointment completed.',
        { complete: true }
      );
      goBackToProvider();
    } catch {
      goBackToProvider();
    }
  };

  const invFilledCount = countFilledInvestigations(investigations, booking);
  const notesFilledCount = countFilledConsult(consult);
  const bookingFilled = bookingHasAnyValue(booking);

  if (loadingDirect) {
    return (
      <div className="bg-background text-on-surface font-body-md min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-on-surface-variant font-medium">Loading patient details...</p>
        </div>
      </div>
    );
  }

  if (!activePatient && queryPatientId) {
    return (
      <div className="bg-background text-on-surface font-body-md min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <p className="text-lg font-bold text-on-surface mb-2">Patient not found</p>
        <p className="text-sm text-on-surface-variant mb-4">The patient record could not be loaded or you may not have permission to view it.</p>
        <button
          type="button"
          onClick={goBackToProvider}
          className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:opacity-95"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  if (clinicScreen === 'investigations') {
    return (
      <BookingInvestigations
        patientName={name}
        booking={booking}
        setBook={setBook}
        investigations={investigations}
        setInvestigations={setInvestigations}
        saveMsg={saveMsg}
        saving={saving}
        onBack={() => setClinicScreen('chart')}
        onSave={handleSaveReview}
      />
    );
  }

  if (clinicScreen === 'notes') {
    return (
      <ConsultationNotes
        patientName={name}
        consult={consult}
        setConsult={setConsult}
        saveMsg={saveMsg}
        saving={saving}
        onBack={() => setClinicScreen('chart')}
        onSave={handleSaveReview}
      />
    );
  }

  if (clinicScreen === 'self_reported') {
    return (
      <PatientSelfReported
        patientName={name}
        fullPatient={fullPatient}
        summary={withGpAlive(aiSummary || fallbackSummary, gpStr)}
        loading={isReal && !fullPatient}
        onBack={() => setClinicScreen('chart')}
      />
    );
  }

  return (
    <div className="bg-background text-on-surface font-body-md min-h-screen flex flex-col">
      <div className="grain-overlay pointer-events-none" />

      {/* Patient header — full width on all breakpoints */}
      <header className="bg-[#1A1A18] text-white shrink-0">
        <div className="max-w-4xl mx-auto w-full p-5 sm:p-6">
          <div className="flex justify-between items-start mb-4">
            <button
              type="button"
              onClick={goBackToProvider}
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
              {(lastSeenLabel || visitCount) && (
                <p className="font-body-md text-white/50 text-[11px] mt-1">
                  {lastSeenLabel ? `Last on site ${lastSeenLabel}` : 'Not seen on site yet'}
                  {visitCount != null ? ` · ${visitCount} visit${visitCount === 1 ? '' : 's'}` : ''}
                </p>
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
        {(risk === 'HIGH' || risk === 'MEDIUM' || displayClinical.length > 0 || displayIncomplete.length > 0) && (
          <section
            className={`rounded-xl p-4 border ${
              risk === 'HIGH'
                ? 'bg-secondary/5 border-secondary/20'
                : risk === 'MEDIUM'
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-white border-outline-variant/40'
            }`}
          >
            <h3 className="font-label-sm text-on-surface-variant uppercase tracking-widest mb-2">
              {risk === 'LOW' ? 'Care team notes' : `Why this patient is ${risk} risk`}
            </h3>
            {displayClinical.length > 0 ? (
              <ul className="space-y-1.5">
                {displayClinical.map((reason) => (
                  <li key={reason} className="font-body-md text-sm text-on-surface flex gap-2">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-secondary shrink-0" />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            ) : risk === 'HIGH' || risk === 'MEDIUM' ? (
              <p className="font-body-md text-sm text-on-surface-variant">
                Flagged as {risk} risk — open self-reported data if the criteria are not listed here.
              </p>
            ) : null}
            {displayIncomplete.length > 0 ? (
              <div className={`${displayClinical.length ? 'mt-3 pt-3 border-t border-outline-variant/30' : ''}`}>
                <p className="font-label-sm text-[10px] uppercase text-on-surface-variant mb-1">Incomplete clinic data</p>
                <ul className="space-y-1">
                  {displayIncomplete.map((reason) => (
                    <li key={reason} className="font-body-md text-xs text-on-surface-variant">
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        )}

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
                {withGpAlive(aiSummary || fallbackSummary, gpStr)}
              </p>
            )}
          </div>
        </section>

        {/* 1. Booking History — ANC booking form (not appointment list) */}
        <ClinicSection
          title="Booking History"
          open={openSection === 'bookings'}
          onToggle={() => toggle('bookings')}
          badge={bookingFilled ? 'saved' : null}
          headerRight={
            <button
              type="button"
              onClick={handleAddBooking}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white font-label-sm text-xs hover:opacity-90 transition-opacity"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Add Booking
            </button>
          }
        >
          <div className="pt-3 space-y-1">
            {/* Self-Reported Data Link inserted here, keeping Booking functions below intact */}
            <div className="mb-4 pb-4 border-b border-outline-variant/30 flex justify-between items-center">
              <div>
                <p className="font-label-sm text-sm text-on-surface font-semibold">Patient Self-Reported Data</p>
                <p className="text-[11px] text-on-surface-variant">View symptoms and biodata submitted by patient</p>
              </div>
              <button
                type="button"
                onClick={() => setClinicScreen('self_reported')}
                className="font-label-sm text-xs text-primary font-medium flex items-center gap-1 hover:opacity-80 transition-opacity bg-primary/5 px-3 py-1.5 rounded-lg"
              >
                View report
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            </div>

            {!showBookingForm ? (
              <p className="font-body-md text-sm text-on-surface-variant italic">
                No ANC booking recorded yet. Tap <span className="font-semibold">Add Booking</span> to
                enter booking details.
              </p>
            ) : (
              <>
                <FieldRow label="Booking Weight">
                  <input
                    type="number"
                    className={inputCls}
                    value={booking.booking_weight}
                    onChange={(e) => setBook('booking_weight', e.target.value)}
                    placeholder="kg"
                  />
                </FieldRow>
                <FieldRow label="Booking Height">
                  <input
                    type="number"
                    className={inputCls}
                    value={booking.booking_height}
                    onChange={(e) => setBook('booking_height', e.target.value)}
                    placeholder="cm"
                  />
                </FieldRow>
                <FieldRow label="Booking BP">
                  <div className="flex items-center gap-1 w-full justify-end">
                    <input
                      type="number"
                      className={`${inputCls} max-w-[72px]`}
                      value={booking.booking_bp_systolic}
                      onChange={(e) => setBook('booking_bp_systolic', e.target.value)}
                      placeholder="Sys"
                    />
                    <span className="text-on-surface-variant text-sm">/</span>
                    <input
                      type="number"
                      className={`${inputCls} max-w-[72px]`}
                      value={booking.booking_bp_diastolic}
                      onChange={(e) => setBook('booking_bp_diastolic', e.target.value)}
                      placeholder="Dia"
                    />
                  </div>
                </FieldRow>
                <FieldRow label="Blood Group">
                  <input
                    className={inputCls}
                    value={booking.blood_group}
                    onChange={(e) => setBook('blood_group', e.target.value)}
                    placeholder="e.g. O+"
                  />
                </FieldRow>
                <FieldRow label="Genotype">
                  <input
                    className={inputCls}
                    value={booking.genotype}
                    onChange={(e) => setBook('genotype', e.target.value)}
                    placeholder="e.g. AA"
                  />
                </FieldRow>
                <FieldRow label="Rhesus">
                  <input
                    className={inputCls}
                    value={booking.rhesus}
                    onChange={(e) => setBook('rhesus', e.target.value)}
                    placeholder="e.g. Positive"
                  />
                </FieldRow>
                <FieldRow label="Gestational Age at Booking">
                  <input
                    type="number"
                    className={inputCls}
                    value={booking.booking_ga_weeks}
                    onChange={(e) => setBook('booking_ga_weeks', e.target.value)}
                    placeholder="weeks"
                  />
                </FieldRow>
                <FieldRow label="Previously booked ANC?">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={ynBtnCls(booking.booked_anc === true)}
                      onClick={() => setBook('booked_anc', true)}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      className={ynBtnCls(booking.booked_anc === false)}
                      onClick={() => {
                        setBooking((prev) => ({
                          ...prev,
                          booked_anc: false,
                          booked_anc_facility: '',
                        }));
                      }}
                    >
                      No
                    </button>
                  </div>
                </FieldRow>
                {booking.booked_anc === true && (
                  <FieldRow label="If Yes, which facility?">
                    <input
                      className={inputCls}
                      value={booking.booked_anc_facility}
                      onChange={(e) => setBook('booked_anc_facility', e.target.value)}
                      placeholder="Facility name"
                    />
                  </FieldRow>
                )}
                <FieldRow label="Booking Date">
                  <input
                    type="date"
                    className={inputCls}
                    value={booking.booking_date}
                    onChange={(e) => setBook('booking_date', e.target.value)}
                  />
                </FieldRow>
              </>
            )}
          </div>
        </ClinicSection>

        {/* 2. Investigations done — opens Booking Investigations screen */}
        <ClinicLinkRow
          title="Investigations done"
          badge={invFilledCount ? `${invFilledCount}` : null}
          onClick={() => setClinicScreen('investigations')}
        />

        {/* 3. Consultation notes — vitals table, drugs, scans, exam, remarks */}
        <ClinicLinkRow
          title="Consultation notes"
          badge={notesFilledCount ? `${notesFilledCount}` : null}
          onClick={() => setClinicScreen('notes')}
        />

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

      {/* Sticky footer */}
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
              onClick={goBackToProvider}
              className="col-span-2 sm:col-span-1 bg-surface-container-high text-on-surface py-3 rounded-lg font-label-sm text-sm border border-outline/20"
            >
              {fromTab && fromTab !== 'queue' ? 'Back' : 'Back to queue'}
            </button>
          ) : null}
        </div>
      </footer>
    </div>
  );
};

export default PatientDetailPanel;
