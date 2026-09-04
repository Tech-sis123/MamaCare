import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  doctorLogin as apiDoctorLogin,
  registerDoctor as apiRegisterDoctor,
  recoverDoctorPassword as apiRecoverDoctorPassword,
  getDoctorQueue,
  searchPatients,
  acknowledgeAlert,
  askDoctorAI,
} from '../lib/api';
import { setDoctorAuth, clearDoctorAuth, isDoctorAuthenticated, getDoctorData } from '../lib/auth';

const RISK_COLORS = {
  HIGH:   { bar: 'bg-secondary', badge: 'bg-secondary text-white',       border: 'border-secondary',   text: 'text-secondary' },
  MEDIUM: { bar: 'bg-amber-500', badge: 'bg-amber-100 text-amber-800',  border: 'border-amber-500',   text: 'text-amber-700' },
  LOW:    { bar: 'bg-primary',   badge: 'bg-primary/10 text-primary',    border: 'border-primary',     text: 'text-primary' },
};

const STATUS_STYLE = {
  WAITING:      'bg-secondary/20 text-secondary border border-secondary/30',
  'IN PROGRESS':'bg-amber-100 text-amber-800 border border-amber-200',
  QUEUED:       'bg-surface-container text-on-surface-variant border border-outline-variant',
  DONE:         'bg-primary text-on-primary',
};

const RESOURCES = [
  { title: 'ANC Protocol v3.2',            type: 'PDF',  size: '2.1 MB', category: 'Clinical' },
  { title: 'Pre-eclampsia Management',     type: 'PDF',  size: '1.4 MB', category: 'Clinical' },
  { title: 'WHO Antenatal Care Guidelines', type: 'PDF', size: '8.7 MB', category: 'Guidelines' },
  { title: 'Danger Signs Quick Reference', type: 'PDF',  size: '0.5 MB', category: 'Emergency' },
  { title: 'Pregnancy Nutrition Chart',    type: 'IMG',  size: '0.8 MB', category: 'Education' },
  { title: 'Referral Forms',          type: 'DOC',  size: '0.3 MB', category: 'Admin' },
];

const patientCode = (id) =>
  id ? `MC-${String(id).replace(/-/g, '').slice(0, 6).toUpperCase()}` : '';

const toQueuePatient = (apt) => {
  const slotDate = new Date(apt.slot_start);
  const today = new Date();
  const isToday = slotDate.toDateString() === today.toDateString();
  const dateLabel = isToday
    ? 'Today'
    : slotDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  return {
    id: apt.patient.id,
    appointment_id: apt.appointment_id,
    name: apt.patient.name || '—',
    code: apt.patient.patient_code || patientCode(apt.patient.id),
    age: apt.patient.age || '—',
    weeks: apt.patient.ega_weeks || '—',
    risk: (apt.patient.risk_tier || 'LOW').toUpperCase(),
    flags: [],
    time: slotDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    dateLabel,
    isToday,
    status: apt.status === 'completed' ? 'DONE' : 'QUEUED',
    initials: (apt.patient.name || 'P').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
  };
};

const toPatientRow = (p) => ({
  id: p.id,
  name: p.name || '—',
  code: p.patient_code || patientCode(p.id),
  age: p.age || '—',
  weeks: p.ega_weeks || '—',
  risk: (p.risk_tier || 'LOW').toUpperCase(),
  flags: [],
  initials: (p.name || 'P').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'P',
});

// ── Sub-views ────────────────────────────────────────────────────

const QueueView = ({ navigate, sseAlerts, onDismiss, fromTab }) => {
  const [filter, setFilter] = useState('All');
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const filters = ['All', 'HIGH', 'MEDIUM', 'LOW', 'Done'];

  useEffect(() => {
    getDoctorQueue()
      .then(({ data }) => setQueue((data.queue || []).map(toQueuePatient)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = queue.filter(p => {
    if (filter === 'All') return p.status !== 'DONE';
    if (filter === 'Done') return p.status === 'DONE';
    return p.risk === filter;
  });
  const highCount = queue.filter(p => p.risk === 'HIGH').length;

  return (
    <div className="space-y-6">
      {/* SSE alert toasts */}
      <div className="fixed top-24 right-6 z-[60] flex flex-col gap-3 max-w-sm w-full">
        {(sseAlerts || []).map((alert, i) => {
          const isBooking = alert.type === 'booking';
          const bgClass = isBooking ? 'bg-primary' : 'bg-secondary';
          const borderClass = isBooking ? 'border-primary/50' : 'border-secondary/50';
          const icon = isBooking ? 'event_available' : 'warning';
          const title = isBooking ? 'New Booking' : 'Critical Alert';
          
          return (
            <div key={alert.id || i} className={`${bgClass} text-white px-5 py-4 rounded-xl shadow-2xl flex items-center gap-4 border ${borderClass} animate-slide-up`}>
              <span className="material-symbols-outlined flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-label-sm text-xs uppercase tracking-wide">{title}</p>
                <p className="font-body-md font-bold text-sm truncate">
                  {isBooking ? `${alert.patient_name}: ${alert.message}` : (alert.patient_name || alert.message || 'New high-risk alert')}
                </p>
              </div>
              <button onClick={() => onDismiss(alert)} className="ml-1 text-white/60 hover:text-white shrink-0">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          );
        })}
      </div>

      {highCount > 0 && (
        <div className="bg-secondary/10 border border-secondary/20 rounded-xl p-4 flex items-center gap-4">
          <div className="bg-secondary text-white w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-lg">priority_high</span>
          </div>
          <p className="font-body-md text-secondary font-semibold">
            🚨 {highCount} HIGH RISK patient{highCount !== 1 ? 's' : ''} in queue — review immediately
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total',       value: queue.length,                                          bg: 'bg-white border border-amber-50',                        fg: 'text-primary' },
          { label: 'High Risk',    value: highCount,                                              bg: 'bg-secondary/5 border border-secondary/10',              fg: 'text-secondary' },
          { label: 'Pending',      value: queue.filter(p => p.status === 'QUEUED').length,        bg: 'bg-amber-50 border border-amber-200',                    fg: 'text-amber-800' },
          { label: 'Seen',         value: queue.filter(p => p.status === 'DONE').length,          bg: 'bg-primary/5 border border-primary/10',                  fg: 'text-primary' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-6 custom-shadow`}>
            <p className={`font-label-sm text-xs uppercase mb-1 ${s.fg} opacity-70`}>{s.label}</p>
            <h3 className={`font-display-xl text-4xl leading-none ${s.fg}`}>
              {loading ? '—' : String(s.value).padStart(2, '0')}
            </h3>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 overflow-x-auto pb-1 no-scrollbar">
        {filters.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-5 py-2 rounded-full font-label-sm text-xs whitespace-nowrap transition-all ${
              filter === f
                ? 'bg-primary text-white'
                : 'bg-white text-on-surface-variant border border-amber-100 hover:bg-amber-50'
            }`}
          >
            {f === 'HIGH' ? '🔴 High Risk' : f === 'MEDIUM' ? '🟡 Medium' : f === 'LOW' ? '🟢 Low Risk' : f}
          </button>
        ))}
      </div>

      {/* Patient rows */}
      <div className="space-y-3">
        {loading && (
          <div className="text-center py-12 text-on-surface-variant font-body-md text-sm">
            Loading today's queue…
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-16 text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl block mb-2">event_available</span>
            <p className="font-body-md">No patients in queue for this filter</p>
          </div>
        )}
        {filtered.map(p => {
          const rc = RISK_COLORS[p.risk] || RISK_COLORS.LOW;
          return (
            <div
              key={p.id}
              className={`group relative bg-white border border-amber-50 rounded-xl p-5 flex items-center justify-between transition-all hover:shadow-md custom-shadow ${
                p.risk === 'HIGH' ? 'bg-secondary/5 border-secondary/20' : ''
              }`}
            >
              <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${rc.bar} rounded-l-xl`} />
              <div className="flex items-center gap-5">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${rc.badge}`}>
                  {p.initials}
                </div>
                <div className="text-center w-16 hidden sm:block">
                  <p className={`font-label-sm text-[10px] ${p.isToday ? rc.text : 'text-outline'}`}>{p.dateLabel}</p>
                  <p className={`font-label-sm text-xs ${rc.text}`}>{p.time}</p>
                </div>
                <div>
                  <h4 className="font-headline-md text-amber-900 text-base">{p.name}</h4>
                  <p className="font-body-md text-on-surface-variant text-sm mt-0.5">
                    {p.code ? <span className="font-mono text-xs mr-2 text-primary/80">{p.code}</span> : null}
                    Age {p.age} · Week {p.weeks}
                  </p>
                  {p.flags.length > 0 && (
                    <div className="flex gap-2 mt-1.5 flex-wrap">
                      {p.flags.map(f => (
                        <span
                          key={f}
                          className={`font-label-sm text-[10px] px-2 py-0.5 rounded-full border ${
                            p.risk === 'HIGH' ? 'bg-secondary text-white border-secondary' :
                            p.risk === 'MEDIUM' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                            'bg-primary/5 text-primary border-primary/10'
                          }`}
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className={`font-label-sm text-[10px] px-3 py-1 rounded-full ${STATUS_STYLE[p.status] || STATUS_STYLE.QUEUED}`}>
                  {p.status}
                </span>
                {p.status !== 'DONE' && (
                  <button
                    onClick={() => navigate('/provider/patient', { state: { patient: p, appointment_id: p.appointment_id, fromTab } })}
                    className="bg-primary text-white px-5 py-2 rounded-lg font-label-sm text-xs hover:bg-primary-container transition-all flex items-center gap-1"
                  >
                    View
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const MetricsView = () => {
  const riskDist = [
    { label: 'Low Risk',    count: 4, pct: 57, color: 'bg-primary' },
    { label: 'Medium Risk', count: 2, pct: 29, color: 'bg-amber-400' },
    { label: 'High Risk',   count: 1, pct: 14, color: 'bg-secondary' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-headline-lg text-amber-900 text-2xl">Health Metrics</h2>
        <p className="font-body-md text-on-surface-variant/70 mt-1">Provider Summary</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: 'Registered Patients', value: '—',   sub: 'Live data coming soon', icon: 'group',           color: 'text-primary' },
          { label: 'Avg Risk Score',       value: '—',   sub: 'Live data coming soon', icon: 'analytics',       color: 'text-amber-700' },
          { label: 'Alert Response Time',  value: '—',   sub: 'SLA: 60s',              icon: 'timer',           color: 'text-primary' },
          { label: 'Appt Adherence',       value: '—',   sub: 'Live data coming soon', icon: 'event_available', color: 'text-primary' },
          { label: 'Danger Alerts Sent',   value: '—',   sub: 'Live data coming soon', icon: 'warning',         color: 'text-secondary' },
          { label: 'Modules Completed',    value: '—',   sub: 'Live data coming soon', icon: 'school',          color: 'text-primary' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl p-5 custom-shadow border border-amber-50">
            <div className="flex justify-between items-start mb-3">
              <p className="font-label-sm text-on-surface-variant text-xs uppercase">{k.label}</p>
              <span className={`material-symbols-outlined text-lg ${k.color}`}>{k.icon}</span>
            </div>
            <h3 className={`font-display-xl text-3xl ${k.color}`}>{k.value}</h3>
            <p className="font-label-sm text-outline text-xs mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl p-6 custom-shadow border border-amber-50">
        <h3 className="font-headline-md text-amber-900 mb-6">Risk Distribution — Today's Queue</h3>
        <div className="flex h-40 items-end gap-6 mb-4">
          {riskDist.map(r => (
            <div key={r.label} className="flex-1 flex flex-col items-center gap-2">
              <span className="font-headline-md text-on-surface">{r.count}</span>
              <div
                className={`w-full ${r.color} rounded-t-lg transition-all duration-700`}
                style={{ height: `${r.pct * 1.2}%` }}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-6">
          {riskDist.map(r => (
            <div key={r.label} className="flex-1 flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${r.color}`} />
              <span className="font-label-sm text-outline text-xs">{r.label} ({r.pct}%)</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const PatientsView = ({ navigate, fromTab }) => {
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [patients, setPatients] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalRegistered, setTotalRegistered] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    const delay = search.trim() ? 350 : 0;
    let cancelled = false;
    const t = setTimeout(() => {
      setLoading(true);
      setLoadError('');
      searchPatients({
        q: search.trim(),
        page,
        limit,
        risk: riskFilter !== 'All' ? riskFilter.toLowerCase() : undefined,
      })
        .then(({ data }) => {
          if (cancelled) return;
          const list = Array.isArray(data) ? data : data?.patients || [];
          setPatients(list.map(toPatientRow));
          const total = data?.total ?? list.length;
          setTotalCount(total);
          setTotalRegistered(data?.totalRegistered ?? total);
          setTotalPages(data?.totalPages ?? Math.max(1, Math.ceil(total / limit)));
        })
        .catch((err) => {
          if (cancelled) return;
          setPatients([]);
          setTotalCount(0);
          setTotalPages(1);
          const status = err.response?.status;
          setLoadError(
            status === 401
              ? 'Session expired. Please sign in again.'
              : 'Could not load patients. Check that the API is running, then try again.'
          );
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, delay);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [search, riskFilter, page, limit, reloadTick]);

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleRiskChange = (e) => {
    setRiskFilter(e.target.value);
    setPage(1);
  };

  const handleLimitChange = (e) => {
    setLimit(Number(e.target.value));
    setPage(1);
  };

  const getPageNumbers = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (page <= 3) {
      return [1, 2, 3, 4, '...', totalPages];
    }
    if (page >= totalPages - 2) {
      return [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', page - 1, page, page + 1, '...', totalPages];
  };

  const start = totalCount > 0 ? (page - 1) * limit + 1 : 0;
  const end = Math.min(page * limit, totalCount);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="font-headline-lg text-amber-900 text-2xl">All Patients</h2>
          <p className="font-body-md text-on-surface-variant/70 mt-1">
            {loading ? (
              'Loading…'
            ) : search.trim() || riskFilter !== 'All' ? (
              <>
                Showing <span className="font-semibold text-amber-900">{totalCount}</span> matching patient{totalCount !== 1 ? 's' : ''}{' '}
                <span className="text-on-surface-variant/50">({totalRegistered} total registered)</span>
              </>
            ) : (
              `${totalRegistered} patient${totalRegistered !== 1 ? 's' : ''} registered`
            )}
          </p>
        </div>
        {totalCount > 0 && (
          <div className="text-xs font-label-sm text-on-surface-variant/80 bg-surface-container-low px-3 py-1.5 rounded-full border border-outline-variant/30 self-start sm:self-auto">
            Page {page} of {totalPages}
          </div>
        )}
      </div>

      <div className="flex gap-3 flex-col sm:flex-row">
        <div className="relative flex-grow">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">search</span>
          <input
            type="text"
            placeholder="Search by name or patient code (MC-XXXXXX)…"
            value={search}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-10 py-3 border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none font-body-md bg-white"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setPage(1);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-primary transition-colors p-1"
              title="Clear search"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <select
            value={riskFilter}
            onChange={handleRiskChange}
            className="flex-1 sm:flex-none px-4 py-3 border border-outline-variant rounded-xl font-body-md bg-white focus:ring-2 focus:ring-primary focus:border-primary outline-none"
          >
            <option value="All">All Risks</option>
            <option value="HIGH">HIGH Risk</option>
            <option value="MEDIUM">MEDIUM Risk</option>
            <option value="LOW">LOW Risk</option>
          </select>

          <select
            value={limit}
            onChange={handleLimitChange}
            title="Patients per page"
            className="px-3 py-3 border border-outline-variant rounded-xl font-body-md bg-white focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
          >
            <option value={10}>10 / pg</option>
            <option value={20}>20 / pg</option>
            <option value={50}>50 / pg</option>
            <option value={100}>100 / pg</option>
          </select>
        </div>
      </div>

      <div className="space-y-3">
        {loading && (
          <div className="text-center py-12 text-on-surface-variant font-body-md text-sm">
            <div className="inline-block w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-2"></div>
            <p>Loading patients…</p>
          </div>
        )}
        {!loading && loadError && (
          <div className="text-center py-16 text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl block mb-2 text-rose-500">error</span>
            <p className="font-body-md">{loadError}</p>
            <button
              type="button"
              onClick={() => setReloadTick((n) => n + 1)}
              className="mt-4 px-5 py-2 rounded-full bg-primary text-white font-label-sm text-xs"
            >
              Try again
            </button>
          </div>
        )}
        {!loading && !loadError && patients.length === 0 && (
          <div className="text-center py-16 text-on-surface-variant bg-white border border-outline-variant/30 rounded-2xl p-8">
            <span className="material-symbols-outlined text-4xl block mb-2 text-outline">person_search</span>
            <p className="font-body-md font-medium text-amber-900">No patients found</p>
            <p className="font-body-md text-xs text-on-surface-variant/70 mt-1">
              {search || riskFilter !== 'All' ? 'Try adjusting your search query or risk filter.' : 'No patients have been registered yet.'}
            </p>
            {(search || riskFilter !== 'All') && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setRiskFilter('All');
                  setPage(1);
                }}
                className="mt-4 px-4 py-1.5 rounded-full border border-outline-variant text-xs font-label-sm text-primary hover:bg-amber-50"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
        {!loading && patients.map(p => {
          const rc = RISK_COLORS[p.risk] || RISK_COLORS.LOW;
          return (
            <button
              key={p.id}
              onClick={() => navigate('/provider/patient', { state: { patient: p, fromTab } })}
              className="w-full text-left group relative bg-white border border-amber-50 rounded-xl p-5 flex items-center justify-between transition-all hover:shadow-md custom-shadow hover:border-primary/20 cursor-pointer"
            >
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${rc.bar} rounded-l-xl`} />
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold ${rc.badge} flex-shrink-0`}>
                  {p.initials}
                </div>
                <div>
                  <p className="font-headline-md text-amber-900">{p.name}</p>
                  <p className="font-body-md text-on-surface-variant text-sm">
                    {p.code ? <span className="font-mono text-xs mr-2 text-primary/80">{p.code}</span> : null}
                    Age {p.age} · Week {p.weeks}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`font-label-sm text-xs px-3 py-1 rounded-full border ${rc.badge} ${rc.border}`}>
                  {p.risk}
                </span>
                <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors">chevron_right</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Pagination Bar */}
      {!loading && totalCount > 0 && (
        <div className="bg-white border border-outline-variant/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="text-sm font-body-md text-on-surface-variant">
            Showing <span className="font-semibold text-amber-900">{start}</span>–<span className="font-semibold text-amber-900">{end}</span> of <span className="font-semibold text-amber-900">{totalCount}</span> patients
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Previous Page */}
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => {
                setPage((p) => Math.max(1, p - 1));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-3 py-1.5 rounded-lg border border-outline-variant/60 text-xs font-label-sm flex items-center gap-1 text-on-surface hover:bg-amber-50 disabled:opacity-35 disabled:hover:bg-transparent transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-sm">chevron_left</span>
              <span className="hidden xs:inline">Prev</span>
            </button>

            {/* Page Numbers */}
            <div className="flex items-center gap-1">
              {getPageNumbers().map((pNum, idx) => {
                if (pNum === '...') {
                  return (
                    <span key={`ellipsis-${idx}`} className="px-1.5 py-1 text-xs text-on-surface-variant/60 font-mono select-none">
                      …
                    </span>
                  );
                }
                const isCurrent = pNum === page;
                return (
                  <button
                    key={`page-${pNum}`}
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      setPage(pNum);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={`w-8 h-8 rounded-lg text-xs font-label-sm flex items-center justify-center transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-primary text-white font-bold shadow-sm'
                        : 'text-on-surface hover:bg-amber-50 border border-transparent hover:border-outline-variant/40'
                    }`}
                  >
                    {pNum}
                  </button>
                );
              })}
            </div>

            {/* Next Page */}
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => {
                setPage((p) => Math.min(totalPages, p + 1));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-3 py-1.5 rounded-lg border border-outline-variant/60 text-xs font-label-sm flex items-center gap-1 text-on-surface hover:bg-amber-50 disabled:opacity-35 disabled:hover:bg-transparent transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              <span className="hidden xs:inline">Next</span>
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const ResourcesView = () => (
  <div className="space-y-6">
    <div>
      <h2 className="font-headline-lg text-amber-900 text-2xl">Resources</h2>
      <p className="font-body-md text-on-surface-variant/70 mt-1">Clinical guidelines, protocols, and materials</p>
    </div>

    {['Clinical', 'Guidelines', 'Emergency', 'Education', 'Admin'].map(cat => {
      const items = RESOURCES.filter(r => r.category === cat);
      if (!items.length) return null;
      return (
        <div key={cat}>
          <h3 className="font-label-sm text-on-surface-variant uppercase tracking-widest text-xs mb-3">{cat}</h3>
          <div className="space-y-3">
            {items.map(r => (
              <div key={r.title} className="bg-white rounded-xl p-4 custom-shadow border border-amber-50 flex items-center justify-between group hover:border-primary/20 transition-all">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xs ${
                    r.type === 'PDF' ? 'bg-secondary/10 text-secondary' :
                    r.type === 'IMG' ? 'bg-primary/10 text-primary' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {r.type}
                  </div>
                  <div>
                    <p className="font-body-md font-medium text-on-surface">{r.title}</p>
                    <p className="font-label-sm text-outline text-xs">{r.size}</p>
                  </div>
                </div>
                <button className="p-2 hover:bg-primary/10 rounded-full transition-colors">
                  <span className="material-symbols-outlined text-primary text-lg">download</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      );
    })}
  </div>
);

const ProfileView = ({ doctor }) => {
  const d = doctor || {};
  const initials = (d.name || 'DR').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  return (
  <div className="space-y-6 animate-fade-in">
    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
      <div>
        <h2 className="font-headline-lg text-amber-900 text-2xl">Provider Profile</h2>
        <p className="font-body-md text-on-surface-variant/70 mt-1">Maternal Health Portal</p>
      </div>
      <div className="flex items-center gap-2 text-xs font-label-sm text-primary bg-primary/10 px-3 py-2 rounded-full w-fit">
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse-dot" />
        Active today
      </div>
    </div>

    <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-6">
      <div className="bg-[#1A1A18] text-white rounded-3xl p-6 lg:p-8 shadow-2xl overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-primary/10 pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center gap-6">
          <div className="w-24 h-24 rounded-3xl bg-amber-900/50 flex items-center justify-center shrink-0 border border-amber-400/20">
            <span className="font-headline-lg text-3xl text-white">{initials}</span>
          </div>
          <div className="flex-1">
            <p className="text-amber-300/70 text-xs uppercase tracking-[0.24em] font-label-sm">Clinical profile</p>
            <h3 className="font-headline-lg text-3xl mt-2">{d.name || 'Provider'}</h3>
            <p className="text-amber-100/80 mt-1">Obstetrician</p>
            <div className="flex flex-wrap gap-2 mt-4">
              <span className="px-3 py-1 rounded-full bg-white/10 text-xs">Obstetrics & Gynaecology</span>
              
              <span className="px-3 py-1 rounded-full bg-secondary/20 text-secondary text-xs border border-secondary/30">
                {d.role || 'doctor'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-2xl p-5 custom-shadow border border-amber-50">
          <p className="font-label-sm text-on-surface-variant uppercase text-xs tracking-widest">Contact</p>
          <div className="mt-4 space-y-3">
            {[
              { icon: 'mail',  label: 'Email', value: d.email || '—' },
              { icon: 'badge', label: 'Role',  value: d.role || '—' },
            ].map(item => (
              <div key={item.label} className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-lg">{item.icon}</span>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-outline font-label-sm">{item.label}</p>
                  <p className="text-sm text-on-surface mt-1">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};

const SettingsView = ({ onEditProfile, onSignOut, doctor }) => {
  const [notifSMS, setNotifSMS]         = useState(true);
  const [notifWhatsApp, setNotifWhatsApp] = useState(true);
  const [notifEmail, setNotifEmail]     = useState(false);

  const d = doctor || {};
  const initials = (d.name || 'DR').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const Toggle = ({ value, onChange }) => (
    <button
      onClick={() => onChange(!value)}
      className={`w-12 h-6 rounded-full transition-all relative ${value ? 'bg-primary' : 'bg-outline-variant'}`}
    >
      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${value ? 'left-7' : 'left-1'}`} />
    </button>
  );

  return (
    <div className="space-y-8 max-w-xl">
      <div>
        <h2 className="font-headline-lg text-amber-900 text-2xl">Settings</h2>
        <p className="font-body-md text-on-surface-variant/70 mt-1">Account and notification preferences</p>
      </div>

      <div className="bg-white rounded-xl custom-shadow border border-amber-50 overflow-hidden">
        <div className="p-4 border-b border-amber-50">
          <p className="font-label-sm text-on-surface-variant uppercase text-xs tracking-widest">Account</p>
        </div>
        <div className="flex items-center gap-4 p-6">
          <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center">
            <span className="font-headline-md text-primary text-2xl">{initials}</span>
          </div>
          <div>
            <p className="font-headline-md text-amber-900 text-lg">{d.name || 'Provider'}</p>
            <p className="font-body-md text-on-surface-variant text-sm">
              {d.role === 'department_head' ? 'Department Head' : 'Obstetrician'}
            </p>
            <p className="font-label-sm text-outline text-xs mt-1">{d.email || '—'}</p>
          </div>
        </div>
        <div className="px-6 pb-6">
          <button
            onClick={onEditProfile}
            className="text-primary font-label-sm text-sm underline underline-offset-4"
          >
            Edit profile
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl custom-shadow border border-amber-50 overflow-hidden">
        <div className="p-4 border-b border-amber-50">
          <p className="font-label-sm text-on-surface-variant uppercase text-xs tracking-widest">Alert Notifications</p>
        </div>
        <div className="divide-y divide-amber-50">
          {[
            { label: 'SMS Alerts',      sub: 'High-risk patient notifications', value: notifSMS,      set: setNotifSMS },
            { label: 'WhatsApp Alerts', sub: 'Danger sign reports',             value: notifWhatsApp, set: setNotifWhatsApp },
            { label: 'Email Digest',    sub: 'Daily summary report',            value: notifEmail,    set: setNotifEmail },
          ].map(n => (
            <div key={n.label} className="flex justify-between items-center px-6 py-4">
              <div>
                <p className="font-body-md text-on-surface">{n.label}</p>
                <p className="font-label-sm text-outline text-xs">{n.sub}</p>
              </div>
              <Toggle value={n.value} onChange={n.set} />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl custom-shadow border border-amber-50 overflow-hidden">
        <div className="p-4 border-b border-amber-50">
          <p className="font-label-sm text-on-surface-variant uppercase text-xs tracking-widest">Department</p>
        </div>
        <div className="p-6 space-y-3">
          {[
            { label: 'Hospital',    value: 'Partner Hospitals' },
            { label: 'Department',  value: 'Obstetrics & Gynaecology' },
            { label: 'Pilot Group', value: 'Cohort 1' },
          ].map(d => (
            <div key={d.label} className="flex justify-between items-center py-2 border-b border-outline-variant/20 last:border-0">
              <span className="font-label-sm text-on-surface-variant text-xs uppercase">{d.label}</span>
              <span className="font-body-md text-on-surface text-sm">{d.value}</span>
            </div>
          ))}
        </div>
      </div>

      <button onClick={onSignOut} className="text-secondary font-label-sm text-sm flex items-center gap-2 hover:underline">
        <span className="material-symbols-outlined text-sm">logout</span>
        Sign out
      </button>
    </div>
  );
};

// ── Doctor Auth Flow ─────────────────────────────────────────────────
const DoctorAuthScreen = ({ onLogin }) => {
  const [view, setView] = useState('login'); // 'login', 'register', 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [hospital, setHospital] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setMsg('');
    try {
      const { data } = await apiDoctorLogin(email, password);
      setDoctorAuth(data.access_token, data.refresh_token, data.doctor);
      onLogin(data.doctor);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setMsg('');
    try {
      await apiRegisterDoctor({ email, password, name, hospital });
      setMsg('Registration successful! Please log in.');
      setView('login');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setMsg('');
    try {
      await apiRecoverDoctorPassword(email);
      setMsg('Password recovery email sent (if account exists).');
      setView('login');
    } catch (err) {
      setError(err.response?.data?.message || 'Recovery failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1A1A18] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl p-8 shadow-2xl">
        <div className="mb-8">
          <h1 className="font-headline-lg text-amber-900 text-2xl mb-1">Provider Portal</h1>
          <p className="font-body-md text-on-surface-variant text-sm">
            {view === 'login' ? 'Sign in to access patient care dashboard' :
             view === 'register' ? 'Create a provider account' : 'Recover your password'}
          </p>
        </div>
        
        {msg && <p className="text-primary font-label-sm mb-4 p-3 bg-primary/10 rounded-lg">{msg}</p>}

        {view === 'login' && (
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="font-label-sm text-on-surface-variant text-xs uppercase tracking-widest block mb-2">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-3 border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary outline-none font-body-md" required />
            </div>
            <div>
              <label className="font-label-sm text-on-surface-variant text-xs uppercase tracking-widest block mb-2">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-3 border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary outline-none font-body-md" required />
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={() => { setView('forgot'); setError(''); setMsg(''); }} className="text-primary font-label-sm text-xs hover:underline">Forgot password?</button>
            </div>
            {error && <p className="text-secondary font-label-sm text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="w-full bg-primary text-white py-4 rounded-xl font-label-sm hover:opacity-90 transition-all disabled:opacity-60">
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
            <p className="text-center font-body-md text-sm mt-4">
              Don't have an account? <button type="button" onClick={() => { setView('register'); setError(''); setMsg(''); }} className="text-primary font-bold hover:underline">Register here</button>
            </p>
          </form>
        )}

        {view === 'register' && (
          <form onSubmit={handleRegister} className="space-y-5">
            <div>
              <label className="font-label-sm text-on-surface-variant text-xs uppercase tracking-widest block mb-2">Full Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary outline-none font-body-md" required />
            </div>
            <div>
              <label className="font-label-sm text-on-surface-variant text-xs uppercase tracking-widest block mb-2">Hospital / Clinic</label>
              <input type="text" value={hospital} onChange={e => setHospital(e.target.value)} className="w-full px-4 py-3 border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary outline-none font-body-md" required />
            </div>
            <div>
              <label className="font-label-sm text-on-surface-variant text-xs uppercase tracking-widest block mb-2">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-3 border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary outline-none font-body-md" required />
            </div>
            <div>
              <label className="font-label-sm text-on-surface-variant text-xs uppercase tracking-widest block mb-2">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-3 border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary outline-none font-body-md" required />
            </div>
            {error && <p className="text-secondary font-label-sm text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="w-full bg-primary text-white py-4 rounded-xl font-label-sm hover:opacity-90 transition-all disabled:opacity-60">
              {loading ? 'Registering…' : 'Create Account'}
            </button>
            <p className="text-center font-body-md text-sm mt-4">
              Already have an account? <button type="button" onClick={() => { setView('login'); setError(''); setMsg(''); }} className="text-primary font-bold hover:underline">Sign in</button>
            </p>
          </form>
        )}

        {view === 'forgot' && (
          <form onSubmit={handleForgot} className="space-y-5">
            <div>
              <label className="font-label-sm text-on-surface-variant text-xs uppercase tracking-widest block mb-2">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-3 border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary outline-none font-body-md" required />
            </div>
            {error && <p className="text-secondary font-label-sm text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="w-full bg-primary text-white py-4 rounded-xl font-label-sm hover:opacity-90 transition-all disabled:opacity-60">
              {loading ? 'Sending…' : 'Send Recovery Email'}
            </button>
            <p className="text-center font-body-md text-sm mt-4">
              Remember your password? <button type="button" onClick={() => { setView('login'); setError(''); setMsg(''); }} className="text-primary font-bold hover:underline">Sign in</button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
};

// ── Ask AI View ──────────────────────────────────────────────────

const AskAIView = () => {
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Hello, Doctor. Ask me a clinical question or provide a Patient ID for a patient-specific analysis.' },
  ]);
  const [question, setQuestion] = useState('');
  const [patientId, setPatientId] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const q = question.trim();
    if (!q || q.length < 5 || loading) return;
    const pid = patientId.trim() || undefined;
    setQuestion('');
    const userLabel = pid ? `[Patient ${pid.slice(0, 8)}…] ${q}` : q;
    setMessages(prev => [...prev, { role: 'user', text: userLabel }]);
    setLoading(true);
    try {
      const { data } = await askDoctorAI(q, pid);
      setMessages(prev => [...prev, { role: 'ai', text: data.answer }]);
    } catch (err) {
      const msg = err.response?.status === 404
        ? 'Patient not found. Double-check the Patient ID.'
        : err.response?.status === 403
          ? 'Access denied. Only doctors and department heads can use this assistant.'
          : 'Unable to reach the AI right now. Please try again.';
      setMessages(prev => [...prev, { role: 'ai', text: msg }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] max-h-[700px]">
      {/* Optional patient context input */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex-1">
          <label className="font-label-sm text-xs text-on-surface-variant uppercase tracking-widest block mb-1">
            Patient ID (optional — for patient-specific analysis)
          </label>
          <input
            type="text"
            value={patientId}
            onChange={e => setPatientId(e.target.value)}
            placeholder="Paste patient UUID here…"
            className="w-full px-4 py-2.5 border border-amber-100 rounded-xl font-body-md text-sm bg-white focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        {patientId && (
          <button
            onClick={() => setPatientId('')}
            className="mt-5 text-on-surface-variant hover:text-secondary"
            title="Clear patient ID"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        )}
      </div>

      {patientId && (
        <div className="mb-3 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2">
          <span className="material-symbols-outlined text-amber-600 text-sm">person_search</span>
          <p className="font-label-sm text-xs text-amber-800">
            Context locked to patient <span className="font-bold">{patientId.slice(0, 8)}…</span>
          </p>
        </div>
      )}

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto space-y-4 bg-white rounded-2xl border border-amber-50 p-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {m.role === 'ai' && (
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                <span className="material-symbols-outlined text-primary text-base">smart_toy</span>
              </div>
            )}
            <div
              className={`max-w-[80%] px-4 py-3 rounded-2xl font-body-md text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-primary text-white rounded-tr-sm'
                  : 'bg-amber-50 text-amber-900 rounded-tl-sm border border-amber-100'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-primary text-base">smart_toy</span>
            </div>
            <div className="bg-amber-50 border border-amber-100 px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="mt-4 flex items-end gap-3">
        <textarea
          rows={2}
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask a clinical question… (Shift+Enter for new line)"
          className="flex-1 resize-none rounded-2xl border border-amber-100 bg-white px-4 py-3 font-body-md text-sm focus:outline-none focus:border-primary transition-colors"
          style={{ maxHeight: '120px', overflowY: 'auto' }}
        />
        <button
          onClick={send}
          disabled={question.trim().length < 5 || loading}
          className="w-12 h-12 bg-primary rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-opacity hover:opacity-90"
        >
          <span className="material-symbols-outlined text-white">send</span>
        </button>
      </div>
      <p className="mt-2 font-label-sm text-[10px] text-on-surface-variant/50 text-center">
        Powered by Groq · Responses reference ACOG/WHO guidelines · Not a substitute for clinical judgment
      </p>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'queue',    icon: 'dashboard',  label: 'Patient Queue' },
  { id: 'metrics',  icon: 'monitoring', label: 'Health Metrics' },
  { id: 'patients', icon: 'group',      label: 'Patients' },
  { id: 'ask_ai',   icon: 'smart_toy',  label: 'Ask AI' },
  { id: 'resources',icon: 'menu_book',  label: 'Resources' },
  { id: 'profile',  icon: 'badge',      label: 'Profile' },
  { id: 'settings', icon: 'settings',   label: 'Settings' },
];

const TAB_IDS = new Set(NAV_ITEMS.map((item) => item.id));
const isProviderTab = (tab) => TAB_IDS.has(tab);

const TODAY_DATE = new Date().toLocaleDateString('en-GB', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});

const ProviderDashboard = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loggedIn, setLoggedIn] = useState(isDoctorAuthenticated());
  const [doctor, setDoctor] = useState(getDoctorData());
  const tabParam = searchParams.get('tab');
  const activeView = isProviderTab(tabParam) ? tabParam : 'queue';
  const setActiveView = (id) => {
    if (!isProviderTab(id) || id === 'queue') {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ tab: id }, { replace: true });
    }
  };
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sseAlerts, setSseAlerts] = useState([]);
  const sseRef = useRef(null);

  useEffect(() => {
    if (!loggedIn) return;
    const token = localStorage.getItem('mc_doctor_token');
    if (!token) return;
    const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const es = new EventSource(
      `${BASE}/alerts/subscribe?token=${token}`
    );
    es.onmessage = (e) => {
      try {
        const alert = JSON.parse(e.data);
        setSseAlerts(prev => [alert, ...prev].slice(0, 5));
      } catch {}
    };
    sseRef.current = es;
    return () => es.close();
  }, [loggedIn]);

  useEffect(() => {
    try { sessionStorage.setItem('mc_provider_tab', activeView); } catch {}
  }, [activeView]);

  const handleDoctorLogin = (doc) => {
    setDoctor(doc);
    setLoggedIn(true);
  };

  const handleDismissAlert = (alert) => {
    if (alert.id) acknowledgeAlert(alert.id).catch(() => {});
    setSseAlerts(prev => prev.filter(a => a !== alert));
  };

  const handleSignOut = () => {
    clearDoctorAuth();
    if (sseRef.current) sseRef.current.close();
    setLoggedIn(false);
    setDoctor(null);
  };

  if (!loggedIn) {
    return <DoctorAuthScreen onLogin={handleDoctorLogin} />;
  }

  const doctorInitials = (doctor?.name || 'DR').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const doctorShortName = doctor?.name?.split(' ').slice(0, 2).join(' ') || 'Doctor';

  const VIEWS = {
    queue: QueueView,
    metrics: MetricsView,
    patients: PatientsView,
    ask_ai: AskAIView,
    resources: ResourcesView,
    profile: ProfileView,
    settings: SettingsView,
  };
  const ActiveView = VIEWS[activeView];

  const TODAY_LABELS = {
    queue: "Today's Queue",
    metrics: 'Health Metrics',
    patients: 'All Patients',
    ask_ai: 'Clinical AI Assistant',
    resources: 'Resources',
    profile: 'Provider Profile',
    settings: 'Settings',
  };

  return (
    <div className="font-body-md text-on-surface min-h-screen flex">
      <div className="grain-overlay" />

      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex h-screen w-64 fixed left-0 top-0 bg-[#1A1A18] border-r border-amber-900/30 shadow-2xl flex-col p-6 z-50">
        <div className="mb-8">
          <h1 className="font-headline-md text-xl font-bold text-white mb-1">9Care</h1>
          <p className="font-label-sm text-amber-500/70 text-[10px] uppercase tracking-widest">Maternal Health Portal</p>
        </div>
        <nav className="flex-1 space-y-1">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-body-md text-sm transition-all ${
                activeView === item.id
                  ? 'bg-amber-900/50 text-white border-l-4 border-amber-400'
                  : 'text-amber-200/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined text-lg" style={activeView === item.id ? { fontVariationSettings: "'FILL' 1" } : {}}>
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto pt-6 border-t border-amber-900/40">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-amber-900/50 flex items-center justify-center flex-shrink-0">
              <span className="font-bold text-white text-sm">{doctorInitials}</span>
            </div>
            <div>
              <p className="text-white font-medium text-sm">{doctorShortName}</p>
              <p className="text-amber-500/60 text-xs">{doctor?.role === 'department_head' ? 'Dept. Head' : 'Obstetrician'}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="text-amber-200/50 hover:text-white font-label-sm text-xs flex items-center gap-2 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">logout</span>
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-64 bg-[#1A1A18] h-full flex flex-col p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <h1 className="font-headline-md text-lg text-white">9Care</h1>
              <button onClick={() => setSidebarOpen(false)} className="text-white/60 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <nav className="flex-1 space-y-1">
              {NAV_ITEMS.map(item => (
                <button
                  key={item.id}
                  onClick={() => { setActiveView(item.id); setSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-body-md text-sm transition-all ${
                    activeView === item.id ? 'bg-amber-900/50 text-white border-l-4 border-amber-400' : 'text-amber-200/60 hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Main content */}
      <main className="lg:ml-64 flex-1 min-h-screen">
        <header className="sticky top-0 w-full z-40 bg-[#F7F3ED]/90 backdrop-blur-md border-b border-amber-100 px-6 lg:px-10 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 hover:bg-amber-50 rounded-full">
              <span className="material-symbols-outlined text-amber-900">menu</span>
            </button>
            <div>
              <h2 className="font-headline-lg text-amber-900">{TODAY_LABELS[activeView]}</h2>
              <p className="font-body-md text-on-surface-variant/70 text-sm">{TODAY_DATE}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <span className="material-symbols-outlined text-amber-900 cursor-pointer p-2 hover:bg-amber-50 rounded-full transition-all">notifications</span>
              {sseAlerts.length > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-secondary rounded-full text-white text-[9px] font-bold flex items-center justify-center border border-[#F7F3ED]">
                  {sseAlerts.length}
                </span>
              )}
            </div>
            <button onClick={handleSignOut} className="hidden md:flex items-center gap-2 text-sm font-label-sm text-on-surface-variant hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-sm">logout</span>
              Sign out
            </button>
          </div>
        </header>

        <div className="max-w-[1100px] mx-auto p-6 lg:p-10">
          <ActiveView
            navigate={navigate}
            fromTab={activeView}
            onEditProfile={() => setActiveView('profile')}
            onSignOut={handleSignOut}
            sseAlerts={sseAlerts}
            onDismiss={handleDismissAlert}
            doctor={doctor}
          />
        </div>
      </main>

      {/* FAB */}
      <div className="fixed bottom-8 right-8 z-50">
        <button className="bg-primary text-white w-14 h-14 rounded-full flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-transform">
          <span className="material-symbols-outlined text-2xl">add</span>
        </button>
      </div>
    </div>
  );
};

export default ProviderDashboard;
