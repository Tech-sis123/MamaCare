import { useEffect, useRef, useState } from 'react';
import { savePatientWhatsapp } from '../lib/api';
import { toWhatsappNumber, formatWhatsappNumber, WHATSAPP_CONSENT_TEXT } from '../lib/whatsapp';

const Choice = ({ checked, onChange, label }) => (
  <label
    className={`flex items-center justify-center gap-2 p-3 rounded-xl border cursor-pointer transition-colors text-sm font-semibold ${
      checked ? 'border-primary bg-primary/5 text-primary' : 'border-outline-variant/50 bg-white text-on-surface hover:bg-surface-container-low'
    }`}
  >
    <input type="radio" name="is_whatsapp" checked={checked} onChange={onChange} className="accent-primary w-4 h-4" />
    {label}
  </label>
);

/**
 * Asks for her WhatsApp number, with consent.
 * - phoneNumber: the number we already have (+234…). She's asked "Is this also your WhatsApp number?"
 * - currentNumber: her saved WhatsApp number (profile), shown in the box to change it.
 * - mode="prompt" shows "Remind me later"; mode="profile" shows "Cancel".
 */
const WhatsAppNumberModal = ({ mode = 'prompt', phoneNumber, currentNumber, onSaved, onLater }) => {
  const askAboutPhone = !!phoneNumber && !currentNumber;
  const [isWhatsapp, setIsWhatsapp] = useState(null); // null | true | false
  const [typed, setTyped] = useState(currentNumber ? formatWhatsappNumber(currentNumber) : '');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);
  const inputRef = useRef(null);

  const showInput = !askAboutPhone || isWhatsapp === false;
  const numberChosen = askAboutPhone && isWhatsapp === true ? true : !!typed.trim();

  useEffect(() => {
    if (isWhatsapp === false) inputRef.current?.focus();
  }, [isWhatsapp]);

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    if (askAboutPhone && isWhatsapp === null) {
      setError('Choose Yes or No.');
      return;
    }
    const number = askAboutPhone && isWhatsapp ? phoneNumber : toWhatsappNumber(typed);
    if (!number) {
      setError('Enter a valid phone number, e.g. 0801 234 5678.');
      return;
    }
    if (!consent) {
      setError('Tick the box to agree to receive WhatsApp messages.');
      return;
    }
    setSaving(true);
    try {
      const { data } = await savePatientWhatsapp(number, mode);
      setSaved(data.whatsapp);
    } catch (err) {
      const d = err.response?.data;
      setError(d?.issues?.[0]?.message || d?.message || d?.error || 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[85] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="whatsapp-title">
      <div className="bg-white w-full max-w-[440px] rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[100dvh] overflow-y-auto">
        {saved ? (
          <div className="space-y-5 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-emerald-600 text-3xl">check_circle</span>
            </div>
            <div className="space-y-1">
              <h2 id="whatsapp-title" className="font-headline-md text-xl text-primary">Thank you</h2>
              <p className="text-sm text-on-surface-variant">
                We will send your updates and reminders to <span className="font-semibold text-on-surface whitespace-nowrap">{formatWhatsappNumber(saved.number)}</span> on WhatsApp.
              </p>
            </div>
            <button type="button" onClick={() => onSaved?.(saved)} className="w-full py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:opacity-95">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSave} noValidate className="space-y-5">
            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-emerald-600 text-3xl">chat</span>
            </div>
            <div className="text-center space-y-1">
              <h2 id="whatsapp-title" className="font-headline-md text-xl text-primary">Your WhatsApp number</h2>
              <p className="text-sm text-on-surface-variant">
                We would like to send you lessons for your pregnancy and reminders for your clinic visits on WhatsApp.
              </p>
            </div>

            {askAboutPhone && (
              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold text-on-surface mb-2">
                  Is this also your WhatsApp number?
                </legend>
                <p className="text-center text-lg font-bold text-on-surface tracking-wide py-1">{formatWhatsappNumber(phoneNumber)}</p>
                <div className="grid grid-cols-2 gap-2">
                  <Choice checked={isWhatsapp === true} onChange={() => setIsWhatsapp(true)} label="Yes" />
                  <Choice checked={isWhatsapp === false} onChange={() => setIsWhatsapp(false)} label="No" />
                </div>
              </fieldset>
            )}

            {showInput && (
              <div className="space-y-1">
                <label htmlFor="whatsapp-number" className="text-sm font-semibold text-on-surface">
                  {askAboutPhone ? 'Type your WhatsApp number' : 'WhatsApp number'}
                </label>
                <input
                  id="whatsapp-number"
                  ref={inputRef}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={typed}
                  onChange={(e) => {
                    setTyped(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="0801 234 5678"
                  className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-white text-base focus:ring-2 focus:ring-primary/50 outline-none"
                />
                <p className="text-xs text-on-surface-variant">Not a Nigerian number? Start with + and the country code.</p>
              </div>
            )}

            <label className="flex items-start gap-3 p-3 rounded-xl bg-surface-container-low cursor-pointer">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => {
                  setConsent(e.target.checked);
                  if (error) setError('');
                }}
                className="mt-0.5 accent-primary w-4 h-4 shrink-0"
              />
              <span className="text-sm text-on-surface">{WHATSAPP_CONSENT_TEXT}</span>
            </label>

            {error && <p className="text-sm text-error text-center" role="alert">{error}</p>}

            <div className="space-y-2">
              <button
                type="submit"
                disabled={saving || !consent || !numberChosen}
                className="w-full py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              {!consent && numberChosen && (
                <p className="text-xs text-on-surface-variant text-center">Tick the box above to save your number.</p>
              )}
              <button
                type="button"
                onClick={onLater}
                className="w-full py-3 rounded-xl border border-outline-variant text-on-surface-variant font-semibold text-sm hover:bg-surface-container-low"
              >
                {mode === 'profile' ? 'Cancel' : 'Remind me later'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default WhatsAppNumberModal;
