import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { doctorLogin as apiDoctorLogin, searchPatients, acknowledgeAlert } from '../lib/api';
import { setDoctorAuth, clearDoctorAuth, isDoctorAuthenticated, getDoctorData } from '../lib/auth';

// ── Mock data ────────────────────────────────────────────────────
const PATIENTS = [
  { id: 1, name: 'Ngozi Okonkwo',   age: 29, weeks: 14, risk: 'HIGH',   flags: ['High BP', 'Low Hb'],   time: '08:30', status: 'WAITING',     initials: 'NO' },
  { id: 2, name: 'Fatima Yusuf',    age: 22, weeks: 20, risk: 'HIGH',   flags: ['Severe Edema'],        time: '09:15', status: 'IN PROGRESS', initials: 'FY' },
  { id: 3, name: 'Chioma Adebayo',  age: 31, weeks: 24, risk: 'MEDIUM', flags: ['Gestational GTT'],     time: '10:00', status: 'QUEUED',      initials: 'CA' },
  { id: 4, name: 'Blessing Efe',    age: 27, weeks: 16, risk: 'LOW',    flags: ['Routine 24wk'],        time: '11:30', status: 'QUEUED',      initials: 'BE' },
  { id: 5, name: 'Amaka Obi',       age: 25, weeks: 32, risk: 'LOW',    flags: ['Routine Follow-up'],   time: '07:45', status: 'DONE',        initials: 'AO' },
  { id: 6, name: 'Kemi Adeyemi',    age: 34, weeks: 8,  risk: 'MEDIUM', flags: ['Anaemia'],             time: '12:00', status: 'QUEUED',      initials: 'KA' },
  { id: 7, name: 'Grace Eze',       age: 19, weeks: 6,  risk: 'LOW',    flags: ['First visit'],         time: '13:30', status: 'QUEUED',      initials: 'GE' },
];

const RISK_COLORS = {
  HIGH:   { bar: 'bg-secondary', badge: 'bg-secondary text-white',        border: 'border-secondary',    text: 'text-secondary' },
  MEDIUM: { bar: 'bg-amber-500', badge: 'bg-amber-100 text-amber-800',   border: 'border-amber-500',    text: 'text-amber-700' },
  LOW:    { bar: 'bg-primary',   badge: 'bg-primary/10 text-primary',     border: 'border-primary',      text: 'text-primary' },
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

const PROVIDER_PROFILE = {
  name: 'Dr. Osasumwen Osagie',
  initials: 'DO',
  title: 'Consultant Obstetrician & Gynaecologist',
  hospital: 'University of Benin Teaching Hospital',
  department: 'Obstetrics & Gynaecology',
  license: 'MDCN/OBG/20841',
  email: 'dr.osagie@ubth.edu.ng',
  phone: '+234 803 555 0194',
  location: 'Benin City, Edo State',
  status: 'Active today',
  shift: '08:00 - 16:00',
  languages: ['English', 'Pidgin', 'Edo'],
  specialties: ['High-risk ANC', 'Pre-eclampsia', 'Antenatal triage', 'Fetal monitoring'],
  bio:
    'Focused on high-risk maternal care, safe triage, and practical counseling for pregnant mothers in low-resource settings.',
  stats: [
    { label: 'Patients reviewed', value: '47' },
    { label: 'High-risk escalations', value: '8' },
    { label: 'Avg response time', value: '38s' },
    { label: 'Follow-up adherence', value: '81%' },
  ],
  credentials: [
    { label: 'MBBS', value: 'University of Lagos' },
    { label: 'FWACS', value: 'West African College of Surgeons' },
    { label: 'Department role', value: 'ANC Lead, UBTH Pilot' },
  ],
  availability: [
    { day: 'Mon - Wed', time: 'Ward round and triage' },
    { day: 'Thu', time: 'Referral review clinic' },
    { day: 'Fri', time: 'Remote case follow-up' },
  ],
};

// ── Sub-views ────────────────────────────────────────────────────

const QueueView = ({ navigate, sseAlerts, onDismiss }) => {
  const [filter, setFilter] = useState('All');
  const filters = ['All', 'HIGH', 'MEDIUM', 'LOW', 'Done'];
  const filtered = PATIENTS.filter(p => {
    if (filter === 'All') return p.status !== 'DONE';
    if (filter === 'Done') return p.status === 'DONE';
    return p.risk === filter;
  });
  const highCount = PATIENTS.filter(p => p.risk === 'HIGH').length;

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

      {/* Urgent banner */}
      <div className="bg-secondary/10 border border-secondary/20 rounded-xl p-4 flex items-center gap-4">
        <div className="bg-secondary text-white w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-lg">priority_high</span>
        </div>
        <p className="font-body-md text-secondary font-semibold">
          🚨 {highCount} HIGH RISK patients in queue — review immediately
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Today',  value: PATIENTS.length, bg: 'bg-white border border-amber-50',                     fg: 'text-primary' },
          { label: 'High Risk',    value: highCount,        bg: 'bg-secondary/5 border border-secondary/10',              fg: 'text-secondary' },
          { label: 'Pending',      value: PATIENTS.filter(p => p.status === 'QUEUED').length, bg: 'bg-amber-50 border border-amber-200', fg: 'text-amber-800' },
          { label: 'Seen Today',   value: PATIENTS.filter(p => p.status === 'DONE').length,  bg: 'bg-primary/5 border border-primary/10', fg: 'text-primary' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-6 custom-shadow`}>
            <p className={`font-label-sm text-xs uppercase mb-1 ${s.fg} opacity-70`}>{s.label}</p>
            <h3 className={`font-display-xl text-4xl leading-none ${s.fg}`}>{String(s.value).padStart(2, '0')}</h3>
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
        {filtered.map(p => {
          const rc = RISK_COLORS[p.risk];
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
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className={`font-label-sm text-[10px] px-3 py-1 rounded-full ${STATUS_STYLE[p.status]}`}>
                  {p.status}
                </span>
                {p.status !== 'DONE' && (
                  <button
                    onClick={() => navigate('/provider/patient', { state: { patient: p } })}
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
        <p className="font-body-md text-on-surface-variant/70 mt-1">UBTH Pilot — Week 12 Summary</p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: 'Registered Patients', value: '47',   sub: '+3 this week',    icon: 'group',         color: 'text-primary' },
          { label: 'Avg Risk Score',       value: '2.1', sub: 'of 3.0 max',      icon: 'analytics',     color: 'text-amber-700' },
          { label: 'Alert Response Time',  value: '38s', sub: 'avg · SLA: 60s',  icon: 'timer',         color: 'text-primary' },
          { label: 'Appt Adherence',       value: '81%', sub: '↑ 6% vs last week', icon: 'event_available', color: 'text-primary' },
          { label: 'Danger Alerts Sent',   value: '3',   sub: 'this week',       icon: 'warning',       color: 'text-secondary' },
          { label: 'Modules Completed',    value: '112', sub: 'across all patients', icon: 'school',    color: 'text-primary' },
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

      {/* Risk distribution */}
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

      {/* Weekly trend placeholder */}
      <div className="bg-white rounded-xl p-6 custom-shadow border border-amber-50">
        <h3 className="font-headline-md text-amber-900 mb-2">Registrations — Last 4 Weeks</h3>
        <p className="font-body-md text-on-surface-variant text-sm mb-6">New patients registered per week</p>
        <div className="flex items-end gap-4 h-28">
          {[9, 12, 15, 11].map((v, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="font-label-sm text-on-surface-variant text-xs">{v}</span>
              <div
                className="w-full bg-primary/70 rounded-t-md"
                style={{ height: `${(v / 15) * 100}%` }}
              />
              <span className="font-label-sm text-outline text-[10px]">W{i + 1}</span>
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
  const [apiResults, setApiResults] = useState(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!search.trim()) { setApiResults(null); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await searchPatients(search);
        setApiResults(Array.isArray(data) ? data : data?.patients || []);
      } catch {
        setApiResults(null);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const baseList = apiResults
    ? apiResults.map(p => ({
        id: p.id,
        name: p.name || '—',
        age: p.age || '—',
        weeks: p.gestational_age?.weeks || '—',
        risk: (p.risk_tier || 'LOW').toUpperCase(),
        flags: p.flags || [],
        time: '',
        status: 'QUEUED',
        initials: (p.name || 'P').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
      }))
    : PATIENTS;

  const filtered = baseList.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchRisk   = riskFilter === 'All' || p.risk === riskFilter;
    return matchSearch && matchRisk;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-headline-lg text-amber-900 text-2xl">All Patients</h2>
        <p className="font-body-md text-on-surface-variant/70 mt-1">{PATIENTS.length} registered in pilot</p>
      </div>

      {/* Search + filter */}
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

      {/* Patient cards */}
      <div className="space-y-3">
        {searching && (
          <div className="text-center py-8 text-on-surface-variant font-body-md text-sm">Searching…</div>
        )}
        {!searching && filtered.length === 0 && (
          <div className="text-center py-16 text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl block mb-2">person_search</span>
            <p className="font-body-md">No patients found</p>
          </div>
        )}
        {filtered.map(p => {
          const rc = RISK_COLORS[p.risk];
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
  const d = doctor || PROVIDER_PROFILE;
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
            <h3 className="font-headline-lg text-3xl mt-2">{d.name}</h3>
            <p className="text-amber-100/80 mt-1">{d.title || 'Obstetrician · UBTH'}</p>
            <div className="flex flex-wrap gap-2 mt-4">
              <span className="px-3 py-1 rounded-full bg-white/10 text-xs">{d.department || 'Obstetrics & Gynaecology'}</span>
              <span className="px-3 py-1 rounded-full bg-white/10 text-xs">{d.hospital || 'UBTH'}</span>
              <span className="px-3 py-1 rounded-full bg-secondary/20 text-secondary text-xs border border-secondary/30">{d.role || 'doctor'}</span>
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-8 relative">
          {PROVIDER_PROFILE.stats.map(stat => (
            <div key={stat.label} className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <p className="text-xs uppercase tracking-widest text-amber-300/60 font-label-sm">{stat.label}</p>
              <p className="text-2xl font-headline-md mt-2">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-2xl p-5 custom-shadow border border-amber-50">
          <p className="font-label-sm text-on-surface-variant uppercase text-xs tracking-widest">Contact</p>
          <div className="mt-4 space-y-3">
            {[
              { icon: 'mail',        label: 'Email',    value: d.email || '—' },
              { icon: 'call',        label: 'Phone',    value: d.phone || PROVIDER_PROFILE.phone },
              { icon: 'location_on', label: 'Location', value: d.location || PROVIDER_PROFILE.location },
              { icon: 'badge',       label: 'License',  value: d.license || PROVIDER_PROFILE.license },
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

        <div className="bg-white rounded-2xl p-5 custom-shadow border border-amber-50">
          <p className="font-label-sm text-on-surface-variant uppercase text-xs tracking-widest">Credentials</p>
          <div className="mt-4 space-y-3">
            {PROVIDER_PROFILE.credentials.map(item => (
              <div key={item.label} className="flex items-center justify-between gap-4 py-2 border-b border-outline-variant/20 last:border-0">
                <span className="text-xs uppercase tracking-wider text-outline font-label-sm">{item.label}</span>
                <span className="text-sm text-on-surface text-right">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 custom-shadow border border-amber-50">
          <p className="font-label-sm text-on-surface-variant uppercase text-xs tracking-widest">Languages</p>
          <div className="flex flex-wrap gap-2 mt-4">
            {PROVIDER_PROFILE.languages.map(lang => (
              <span key={lang} className="px-3 py-1 rounded-full bg-amber-50 border border-amber-100 text-sm text-amber-900">
                {lang}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>

    <div className="grid lg:grid-cols-[1fr_1fr] gap-6">
      <div className="bg-white rounded-2xl p-6 custom-shadow border border-amber-50">
        <p className="font-label-sm text-on-surface-variant uppercase text-xs tracking-widest">About</p>
        <p className="mt-4 text-on-surface leading-7">{PROVIDER_PROFILE.bio}</p>
        <div className="flex flex-wrap gap-2 mt-5">
          {PROVIDER_PROFILE.specialties.map(item => (
            <span key={item} className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm border border-primary/10">
              {item}
            </span>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 custom-shadow border border-amber-50">
        <div className="flex items-center justify-between">
          <p className="font-label-sm text-on-surface-variant uppercase text-xs tracking-widest">Availability</p>
          <span className="text-xs text-outline font-label-sm">Mock weekly schedule</span>
        </div>
        <div className="mt-4 space-y-3">
          {PROVIDER_PROFILE.availability.map(slot => (
            <div key={slot.day} className="flex items-center justify-between gap-4 py-3 px-4 rounded-xl bg-amber-50/70">
              <div>
                <p className="text-sm font-medium text-on-surface">{slot.day}</p>
                <p className="text-xs text-outline mt-1">{slot.time}</p>
              </div>
              <span className="material-symbols-outlined text-primary">schedule</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
  );
};

const SettingsView = ({ onEditProfile, onSignOut }) => {
  const [notifSMS, setNotifSMS]         = useState(true);
  const [notifWhatsApp, setNotifWhatsApp] = useState(true);
  const [notifEmail, setNotifEmail]     = useState(false);

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

      {/* Account */}
      <div className="bg-white rounded-xl custom-shadow border border-amber-50 overflow-hidden">
        <div className="p-4 border-b border-amber-50">
          <p className="font-label-sm text-on-surface-variant uppercase text-xs tracking-widest">Account</p>
        </div>
        <div className="flex items-center gap-4 p-6">
          <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center">
            <span className="font-headline-md text-primary text-2xl">DO</span>
          </div>
          <div>
            <p className="font-headline-md text-amber-900 text-lg">Dr. Osasumwen Osagie</p>
            <p className="font-body-md text-on-surface-variant text-sm">Obstetrician · UBTH</p>
            <p className="font-label-sm text-outline text-xs mt-1">dr.osagie@ubth.edu.ng</p>
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

      {/* Notifications */}
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

      {/* Department */}
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
              <p className="text-amber-500/60 text-xs">Obstetrician · UBTH</p>
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
        {/* Top header */}
        <header className="sticky top-0 w-full z-40 bg-[#F7F3ED]/90 backdrop-blur-md border-b border-amber-100 px-6 lg:px-10 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 hover:bg-amber-50 rounded-full">
              <span className="material-symbols-outlined text-amber-900">menu</span>
            </button>
            <div>
              <h2 className="font-headline-lg text-amber-900">{TODAY_LABELS[activeView]}</h2>
              <p className="font-body-md text-on-surface-variant/70 text-sm">Wednesday 14 May 2025</p>
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
