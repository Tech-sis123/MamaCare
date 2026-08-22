import { useState } from 'react';
import {
  emptyVitalsEntry,
  newDoseRow,
  newScanRow,
  newVitalsId,
} from '../lib/consultationNotes';

const chipCls = (active) =>
  `px-3 py-1.5 rounded-lg text-xs font-label-sm border transition-colors ${
    active
      ? 'bg-primary text-white border-primary'
      : 'bg-surface-container-low text-on-surface border-outline/20 hover:border-primary/40'
  }`;

const inputCls =
  'bg-surface-container-low text-sm px-3 py-2 rounded-lg w-full text-on-surface border border-outline/20 focus:border-primary outline-none';

const ChipGroup = ({ options, value, onChange, ariaLabel }) => (
  <div className="flex flex-wrap gap-1.5" role="group" aria-label={ariaLabel}>
    {options.map((opt) => {
      const val = typeof opt === 'string' ? opt : opt.value;
      const label = typeof opt === 'string' ? opt : opt.label;
      const active = String(value || '') === String(val);
      return (
        <button
          key={val}
          type="button"
          className={chipCls(active)}
          aria-pressed={active}
          onClick={() => onChange(active ? '' : val)}
        >
          {label}
        </button>
      );
    })}
  </div>
);

const GRADE = ['+', '++', '+++', 'none'];
const LIE = ['Transverse', 'Oblique', 'Longitudinal', 'Indeterminate'];
const PRESENTATION = ['Cephalic', 'Breech', 'Face', 'Shoulder', 'Indeterminate'];

const SECTIONS = [
  { key: 'vitals', title: 'Vitals' },
  { key: 'drugs', title: 'Drugs and vaccination given' },
  { key: 'scans', title: 'Scans done during pregnancy' },
  { key: 'exam', title: 'Examination' },
  { key: 'remarks', title: 'Important Remarks' },
];

const formatTableDate = (raw) => {
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw);
  return d.toLocaleDateString('en-GB');
};

const bpPrCell = (row) => {
  const sys = row.bp_systolic;
  const dia = row.bp_diastolic;
  const pr = row.pr;
  const bp =
    sys !== '' && sys != null && dia !== '' && dia != null ? `${sys}/${dia}mmHg` : sys || dia ? `${sys || '—'}/${dia || '—'}` : '—';
  const pulse = pr !== '' && pr != null ? `${pr}bpm` : '';
  return (
    <div className="leading-tight">
      <div>{bp}</div>
      {pulse ? <div>{pulse}</div> : null}
    </div>
  );
};

const ScreenShell = ({ title, subtitle, saveMsg, saving, onBack, onSave, children }) => {
  const offline = saveMsg && /locally|offline|sync when/i.test(saveMsg);
  const err = saveMsg && !/saved/i.test(saveMsg);
  return (
    <div className="bg-background text-on-surface font-body-md min-h-screen flex flex-col">
      <div className="grain-overlay pointer-events-none" />
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-outline-variant/40">
        <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-3 flex items-start gap-3">
          <button
            type="button"
            onClick={onBack}
            className="mt-0.5 text-on-surface-variant hover:text-on-surface transition-colors shrink-0"
            aria-label="Back"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="font-headline-lg text-lg text-on-surface leading-tight">{title}</h1>
            {subtitle ? (
              <p className="font-body-md text-xs text-on-surface-variant truncate mt-0.5">{subtitle}</p>
            ) : null}
            {saveMsg ? (
              <p
                className={`font-label-sm text-[11px] mt-1 flex items-center gap-1 ${
                  err || offline ? 'text-secondary' : 'text-primary'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">
                  {offline ? 'cloud_off' : 'cloud_done'}
                </span>
                {saveMsg}
              </p>
            ) : (
              <p className="font-label-sm text-[11px] text-on-surface-variant mt-1">
                Progress saves automatically.
              </p>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-5 pb-32">{children}</main>
      <footer className="fixed bottom-0 inset-x-0 bg-surface/95 backdrop-blur border-t border-outline-variant z-40">
        <div className="max-w-4xl mx-auto w-full p-4 sm:p-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onBack}
            className="bg-surface-container-high text-on-surface py-3.5 rounded-lg font-label-sm text-sm border border-outline/20"
          >
            Back
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="bg-primary text-white py-3.5 rounded-lg font-label-sm text-sm hover:opacity-90 transition-all disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </footer>
    </div>
  );
};

const VitalsSection = ({ consult, setConsult }) => {
  const [showLog, setShowLog] = useState(false);
  const [draft, setDraft] = useState(emptyVitalsEntry);
  const setD = (field, value) => setDraft((prev) => ({ ...prev, [field]: value }));
  const rows = consult.vitals_log || [];

  const addEntry = () => {
    const hasAny = Object.entries(draft).some(([k, v]) => k !== 'id' && v != null && String(v).trim() !== '');
    if (!hasAny) return;
    setConsult((prev) => ({
      ...prev,
      vitals_log: [...(prev.vitals_log || []), { ...draft, id: newVitalsId() }],
    }));
    setDraft(emptyVitalsEntry());
    setShowLog(false);
  };

  const removeRow = (id) => {
    setConsult((prev) => ({
      ...prev,
      vitals_log: (prev.vitals_log || []).filter((r) => r.id !== id),
    }));
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-outline-variant/40 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[720px] border-collapse">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant">
                {['Date done', 'BP/PR', 'Wt (kg)', 'Ht (cm)', 'RR', 'Temp (°C)', 'Urinalysis', ''].map((h) => (
                  <th key={h || 'x'} className="text-left font-label-sm px-3 py-2 border-b border-outline-variant/30 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-on-surface-variant italic">
                    No vitals logged yet. Use Log vitals to add a row.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-outline-variant/20 last:border-0">
                    <td className="px-3 py-2 whitespace-nowrap">{formatTableDate(row.date)}</td>
                    <td className="px-3 py-2">{bpPrCell(row)}</td>
                    <td className="px-3 py-2">{row.weight_kg || '—'}</td>
                    <td className="px-3 py-2">{row.height_cm || '—'}</td>
                    <td className="px-3 py-2">{row.rr || '—'}</td>
                    <td className="px-3 py-2">{row.temp_c || '—'}</td>
                    <td className="px-3 py-2 leading-tight">
                      <div>Glucose: {row.glucose || '—'}</div>
                      <div>Protein: {row.protein || '—'}</div>
                    </td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        className="text-on-surface-variant hover:text-secondary"
                        aria-label="Remove vitals row"
                      >
                        <span className="material-symbols-outlined text-base">close</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowLog((s) => !s)}
        className="w-full inline-flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-lg font-label-sm text-sm"
      >
        <span className="material-symbols-outlined text-base">{showLog ? 'expand_less' : 'add'}</span>
        Log vitals
      </button>

      {showLog ? (
        <div className="bg-white border border-outline-variant/40 rounded-xl shadow-sm px-4 py-3 space-y-3">
          <p className="font-label-sm text-on-surface-variant text-xs uppercase">New vitals entry</p>
          <label className="block">
            <span className="font-label-sm text-xs text-on-surface-variant">Date done</span>
            <input type="date" className={`${inputCls} mt-1`} value={draft.date} onChange={(e) => setD('date', e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="font-label-sm text-xs text-on-surface-variant">BP systolic</span>
              <input type="number" className={`${inputCls} mt-1`} value={draft.bp_systolic} onChange={(e) => setD('bp_systolic', e.target.value)} placeholder="mmHg" />
            </label>
            <label className="block">
              <span className="font-label-sm text-xs text-on-surface-variant">BP diastolic</span>
              <input type="number" className={`${inputCls} mt-1`} value={draft.bp_diastolic} onChange={(e) => setD('bp_diastolic', e.target.value)} placeholder="mmHg" />
            </label>
            <label className="block">
              <span className="font-label-sm text-xs text-on-surface-variant">PR</span>
              <input type="number" className={`${inputCls} mt-1`} value={draft.pr} onChange={(e) => setD('pr', e.target.value)} placeholder="bpm" />
            </label>
            <label className="block">
              <span className="font-label-sm text-xs text-on-surface-variant">Weight (kg)</span>
              <input type="number" className={`${inputCls} mt-1`} value={draft.weight_kg} onChange={(e) => setD('weight_kg', e.target.value)} />
            </label>
            <label className="block">
              <span className="font-label-sm text-xs text-on-surface-variant">Height (cm)</span>
              <input type="number" className={`${inputCls} mt-1`} value={draft.height_cm} onChange={(e) => setD('height_cm', e.target.value)} />
            </label>
            <label className="block">
              <span className="font-label-sm text-xs text-on-surface-variant">RR</span>
              <input type="number" className={`${inputCls} mt-1`} value={draft.rr} onChange={(e) => setD('rr', e.target.value)} placeholder="cpm" />
            </label>
            <label className="block col-span-2">
              <span className="font-label-sm text-xs text-on-surface-variant">Temp (°C)</span>
              <input type="number" className={`${inputCls} mt-1`} value={draft.temp_c} onChange={(e) => setD('temp_c', e.target.value)} />
            </label>
          </div>
          <div>
            <p className="font-label-sm text-xs text-on-surface-variant mb-1.5">Urinalysis — protein</p>
            <ChipGroup options={GRADE} value={draft.protein} onChange={(v) => setD('protein', v)} ariaLabel="Protein" />
          </div>
          <div>
            <p className="font-label-sm text-xs text-on-surface-variant mb-1.5">Urinalysis — glucose</p>
            <ChipGroup options={GRADE} value={draft.glucose} onChange={(v) => setD('glucose', v)} ariaLabel="Glucose" />
          </div>
          <button
            type="button"
            onClick={addEntry}
            className="w-full bg-surface-container-high text-on-surface py-2.5 rounded-lg font-label-sm text-sm border border-outline/20"
          >
            Add to table
          </button>
        </div>
      ) : null}
    </div>
  );
};

const DoseList = ({ title, rows, onChange, onAdd, onRemove }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <p className="font-label-sm text-on-surface text-sm font-medium">{title}</p>
      <button type="button" onClick={onAdd} className="inline-flex items-center gap-1 text-xs text-primary font-label-sm">
        <span className="material-symbols-outlined text-sm">add</span>
        Add dose
      </button>
    </div>
    {(rows || []).map((row, i) => (
      <div key={`${title}-${i}`} className="grid grid-cols-[1fr_7rem_auto] gap-2 items-end">
        <label className="block min-w-0">
          <span className="font-label-sm text-[10px] text-on-surface-variant uppercase">Dose</span>
          <input className={`${inputCls} mt-1`} value={row.dose} onChange={(e) => onChange(i, 'dose', e.target.value)} placeholder="e.g. IPT1" />
        </label>
        <label className="block">
          <span className="font-label-sm text-[10px] text-on-surface-variant uppercase">GA (wks)</span>
          <input type="number" className={`${inputCls} mt-1`} value={row.ga_weeks} onChange={(e) => onChange(i, 'ga_weeks', e.target.value)} />
        </label>
        <button
          type="button"
          onClick={() => onRemove(i)}
          className="mb-1 text-on-surface-variant hover:text-secondary"
          aria-label={`Remove ${title} dose`}
        >
          <span className="material-symbols-outlined text-base">close</span>
        </button>
      </div>
    ))}
  </div>
);

const DrugsSection = ({ consult, setConsult }) => {
  const dv = consult.drugs_vaccines || { medications: '', ipt: [], tt: [] };
  const setDv = (patch) =>
    setConsult((prev) => ({
      ...prev,
      drugs_vaccines: { ...prev.drugs_vaccines, ...patch },
    }));
  const setDose = (key, index, field, value) => {
    const list = [...(dv[key] || [])];
    list[index] = { ...list[index], [field]: value };
    setDv({ [key]: list });
  };
  const addDose = (key) => setDv({ [key]: [...(dv[key] || []), newDoseRow()] });
  const removeDose = (key, index) => {
    const list = [...(dv[key] || [])];
    list.splice(index, 1);
    setDv({ [key]: list.length ? list : [newDoseRow()] });
  };

  return (
    <div className="bg-white border border-outline-variant/40 rounded-xl shadow-sm px-4 py-4 space-y-5">
      <label className="block">
        <span className="font-label-sm text-on-surface text-sm font-medium">All prescribed medications</span>
        <textarea
          className={`${inputCls} mt-2 min-h-[96px] text-left resize-y`}
          value={dv.medications}
          onChange={(e) => setDv({ medications: e.target.value })}
          placeholder="List medications…"
        />
      </label>
      <DoseList
        title="IPT (intermittent preventive treatment for malaria)"
        rows={dv.ipt}
        onChange={(i, f, v) => setDose('ipt', i, f, v)}
        onAdd={() => addDose('ipt')}
        onRemove={(i) => removeDose('ipt', i)}
      />
      <DoseList
        title="Tetanus toxoid (TT)"
        rows={dv.tt}
        onChange={(i, f, v) => setDose('tt', i, f, v)}
        onAdd={() => addDose('tt')}
        onRemove={(i) => removeDose('tt', i)}
      />
    </div>
  );
};

const ScansSection = ({ consult, setConsult }) => {
  const rows = consult.scans_log || [];
  const setRow = (index, field, value) => {
    setConsult((prev) => {
      const scans_log = [...(prev.scans_log || [])];
      scans_log[index] = { ...scans_log[index], [field]: value };
      return { ...prev, scans_log };
    });
  };
  const addRow = () => setConsult((prev) => ({ ...prev, scans_log: [...(prev.scans_log || []), newScanRow()] }));
  const removeRow = (index) => {
    setConsult((prev) => {
      const scans_log = [...(prev.scans_log || [])];
      scans_log.splice(index, 1);
      return { ...prev, scans_log: scans_log.length ? scans_log : [newScanRow()] };
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button type="button" onClick={addRow} className="inline-flex items-center gap-1 text-xs text-primary font-label-sm">
          <span className="material-symbols-outlined text-sm">add</span>
          Add scan
        </button>
      </div>
      {rows.map((row, i) => (
        <div key={row.id || `scan-${i}`} className="bg-white border border-outline-variant/40 rounded-xl shadow-sm px-4 py-3 space-y-2">
          <div className="flex justify-between items-center">
            <p className="font-label-sm text-xs text-on-surface-variant uppercase">Scan {i + 1}</p>
            {rows.length > 1 ? (
              <button type="button" onClick={() => removeRow(i)} className="text-on-surface-variant hover:text-secondary" aria-label="Remove scan">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            ) : null}
          </div>
          <label className="block">
            <span className="font-label-sm text-xs text-on-surface-variant">Date scan was done</span>
            <input type="date" className={`${inputCls} mt-1`} value={row.date} onChange={(e) => setRow(i, 'date', e.target.value)} />
          </label>
          <label className="block">
            <span className="font-label-sm text-xs text-on-surface-variant">Gestational age (weeks)</span>
            <input type="number" className={`${inputCls} mt-1`} value={row.ga_weeks} onChange={(e) => setRow(i, 'ga_weeks', e.target.value)} />
          </label>
          <label className="block">
            <span className="font-label-sm text-xs text-on-surface-variant">Notes on scan</span>
            <textarea className={`${inputCls} mt-1 min-h-[72px] text-left resize-y`} value={row.notes} onChange={(e) => setRow(i, 'notes', e.target.value)} />
          </label>
        </div>
      ))}
    </div>
  );
};

const ExamSection = ({ consult, setConsult }) => {
  const exam = consult.examination || {};
  const setEx = (field, value) =>
    setConsult((prev) => ({ ...prev, examination: { ...prev.examination, [field]: value } }));
  return (
    <div className="bg-white border border-outline-variant/40 rounded-xl shadow-sm px-4 py-2">
      <div className="py-3 border-b border-outline-variant/25">
        <p className="font-label-sm text-sm font-medium mb-2">Lie</p>
        <ChipGroup options={LIE} value={exam.lie} onChange={(v) => setEx('lie', v)} ariaLabel="Lie" />
      </div>
      <div className="py-3 border-b border-outline-variant/25">
        <p className="font-label-sm text-sm font-medium mb-2">Presentation</p>
        <ChipGroup options={PRESENTATION} value={exam.presentation} onChange={(v) => setEx('presentation', v)} ariaLabel="Presentation" />
      </div>
      <div className="py-3 border-b border-outline-variant/25">
        <p className="font-label-sm text-sm font-medium mb-2">SFH</p>
        <input className={inputCls} value={exam.sfh || ''} onChange={(e) => setEx('sfh', e.target.value)} placeholder="Enter value" />
      </div>
      <div className="py-3">
        <p className="font-label-sm text-sm font-medium mb-2">Fetal heart</p>
        <input className={inputCls} value={exam.fetal_heart || ''} onChange={(e) => setEx('fetal_heart', e.target.value)} placeholder="Enter value" />
      </div>
    </div>
  );
};

const RemarksSection = ({ consult, setConsult }) => (
  <div className="bg-white border border-outline-variant/40 rounded-xl shadow-sm px-4 py-4">
    <p className="font-body-md text-xs text-on-surface-variant mb-2">
      Persistent remarks shown on later consultations once saved.
    </p>
    <textarea
      className={`${inputCls} min-h-[160px] text-left resize-y`}
      value={consult.important_remarks}
      onChange={(e) => setConsult((prev) => ({ ...prev, important_remarks: e.target.value }))}
      placeholder="Important remarks…"
    />
  </div>
);

const ConsultationNotes = ({
  patientName,
  consult,
  setConsult,
  saveMsg,
  saving,
  onBack,
  onSave,
}) => {
  const [section, setSection] = useState(null);
  const current = SECTIONS.find((s) => s.key === section);

  if (!section) {
    return (
      <ScreenShell
        title="Consultation notes"
        subtitle={patientName}
        saveMsg={saveMsg}
        saving={saving}
        onBack={onBack}
        onSave={onSave}
      >
        <div className="space-y-3">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSection(s.key)}
              className="w-full bg-white border border-outline-variant/40 rounded-xl shadow-sm flex items-center justify-between p-4 text-left hover:bg-surface-container-low transition-colors"
            >
              <span className="font-label-sm text-on-surface font-semibold text-sm">{s.title}</span>
              <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
            </button>
          ))}
        </div>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title={current.title}
      subtitle="Consultation notes"
      saveMsg={saveMsg}
      saving={saving}
      onBack={() => setSection(null)}
      onSave={onSave}
    >
      {section === 'vitals' ? <VitalsSection consult={consult} setConsult={setConsult} /> : null}
      {section === 'drugs' ? <DrugsSection consult={consult} setConsult={setConsult} /> : null}
      {section === 'scans' ? <ScansSection consult={consult} setConsult={setConsult} /> : null}
      {section === 'exam' ? <ExamSection consult={consult} setConsult={setConsult} /> : null}
      {section === 'remarks' ? <RemarksSection consult={consult} setConsult={setConsult} /> : null}
    </ScreenShell>
  );
};

export default ConsultationNotes;
