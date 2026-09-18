import { useState } from 'react';
import { requestEmailVerification } from '../lib/api';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EmailPrompt({
  mode = 'add',
  initialEmail = '',
  onClose,
  onSaved,
}) {
  const [email, setEmail] = useState(initialEmail || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isVerify = mode === 'verify';
  const title = isVerify ? 'Verify your email' : 'Add your email';
  const copy = isVerify
    ? 'We need a real email so we can send visit reminders and health updates. Confirm or update the address below.'
    : 'You signed up with a phone code. Add an email so you can log in without waiting for SMS, and so we can reach you.';

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value) || /^[0-9]+@/.test(value)) {
      setError('Enter a real email address, not a phone number or username.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await requestEmailVerification(value);
      if (data?.already_verified) {
        setSuccess('This email is already verified.');
        onSaved?.(data.patient);
        setTimeout(() => onClose?.(), 1200);
        return;
      }
      setSuccess('Check your inbox for a verification link.');
      onSaved?.(data.patient);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          err.response?.data?.issues?.[0]?.message ||
          'Could not save email. Try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div
        role="dialog"
        aria-labelledby="email-prompt-title"
        className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-outline-variant/30 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="email-prompt-title" className="font-headline-md text-lg text-on-surface">
              {title}
            </h3>
            <p className="font-body-md text-xs text-on-surface-variant mt-1">{copy}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {error ? (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs">
            {success}
          </div>
        ) : null}

        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="block font-label-sm text-xs text-on-surface-variant mb-1">
              Email address
            </span>
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="e.g. mama@example.com"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-outline-variant text-sm focus:outline-none focus:border-primary"
            />
          </label>
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-label-sm text-on-surface-variant"
            >
              Later
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-label-sm disabled:opacity-50"
            >
              {loading ? 'Sending…' : isVerify ? 'Send verification' : 'Save email'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
