import { useState } from 'react';
import { savePatientDelivery } from '../lib/api';
import { COMPLICATIONS, OUTCOMES, MODES, todayIso } from '../lib/delivery';

const Question = ({ number, title, children, error }) => (
  <fieldset className="space-y-2">
    <legend className="font-semibold text-sm text-on-surface mb-2">
      {number}. {title}
    </legend>
    {children}
    {error && <p className="text-xs text-error">{error}</p>}
  </fieldset>
);

const Choice = ({ type = 'radio', checked, onChange, label, explain, name }) => (
  <label
    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
      checked ? 'border-primary bg-primary/5' : 'border-outline-variant/50 bg-white hover:bg-surface-container-low'
    }`}
  >
    <input type={type} name={name} checked={checked} onChange={onChange} className="mt-0.5 accent-primary w-4 h-4 shrink-0" />
    <span className="min-w-0">
      <span className="block text-sm font-medium text-on-surface">{label}</span>
      {explain && <span className="block text-xs text-on-surface-variant mt-0.5">{explain}</span>}
    </span>
  </label>
);

/**
 * "Have you delivered?" pop-up and the delivery details form.
 * step="prompt" asks first; step="form" opens the form directly (dashboard button).
 */
const DeliveryModal = ({ step: initialStep = 'form', pregnancyStart, onClose, onNotYet, onSaved }) => {
  const [step, setStep] = useState(initialStep);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [hadComplications, setHadComplications] = useState(null);
  const [complications, setComplications] = useState([]);
  const [otherText, setOtherText] = useState('');
  const [outcome, setOutcome] = useState('');
  const [mode, setMode] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const today = todayIso();

  const toggleComplication = (key) =>
    setComplications((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const validate = () => {
    const e = {};
    if (!deliveryDate) e.delivery_date = 'Choose the date of delivery';
    else if (deliveryDate > today) e.delivery_date = 'The date of delivery cannot be in the future';
    else if (pregnancyStart && deliveryDate < pregnancyStart) e.delivery_date = 'The date cannot be before the start of your pregnancy';
    if (hadComplications === null) e.had_complications = 'Choose Yes or No';
    if (hadComplications && complications.length === 0) e.complications = 'Tick at least one complication';
    if (hadComplications && complications.includes('other') && !otherText.trim()) e.other_complication = 'Type the other complication';
    if (!outcome) e.outcome = 'Choose how the baby is';
    if (!mode) e.mode = 'Choose the mode of delivery';
    return e;
  };

  const handleSave = async (ev) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      const { data } = await savePatientDelivery({
        delivery_date: deliveryDate,
        had_complications: hadComplications,
        complications: hadComplications ? complications : [],
        other_complication: hadComplications && complications.includes('other') ? otherText.trim() : null,
        outcome,
        mode,
      });
      onSaved?.(data.delivery);
    } catch (err) {
      const issue = err.response?.data?.issues?.[0];
      setErrors({
        form: issue?.message || err.response?.data?.message || err.response?.data?.error || 'Could not save. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (step === 'prompt') {
    return (
      <div className="fixed inset-0 z-[80] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="delivered-q">
        <div className="bg-white w-full max-w-[440px] rounded-t-3xl sm:rounded-3xl p-6 space-y-5 shadow-2xl">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-primary text-3xl">child_care</span>
          </div>
          <div className="text-center space-y-1">
            <h2 id="delivered-q" className="font-headline-md text-xl text-primary">Have you delivered?</h2>
            <p className="text-sm text-on-surface-variant">
              If your baby has arrived, tell us so we can switch your dashboard and lessons to care after delivery.
            </p>
          </div>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setStep('form')}
              className="w-full py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:opacity-95"
            >
              Yes, enter my delivery details
            </button>
            <button
              type="button"
              onClick={onNotYet}
              className="w-full py-3 rounded-xl border border-outline-variant text-on-surface-variant font-semibold text-sm hover:bg-surface-container-low"
            >
              Not yet
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-start sm:items-center justify-center overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="delivery-form-title">
      <form
        onSubmit={handleSave}
        className="bg-surface-container-low w-full max-w-[560px] min-h-screen sm:min-h-0 sm:my-6 sm:rounded-3xl shadow-2xl flex flex-col"
        noValidate
      >
        <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-4 border-b border-outline-variant/30 bg-white sm:rounded-t-3xl">
          <div>
            <h2 id="delivery-form-title" className="font-headline-md text-xl text-primary">Your delivery details</h2>
            <p className="text-xs text-on-surface-variant mt-1">Your doctor will see this on your record.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-surface-container shrink-0">
            <span className="material-symbols-outlined text-on-surface-variant">close</span>
          </button>
        </div>

        <div className="px-6 py-5 space-y-7 flex-1">
          <Question number={1} title="Date of delivery" error={errors.delivery_date}>
            <input
              type="date"
              value={deliveryDate}
              min={pregnancyStart || undefined}
              max={today}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-primary/20 bg-white text-slate-800 text-base focus:ring-2 focus:ring-primary/50 outline-none"
            />
          </Question>

          <Question number={2} title="Did you have any complications?" error={errors.had_complications}>
            <div className="grid grid-cols-2 gap-2">
              <Choice name="had_complications" checked={hadComplications === true} onChange={() => setHadComplications(true)} label="Yes" />
              <Choice name="had_complications" checked={hadComplications === false} onChange={() => setHadComplications(false)} label="No" />
            </div>
            {hadComplications && (
              <div className="space-y-2 pt-2">
                <p className="text-xs text-on-surface-variant">Tick all that apply:</p>
                {COMPLICATIONS.map((c) => (
                  <Choice
                    key={c.key}
                    type="checkbox"
                    checked={complications.includes(c.key)}
                    onChange={() => toggleComplication(c.key)}
                    label={c.label}
                    explain={c.explain}
                  />
                ))}
                {errors.complications && <p className="text-xs text-error">{errors.complications}</p>}
                {complications.includes('other') && (
                  <div>
                    <input
                      type="text"
                      value={otherText}
                      maxLength={500}
                      onChange={(e) => setOtherText(e.target.value)}
                      placeholder="Type the other complication"
                      className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-white text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                    />
                    {errors.other_complication && <p className="text-xs text-error mt-1">{errors.other_complication}</p>}
                  </div>
                )}
              </div>
            )}
          </Question>

          <Question number={3} title="Delivery outcome (how the baby is)" error={errors.outcome}>
            {OUTCOMES.map((o) => (
              <Choice key={o.key} name="outcome" checked={outcome === o.key} onChange={() => setOutcome(o.key)} label={o.label} />
            ))}
          </Question>

          <Question number={4} title="Mode of delivery" error={errors.mode}>
            {MODES.map((m) => (
              <Choice key={m.key} name="mode" checked={mode === m.key} onChange={() => setMode(m.key)} label={m.label} explain={m.explain} />
            ))}
          </Question>
        </div>

        <div className="px-6 pb-8 pt-4 border-t border-outline-variant/30 bg-white sm:rounded-b-3xl space-y-2">
          {errors.form && <p className="text-sm text-error text-center">{errors.form}</p>}
          <button type="submit" disabled={saving} className="w-full py-3 rounded-xl bg-primary text-white font-semibold text-sm disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default DeliveryModal;
