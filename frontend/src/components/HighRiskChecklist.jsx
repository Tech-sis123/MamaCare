import { useState, useEffect } from 'react';
import { getRiskConditions, saveRiskConditions } from '../lib/api';

/**
 * Doctor checklist of the clinic's high-risk pregnancy conditions.
 * Conditions found in the patient's records show as already ticked (with why);
 * doctors tick anything else they know about, and saving re-runs the risk engine.
 */
const HighRiskChecklist = ({ patientId, onSaved }) => {
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;
    getRiskConditions(patientId)
      .then(({ data: d }) => {
        if (cancelled) return;
        setData(d);
        setSelected(d.selected || []);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load the high-risk checklist.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  if (loading) return <p className="text-sm text-on-surface-variant italic pt-3">Loading checklist…</p>;
  if (!data) return <p className="text-sm text-error pt-3">{error}</p>;

  const detected = new Map((data.detected || []).map((d) => [d.id, d]));
  const saved = new Set(data.selected || []);
  const dirty = selected.length !== saved.size || selected.some((id) => !saved.has(id));

  const toggle = (id) => {
    setNotice('');
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const { data: d } = await saveRiskConditions(patientId, selected);
      setData(d);
      setSelected(d.selected || []);
      setNotice(`Saved. Risk is now ${d.tier}.`);
      onSaved?.(d);
    } catch {
      setError('Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Detected-only signals (not on the checklist) are listed separately
  const detectedOnly = (data.detected || []).filter((d) => !data.conditions.find((c) => c.id === d.id)?.checklist);

  return (
    <div className="space-y-4 pt-3">
      <p className="text-xs text-on-surface-variant">
        Based on the clinic's high-risk pregnancy guideline. Items found in this patient's records are ticked automatically.
        Tick anything else you know about, then save. Every listed condition makes the pregnancy HIGH risk.
      </p>

      {detectedOnly.length > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-900">Also found in records</p>
          {detectedOnly.map((d) => (
            <p key={d.id} className="text-xs text-amber-950">
              {d.reason} <span className="text-amber-700">({d.tier})</span>
            </p>
          ))}
        </div>
      )}

      {Object.entries(data.categories)
        .filter(([cat]) => data.conditions.some((c) => c.category === cat && c.checklist))
        .map(([cat, title]) => (
          <fieldset key={cat} className="space-y-1.5">
            <legend className="font-label-sm text-[11px] uppercase tracking-wide text-on-surface-variant mb-1">{title}</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {data.conditions
                .filter((c) => c.category === cat && c.checklist)
                .map((c) => {
                  const auto = detected.get(c.id);
                  const checked = !!auto || selected.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 text-sm ${
                        auto
                          ? 'bg-secondary/5 border-secondary/20 cursor-default'
                          : checked
                            ? 'bg-primary/5 border-primary/30 cursor-pointer'
                            : 'bg-white border-outline-variant/40 cursor-pointer hover:bg-surface-container-low'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 rounded text-primary focus:ring-primary"
                        checked={checked}
                        disabled={!!auto}
                        onChange={() => toggle(c.id)}
                      />
                      <span className="min-w-0">
                        <span className="text-on-surface">{c.label}</span>
                        {auto && <span className="block text-[11px] text-secondary">Found in records: {auto.reason}</span>}
                      </span>
                    </label>
                  );
                })}
            </div>
          </fieldset>
        ))}

      <div className="flex items-center justify-end gap-3 pt-1">
        {error && <span className="text-xs text-error">{error}</span>}
        {notice && !dirty && <span className="text-xs text-emerald-700">{notice}</span>}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !dirty}
          className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save checklist'}
        </button>
      </div>
    </div>
  );
};

export default HighRiskChecklist;
