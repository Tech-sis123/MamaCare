import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  doctorLogin as apiDoctorLogin,
  getDoctorQueue,
  searchPatients,
  acknowledgeAlert,
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
  { title: 'UBTH Referral Forms',          type: 'DOC',  size: '0.3 MB', category: 'Admin' },
];

const toQueuePatient = (apt) => ({
  id: apt.patient.id,
  appointment_id: apt.appointment_id,
  name: apt.patient.name || '—',
  age: apt.patient.age || '—',
  weeks: apt.patient.ega_weeks || '—',
  risk: (apt.patient.risk_tier || 'LOW').toUpperCase(),
  flags: [],
  time: new Date(apt.slot_start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  status: apt.status === 'completed' ? 'DONE' : 'QUEUED',
  initials: (apt.patient.name || 'P').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
});

const toPatientRow = (p) => ({
  id: p.id,
  name: p.name || '—',
  age: p.age || '—',
  weeks: p.ega_weeks || '—',
  risk: (p.risk_tier || 'LOW').toUpperCase(),
  flags: [],
  initials: (p.name || 'P').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
});

// ── Sub-views ────────────────────────────────────────────────────

const QueueView = ({ navigate, sseAlerts, onDismiss }) => {
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
        {(sseAlerts || []).map((alert, i) => (
          <div key={alert.id || i} className="bg-secondary text-white px-5 py-4 rounded-xl shadow-2xl flex items-center gap-4 border border-secondary/50 animate-slide-up">
            <span className="material-symbols-outlined flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
            <div className="flex-1 min-w-0">
              <p className="font-label-sm text-xs uppercase tracking-wide">Critical Alert</p>
              <p className="font-body-md font-bold text-sm truncate">
                {alert.patient_name || alert.message || 'New high-risk alert'}
              </p>
            </div>
            <button onClick={() => onDismiss(alert)} className="ml-1 text-white/60 hover:text-white shrink-0">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        ))}
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
          { label: 'Total Today',  value: queue.length,                                          bg: 'bg-white border border-amber-50',                        fg: 'text-primary' },
          { label: 'High Risk',    value: highCount,                                              bg: 'bg-secondary/5 border border-secondary/10',              fg: 'text-secondary' },
          { label: 'Pending',      value: queue.filter(p => p.status === 'QUEUED').length,        bg: 'bg-amber-50 border border-amber-200',                    fg: 'text-amber-800' },
          { label: 'Seen Today',   value: queue.filter(p => p.status === 'DONE').length,          bg: 'bg-primary/5 border border-primary/10',                  fg: 'text-primary' },
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
                <div className="text-center w-12 hidden sm:block">
                  <p className={`font-label-sm text-xs ${rc.text}`}>{p.time}</p>
                </div>
                <div>
                  <h4 className="font-headline-md text-amber-900 text-base">{p.name}</h4>
                  <p className="font-body-md text-on-surface-variant text-sm mt-0.5">
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
                    onClick={() => navigate('/provider/patient', { state: { patient: p, appointment_id: p.appointment_id } })}
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
        <p className="font-body-md text-on-surface-variant/70 mt-1">UBTH Pilot — Summary</p>
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

const PatientsView = ({ navigate }) => {
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('All');
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const delay = search.trim() ? 400 : 0;
    const t = setTimeout(() => {
      setLoading(true);
      searchPatients(search)
        .then(({ data }) => {
          const list = Array.isArray(data) ? data : data?.patients || [];
          setPatients(list.map(toPatientRow));
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, delay);
    return () => clearTimeout(t);
  }, [search]);

  const filtered = patients.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchRisk   = riskFilter === 'All' || p.risk === riskFilter;
    return matchSearch && matchRisk;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-headline-lg text-amber-900 text-2xl">All Patients</h2>
        <p className="font-body-md text-on-surface-variant/70 mt-1">
          {loading ? 'Loading…' : `${patients.length} patient${patients.length !== 1 ? 's' : ''} registered`}
        </p>
      </div>

      <div className="flex gap-3 flex-col sm:flex-row">
        <div className="relative flex-grow">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">search</span>
          <input
            type="text"
            placeholder="Search patient name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none font-body-md bg-white"
          />
        </div>
        <select
          value={riskFilter}
          onChange={e => setRiskFilter(e.target.value)}
          className="px-4 py-3 border border-outline-variant rounded-xl font-body-md bg-white focus:ring-2 focus:ring-primary focus:border-primary outline-none"
        >
          <option>All</option>
          <option>HIGH</option>
          <option>MEDIUM</option>
          <option>LOW</option>
        </select>
      </div>

      <div className="space-y-3">
        {loading && (
          <div className="text-center py-8 text-on-surface-variant font-body-md text-sm">Loading patients…</div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-16 text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl block mb-2">person_search</span>
            <p className="font-body-md">No patients found</p>
          </div>
        )}
        {filtered.map(p => {
          const rc = RISK_COLORS[p.risk] || RISK_COLORS.LOW;
          return (
            <button
              key={p.id}
              onClick={() => navigate('/provider/patient', { state: { patient: p } })}
              className="w-full text-left group relative bg-white border border-amber-50 rounded-xl p-5 flex items-center justify-between transition-all hover:shadow-md custom-shadow hover:border-primary/20"
            >
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${rc.bar} rounded-l-xl`} />
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold ${rc.badge} flex-shrink-0`}>
                  {p.initials}
                </div>
                <div>
                  <p className="font-headline-md text-amber-900">{p.name}</p>
                  <p className="font-body-md text-on-surface-variant text-sm">Age {p.age} · Week {p.weeks}</p>
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
        <p className="font-body-md text-on-surface-variant/70 mt-1">UBTH Maternal Health Portal</p>
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
            <p className="text-amber-100/80 mt-1">Obstetrician · UBTH</p>
            <div className="flex flex-wrap gap-2 mt-4">
              <span className="px-3 py-1 rounded-full bg-white/10 text-xs">Obstetrics & Gynaecology</span>
              <span className="px-3 py-1 rounded-full bg-white/10 text-xs">UBTH</span>
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
              {d.role === 'department_head' ? 'Department Head' : 'Obstetrician'} · UBTH
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
            { label: 'Hospital',    value: 'University of Benin Teaching Hospital' },
            { label: 'Department',  value: 'Obstetrics & Gynaecology' },
            { label: 'Pilot Group', value: 'UBTH ANC Pilot — Cohort 1' },
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

// ── Doctor Login ─────────────────────────────────────────────────
const DoctorLoginScreen = ({ onLogin }) => {
  const [email, setEmail] = useState('dr.adaeze@ubth.ng');
  const [password, setPassword] = useState('mamacare123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
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

  return (
    <div className="min-h-screen bg-[#1A1A18] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl p-8 shadow-2xl">
        <div className="mb-8">
          <h1 className="font-headline-lg text-amber-900 text-2xl mb-1">UBTH Provider Portal</h1>
          <p className="font-body-md text-on-surface-variant text-sm">Sign in to access patient care dashboard</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="font-label-sm text-on-surface-variant text-xs uppercase tracking-widest block mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary outline-none font-body-md"
              required
            />
          </div>
          <div>
            <label className="font-label-sm text-on-surface-variant text-xs uppercase tracking-widest block mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary outline-none font-body-md"
              required
            />
          </div>
          {error && <p className="text-secondary font-label-sm text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white py-4 rounded-xl font-label-sm hover:opacity-90 transition-all disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'queue',    icon: 'dashboard',  label: 'Patient Queue' },
  { id: 'metrics',  icon: 'monitoring', label: 'Health Metrics' },
  { id: 'patients', icon: 'group',      label: 'Patients' },
  { id: 'resources',icon: 'menu_book',  label: 'Resources' },
  { id: 'profile',  icon: 'badge',      label: 'Profile' },
  { id: 'settings', icon: 'settings',   label: 'Settings' },
];

const TODAY_DATE = new Date().toLocaleDateString('en-GB', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});

const ProviderDashboard = () => {
  const navigate = useNavigate();
  const [loggedIn, setLoggedIn] = useState(isDoctorAuthenticated());
  const [doctor, setDoctor] = useState(getDoctorData());
  const [activeView, setActiveView] = useState('queue');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sseAlerts, setSseAlerts] = useState([]);
  const sseRef = useRef(null);

  useEffect(() => {
    if (!loggedIn) return;
    const token = localStorage.getItem('mc_doctor_token');
    if (!token) return;
    const es = new EventSource(
      `https://mamacare-api.onrender.com/alerts/subscribe?token=${token}`
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
    return <DoctorLoginScreen onLogin={handleDoctorLogin} />;
  }

  const doctorInitials = (doctor?.name || 'DR').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const doctorShortName = doctor?.name?.split(' ').slice(0, 2).join(' ') || 'Doctor';

  const VIEWS = {
    queue: QueueView,
    metrics: MetricsView,
    patients: PatientsView,
    resources: ResourcesView,
    profile: ProfileView,
    settings: SettingsView,
  };
  const ActiveView = VIEWS[activeView];

  const TODAY_LABELS = {
    queue: "Today's Queue",
    metrics: 'Health Metrics',
    patients: 'All Patients',
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
          <h1 className="font-headline-md text-xl font-bold text-white mb-1">UBTH Care</h1>
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
              <p className="text-amber-500/60 text-xs">{doctor?.role === 'department_head' ? 'Dept. Head' : 'Obstetrician'} · UBTH</p>
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
              <h1 className="font-headline-md text-lg text-white">UBTH Care</h1>
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
