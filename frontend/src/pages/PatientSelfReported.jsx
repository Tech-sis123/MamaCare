import React from 'react';

const DASH = '—';

const YES_NO = {
  yes: 'Yes',
  no: 'No',
  true: 'Yes',
  false: 'No',
};

const CONCEPTION = {
  spontaneous: 'Spontaneous (natural)',
  assisted: 'Assisted (IVF / IUI)',
};

const TEST_TYPE = {
  blood: 'Blood test',
  strip: 'Urine strip',
};

const TOP_METHOD = {
  medical: 'Medical (drugs / injection)',
  surgical: 'Surgical (MVA / D&C)',
  unknown: 'Not sure',
};

const CONTRA = {
  pill: 'Pill',
  injection: 'Injection',
  implant: 'Implant',
  iud: 'IUD / Coil',
  condom: 'Condom',
  other: 'Other',
};

const asText = (v) => {
  if (v == null || v === '') return DASH;
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (Array.isArray(v)) {
    const parts = v.map(asText).filter((x) => x && x !== DASH);
    return parts.length ? parts.join(', ') : DASH;
  }
  if (typeof v === 'object') {
    if (v.answer != null) return asText(v.answer);
    return DASH;
  }
  const s = String(v).trim();
  if (!s) return DASH;
  const mapped = YES_NO[s.toLowerCase()];
  return mapped || s;
};

const mapped = (v, dict) => {
  const raw = v == null || v === '' ? '' : String(v).trim();
  if (!raw) return DASH;
  if (dict[raw]) return dict[raw];
  if (dict[raw.toLowerCase()]) return dict[raw.toLowerCase()];
  return asText(v);
};

const formatDate = (raw, withTime = false) => {
  if (!raw) return DASH;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw);
  const day = d.toLocaleDateString('en-GB');
  if (!withTime) return day;
  return `${day} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
};

const formatKey = (key) =>
  String(key || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());

const intakeMap = (responses) => {
  const map = {};
  (responses || []).forEach((r) => {
    if (r?.question_key) map[r.question_key] = r.answer;
  });
  return map;
};

const get = (map, key) => asText(map[key]);

const parseIndexed = (map, prefix) => {
  const buckets = {};
  Object.keys(map).forEach((k) => {
    const m = new RegExp(`^${prefix}_(\\d+)_(.+)$`).exec(k);
    if (!m) return;
    const i = Number(m[1]);
    if (!buckets[i]) buckets[i] = { _i: i };
    buckets[i][m[2]] = map[k];
  });
  return Object.values(buckets).sort((a, b) => a._i - b._i);
};

const egaFromLmp = (lmpRaw) => {
  if (!lmpRaw) return null;
  const lmp = new Date(lmpRaw);
  if (Number.isNaN(lmp.getTime())) return null;
  const days = Math.floor((Date.now() - lmp.getTime()) / (86400000));
  return Math.floor(days / 7);
};

const gpLine = (G, P, alive) => {
  const g = Number(G);
  const p = Number(P);
  if (Number.isNaN(g) && Number.isNaN(p)) return DASH;
  let s = `G${Number.isNaN(g) ? '?' : g}P${Number.isNaN(p) ? '?' : p}`;
  if (alive != null && !Number.isNaN(Number(alive))) s += ` (${Number(alive)}A)`;
  return s;
};

const FieldTable = ({ rows }) => (
  <table className="w-full border-collapse text-[13px] leading-snug">
    <tbody>
      {rows.map((r, i) => (
        <tr key={r.label} className={i % 2 === 0 ? 'bg-white' : 'bg-stone-50'}>
          <th className="text-left font-medium text-stone-600 w-[40%] py-1.5 px-3 border border-stone-300 align-top">
            {r.label}
          </th>
          <td className="py-1.5 px-3 border border-stone-300 text-stone-900 align-top">{r.value}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

const DataTable = ({ columns, rows, empty }) => {
  if (!rows.length) {
    return <p className="text-[13px] italic text-stone-500 px-1 py-2">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[12px] leading-snug min-w-[520px]">
        <thead>
          <tr className="bg-stone-800 text-white">
            {columns.map((c) => (
              <th
                key={c.key}
                className="text-left font-medium py-1.5 px-2 border border-stone-700 whitespace-nowrap"
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id || i} className={i % 2 === 0 ? 'bg-white' : 'bg-stone-50'}>
              {columns.map((c) => (
                <td key={c.key} className="py-1.5 px-2 border border-stone-300 align-top">
                  {row[c.key] ?? DASH}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const ReportSection = ({ num, title, children }) => (
  <section className="mt-5 break-inside-avoid">
    <h2 className="text-[11px] font-semibold tracking-[0.16em] uppercase border-b-2 border-stone-800 pb-1 mb-2 text-stone-900">
      {num}. {title}
    </h2>
    {children}
  </section>
);

const PatientSelfReported = ({ patientName, fullPatient, summary, loading, onBack }) => {
  const p = fullPatient || {};
  const preg = p.pregnancies?.[0] || {};
  const map = intakeMap(p.intake_responses);
  const children = parseIndexed(map, 'child');
  const surgeries = parseIndexed(map, 'surgery');

  let childrenAlive = 0;
  children.forEach((c) => {
    const s = String(c.state_now || '').toLowerCase();
    if (s.includes('alive') || s === 'well' || s === 'healthy' || s === 'living') childrenAlive += 1;
  });
  if (!children.length && preg.parity != null) childrenAlive = Math.max(0, Number(preg.parity) || 0);
  if (map.children_alive != null && map.children_alive !== '') {
    const n = Number(map.children_alive);
    if (!Number.isNaN(n)) childrenAlive = n;
  }

  const ega = preg.current_ega_weeks ?? egaFromLmp(preg.lmp_date);
  const gp = gpLine(preg.gravidity, preg.parity, childrenAlive);
  const code = p.patient_code || (p.id ? `MC-${String(p.id).replace(/-/g, '').slice(0, 6).toUpperCase()}` : DASH);
  const printedAt = new Date();

  const lastBirthYear = children.reduce((acc, c) => {
    const y = Number(c.year);
    if (Number.isNaN(y)) return acc;
    if (acc == null || y > acc) return y;
    return acc;
  }, null);

  const conditions = (p.intake_responses || [])
    .filter((r) => r.domain === 'medical' && YES_NO[String(r.answer).toLowerCase()] === 'Yes')
    .map((r) => r.question_key)
    .filter((k) => !['surgery', 'drug_allergy', 'routine_medications'].includes(k) && !k.startsWith('surgery_'));

  const medicalKnown = ['hypertension', 'epilepsy', 'asthma', 'diabetes', 'peptic_ulcer_disease']
    .filter((k) => YES_NO[String(map[k]).toLowerCase()] === 'Yes')
    .map(formatKey);

  const extraConditions = conditions
    .filter((k) => !['hypertension', 'epilepsy', 'asthma', 'diabetes', 'peptic_ulcer_disease'].includes(k))
    .filter((k) => !k.includes('medication') && !k.includes('allergy'))
    .map(formatKey);

  const conditionList = [...medicalKnown, ...extraConditions];

  const systemFlags = (p.intake_responses || [])
    .filter((r) => (r.domain === 'systems' || r.domain === 'symptoms') && YES_NO[String(r.answer).toLowerCase()] === 'Yes')
    .map((r) => formatKey(r.question_key));

  const bp =
    preg.booking_bp_systolic != null && preg.booking_bp_diastolic != null
      ? `${preg.booking_bp_systolic}/${preg.booking_bp_diastolic} mmHg`
      : DASH;

  return (
    <div className="bg-stone-200 text-stone-900 font-body-md min-h-screen flex flex-col print:bg-white">
      <header className="mc-report-chrome sticky top-0 z-30 bg-stone-100/95 backdrop-blur border-b border-stone-300 print:hidden">
        <div className="max-w-[800px] mx-auto w-full px-4 sm:px-6 py-3 flex items-start gap-3">
          <button
            type="button"
            onClick={onBack}
            className="mt-0.5 text-stone-500 hover:text-stone-900 transition-colors shrink-0"
            aria-label="Back"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="font-headline-lg text-lg leading-tight">Antenatal clerking record</h1>
            <p className="text-xs text-stone-500 truncate mt-0.5">{patientName || p.name || 'Patient'}</p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 text-white text-xs font-label-sm hover:bg-stone-700"
          >
            <span className="material-symbols-outlined text-[16px]">print</span>
            Print
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[800px] mx-auto px-3 sm:px-4 py-5 pb-24 print:p-0 print:max-w-none">
        {loading ? (
          <p className="text-sm text-stone-500 italic px-2">Loading record…</p>
        ) : (
          <article className="mc-report-paper bg-white border border-stone-300 shadow-sm px-5 sm:px-8 py-7 print:border-0 print:shadow-none">
            <header className="border-b-2 border-stone-900 pb-3 mb-1">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] tracking-[0.22em] uppercase text-stone-500">MamaCare · Confidential</p>
                  <h1 className="text-xl sm:text-2xl font-semibold tracking-tight mt-0.5">
                    Antenatal Clerking Record
                  </h1>
                </div>
                <div className="text-right text-[11px] text-stone-600 leading-relaxed">
                  <p>Generated {formatDate(printedAt, true)}</p>
                  <p className="font-mono tracking-wide">{code}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-[12px]">
                <p>
                  <span className="text-stone-500">Name </span>
                  <span className="font-medium">{p.name || patientName || DASH}</span>
                </p>
                <p>
                  <span className="text-stone-500">Age </span>
                  <span className="font-medium">{asText(p.age)} yrs</span>
                </p>
                <p>
                  <span className="text-stone-500">GP </span>
                  <span className="font-medium">{gp}</span>
                </p>
                <p>
                  <span className="text-stone-500">EGA </span>
                  <span className="font-medium">{ega != null ? `${ega} weeks` : DASH}</span>
                </p>
              </div>
            </header>

            {summary ? (
              <section className="mt-4 border border-stone-300 bg-stone-50 px-3 py-2.5 break-inside-avoid">
                <h2 className="text-[10px] font-semibold tracking-[0.16em] uppercase text-stone-500 mb-1">
                  Clinical summary
                </h2>
                <p className="text-[13px] leading-relaxed text-stone-800">{summary}</p>
              </section>
            ) : null}

            <ReportSection num="1" title="Biodata">
              <FieldTable
                rows={[
                  { label: 'Name', value: asText(p.name || patientName) },
                  { label: 'Age', value: p.age != null ? `${p.age} years` : DASH },
                  { label: 'Level of education', value: asText(p.education_level) },
                  { label: 'Occupation', value: asText(p.occupation) },
                  { label: 'Marital status', value: asText(p.marital_status) },
                  { label: 'Address', value: asText(p.address) },
                  { label: 'Religion', value: asText(p.religion) },
                  { label: 'Ethnicity', value: asText(p.ethnicity) },
                  { label: 'Phone', value: asText(p.phone_number) },
                  { label: 'LMP', value: formatDate(preg.lmp_date) },
                  { label: 'EDD', value: formatDate(preg.edd_computed) },
                  { label: 'EGA', value: ega != null ? `${ega} weeks` : DASH },
                  { label: 'Gravidity (G)', value: asText(preg.gravidity) },
                  { label: 'Parity (P) — births after 24 weeks', value: asText(preg.parity) },
                  { label: 'Children alive', value: asText(childrenAlive) },
                  { label: 'Twin / multiple history', value: get(map, 'multi_gestation_history') },
                  { label: 'Number of multiple gestations', value: get(map, 'multi_gestation_count') },
                  { label: 'Last childbirth', value: lastBirthYear != null ? String(lastBirthYear) : DASH },
                ]}
              />
            </ReportSection>

            <ReportSection num="2" title="Index pregnancy">
              <FieldTable
                rows={[
                  { label: 'Pregnancy desired', value: get(map, 'desired') },
                  { label: 'How achieved', value: mapped(map.conception, CONCEPTION) },
                  {
                    label: 'Twin / multiple this pregnancy',
                    value: get(map, 'is_twin_pregnancy'),
                  },
                  { label: 'Pregnancy test done', value: get(map, 'preg_test_done') },
                  { label: 'Type of test', value: mapped(map.preg_test_type, TEST_TYPE) },
                  { label: 'Confirmed with ultrasound', value: get(map, 'scan_done') },
                  { label: 'Date of ultrasound', value: formatDate(map.scan_date) },
                  { label: 'Booking weight', value: preg.booking_weight != null ? `${preg.booking_weight} kg` : DASH },
                  { label: 'Booking height', value: preg.booking_height != null ? `${preg.booking_height} cm` : DASH },
                  { label: 'Blood pressure at booking', value: bp },
                  { label: 'Urinalysis', value: asText(preg.urinalysis) },
                  { label: 'Blood group', value: asText(preg.blood_group || map.blood_group) },
                  { label: 'Rhesus', value: asText(preg.rhesus) },
                  { label: 'Genotype', value: asText(preg.genotype || map.genotype) },
                  { label: 'RVD (HIV)', value: asText(preg.rvd_status) },
                  { label: 'VDRL', value: asText(preg.vdrl) },
                  { label: 'PCV', value: asText(preg.pcv) },
                  { label: 'Hepatitis B', value: asText(preg.hep_b) },
                  { label: 'Tetanus toxoid history', value: asText(preg.tetanus_history) },
                ]}
              />
            </ReportSection>

            <ReportSection num="3" title="Obstetric history">
              <p className="text-[12px] text-stone-600 mb-2">
                Previous deliveries (parity {asText(preg.parity)}).
              </p>
              <DataTable
                empty={
                  Number(preg.parity) === 0
                    ? 'Nulliparous — no previous deliveries recorded.'
                    : 'No previous-delivery cards recorded.'
                }
                columns={[
                  { key: 'n', label: '#' },
                  { key: 'year', label: 'Year' },
                  { key: 'mode', label: 'Mode / where' },
                  { key: 'gender', label: 'Sex' },
                  { key: 'bw', label: 'Birth weight' },
                  { key: 'cried', label: 'Cried at birth' },
                  { key: 'state', label: 'State now' },
                  { key: 'events', label: 'Complications' },
                ]}
                rows={children.map((c, i) => ({
                  id: c._i,
                  n: i + 1,
                  year: asText(c.year),
                  mode: asText(c.delivery_mode),
                  gender: asText(c.gender),
                  bw: c.birth_weight ? `${asText(c.birth_weight)} kg` : DASH,
                  cried: asText(c.cried_well),
                  state: asText(c.state_now),
                  events: [asText(c.events), asText(c.events_other), asText(c.postnatal_issues)]
                    .filter((x) => x && x !== DASH && x !== 'No')
                    .join('; ') || DASH,
                }))}
              />
            </ReportSection>

            <ReportSection num="4" title="Gynaecological history">
              <FieldTable
                rows={[
                  { label: 'Age at menarche', value: map.menarche_age ? `${asText(map.menarche_age)} years` : DASH },
                  { label: 'Duration of flow', value: map.flow_days ? `${asText(map.flow_days)} days` : DASH },
                  { label: 'Cycle length', value: map.cycle_days ? `${asText(map.cycle_days)} days` : DASH },
                  { label: 'Aware of contraceptives', value: get(map, 'contraceptive_aware') },
                  { label: 'Ever used contraceptives', value: get(map, 'contraceptive') },
                  { label: 'Type used', value: mapped(map.contraceptive_type, CONTRA) },
                  { label: 'When started', value: asText(map.contraceptive_start_date) },
                  {
                    label: 'Stopped / removed before this pregnancy',
                    value: get(map, 'contraceptive_removed_before_pregnancy'),
                  },
                  { label: 'Aware of Pap smear', value: get(map, 'pap_smear_aware') },
                  { label: 'Pap smear done', value: get(map, 'pap_smear') },
                  { label: 'Termination of pregnancy', value: get(map, 'top') },
                  { label: 'Number of TOPs', value: get(map, 'top_count') },
                  { label: 'Year of most recent TOP', value: get(map, 'top_year') },
                  { label: 'Method', value: mapped(map.top_method, TOP_METHOD) },
                  { label: 'Complications / sequelae', value: get(map, 'top_complications') },
                ]}
              />
            </ReportSection>

            <ReportSection num="5" title="Past medical history">
              <FieldTable
                rows={[
                  {
                    label: 'Known conditions',
                    value: conditionList.length ? conditionList.join('; ') : 'Nil of note',
                  },
                  { label: 'Pregnancy medications', value: get(map, 'pregnancy_medications') },
                  { label: 'Other routine medications', value: get(map, 'other_medications') },
                ]}
              />
            </ReportSection>

            <ReportSection num="6" title="Past surgical history">
              <DataTable
                empty={get(map, 'surgery') === 'Yes' ? 'Surgeries reported but details not recorded.' : 'No previous surgeries recorded.'}
                columns={[
                  { key: 'n', label: '#' },
                  { key: 'type', label: 'Procedure' },
                  { key: 'year', label: 'Year' },
                ]}
                rows={surgeries.map((s, i) => ({
                  id: s._i,
                  n: i + 1,
                  type: asText(s.type),
                  year: asText(s.year),
                }))}
              />
            </ReportSection>

            <ReportSection num="7" title="Drug / food allergies">
              <FieldTable
                rows={[
                  { label: 'Drug allergy', value: get(map, 'drug_allergy') },
                  { label: 'Details', value: get(map, 'allergy_details') },
                ]}
              />
            </ReportSection>

            <ReportSection num="8" title="Review of systems / reported symptoms">
              {systemFlags.length ? (
                <p className="text-[13px] mb-2">
                  <span className="text-stone-500">Intake flags: </span>
                  {systemFlags.join('; ')}
                </p>
              ) : (
                <p className="text-[13px] italic text-stone-500 mb-2">No systems complaints flagged at intake.</p>
              )}
              <DataTable
                empty="No symptom log entries."
                columns={[
                  { key: 'name', label: 'Symptom' },
                  { key: 'severity', label: 'Severity' },
                  { key: 'when', label: 'Reported' },
                  { key: 'notes', label: 'Notes' },
                ]}
                rows={(p.symptoms || []).map((s) => ({
                  id: s.id,
                  name: formatKey(s.symptom_key),
                  severity: asText(s.severity),
                  when: formatDate(s.reported_at, true),
                  notes: asText(s.notes),
                }))}
              />
            </ReportSection>

            <footer className="mt-8 pt-3 border-t border-stone-300 text-[10px] text-stone-500 flex justify-between gap-4">
              <p>Source: patient-reported intake and clinic record. Missing items shown as —.</p>
              <p className="whitespace-nowrap">{code}</p>
            </footer>
          </article>
        )}
      </main>
    </div>
  );
};

export default PatientSelfReported;
