import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { recoverPatientAccount, setRecoveredLoginDetails } from '../lib/api';
import { setPatientAuth } from '../lib/auth';

const USERNAME_RE = /^[a-z0-9._]{3,30}$/;

const EMPTY_DETAILS = {
  full_name: '',
  dob_day: '',
  dob_month: '',
  dob_year: '',
  education_level: '',
  email: '',
  phone_number: '',
};

// Same options as the intake questionnaire
const EDUCATION_LEVELS = ['Primary', 'Secondary', 'Tertiary (University, Polytechnic)', 'None'];

/** YYYY-MM-DD for a real past date, or null. */
const toIsoDate = (day, month, year) => {
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (!d || !m || !y || y < 1920) return null;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d || date > new Date()) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

const inputClass =
  'w-full px-4 py-3 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary outline-none';

const apiMessage = (err, fallback) => {
  const d = err.response?.data;
  return d?.issues?.[0]?.message || d?.message || d?.error || fallback;
};

const RecoverAccount = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState('verify'); // 'verify' | 'credentials'
  const [details, setDetails] = useState(EMPTY_DETAILS);
  const monthInputRef = useRef(null);
  const yearInputRef = useRef(null);
  const [recoveryToken, setRecoveryToken] = useState('');
  const [method, setMethod] = useState('email');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionExpired, setSessionExpired] = useState(false);

  const dobStarted = !!(details.dob_day || details.dob_month || details.dob_year);
  const dateOfBirth = toIsoDate(details.dob_day, details.dob_month, details.dob_year);
  const filledCount = [dateOfBirth, details.education_level, details.email.trim(), details.phone_number.trim()].filter(Boolean).length;
  const nameWords = details.full_name.trim().split(/\s+/).filter(Boolean).length;

  const setDetail = (key) => (e) => {
    setDetails((d) => ({ ...d, [key]: e.target.value }));
    if (error) setError('');
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    if (nameWords < 2) {
      setError('Enter your first and last name.');
      return;
    }
    if (dobStarted && !dateOfBirth) {
      setError('Enter a valid date of birth (day, month and year).');
      return;
    }
    if (filledCount < 2) {
      setError('Fill in at least 2 of the other details.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await recoverPatientAccount({
        full_name: details.full_name.trim(),
        date_of_birth: dateOfBirth,
        education_level: details.education_level || null,
        email: details.email.trim() || null,
        phone_number: details.phone_number.trim() || null,
      });
      setRecoveryToken(data.recovery_token);
      setSessionExpired(false);
      setStep('credentials');
    } catch (err) {
      setError(
        err.response?.status === 429
          ? 'Too many attempts. Please wait 15 minutes and try again, or ask your clinic for help.'
          : apiMessage(err, "We couldn't confirm those details. Please try again.")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLogin = async (e) => {
    e.preventDefault();
    setError('');
    const cleanUsername = username.trim().toLowerCase();
    if (method === 'username' && !USERNAME_RE.test(cleanUsername)) {
      setError('Username must be 3–30 characters: letters, numbers, dots or underscores. No spaces.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await setRecoveredLoginDetails({
        recovery_token: recoveryToken,
        method,
        ...(method === 'email' ? { email: email.trim().toLowerCase() } : { username: cleanUsername }),
        password,
      });
      setPatientAuth(data.access_token, data.refresh_token, data.patient);
      const status = data.patient?.intake_status;
      navigate(status === 'submitted' ? '/dashboard' : '/intake?from=email', { replace: true });
    } catch (err) {
      if (err.response?.status === 401) setSessionExpired(true);
      setError(apiMessage(err, 'Could not save your login details. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const startOver = () => {
    setStep('verify');
    setRecoveryToken('');
    setSessionExpired(false);
    setError('');
  };

  return (
    <div className="min-h-screen flex flex-col font-body-md text-on-surface">
      <header className="bg-stone-50/80 backdrop-blur-md border-b border-amber-900/5 sticky top-0 z-50">
        <div className="flex justify-between items-center w-full px-6 py-4 max-w-7xl mx-auto">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-2xl font-serif font-bold text-amber-900 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
              pregnant_woman
            </span>
            <span className="font-headline-md">9Care AI</span>
          </button>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center p-0 md:p-8">
        <div className="w-full max-w-[480px] bg-white md:rounded-xl custom-shadow min-h-screen md:min-h-[auto] p-8 md:p-12 flex flex-col">
          {step === 'verify' ? (
            <section className="space-y-6 animate-fade-in">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-primary-fixed rounded-full flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined text-primary text-4xl">manage_accounts</span>
                </div>
                <h1 className="font-headline-lg text-primary mb-2">Get back into your account</h1>
                <p className="font-body-md text-on-surface-variant">
                  Forgot your email or password? Tell us your name and at least 2 other details from your 9Care profile.
                </p>
              </div>

              <form onSubmit={handleVerify} className="space-y-5">
                <div className="space-y-1">
                  <label className="font-label-sm text-on-surface-variant">YOUR FULL NAME</label>
                  <input
                    type="text"
                    autoComplete="name"
                    value={details.full_name}
                    onChange={setDetail('full_name')}
                    className={inputClass}
                    placeholder="First and last name"
                    required
                  />
                </div>

                <div className="flex items-center justify-between border-t border-outline-variant/30 pt-4">
                  <p className="text-sm font-bold text-on-surface">Any 2 or more of these</p>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      filledCount >= 2 ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-600'
                    }`}
                  >
                    {filledCount} of 2 filled
                  </span>
                </div>

                {/* Same date of birth boxes as sign-up (Register.jsx) */}
                <div className="space-y-1">
                  <label className="font-label-sm text-on-surface-variant">DATE OF BIRTH</label>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Day (DD)"
                        maxLength={2}
                        value={details.dob_day}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 2);
                          setDetail('dob_day')({ target: { value: val } });
                          if (val.length === 2 && monthInputRef.current) monthInputRef.current.focus();
                        }}
                        className="w-full px-3 py-3 text-center border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
                      />
                    </div>
                    <div>
                      <input
                        ref={monthInputRef}
                        type="text"
                        inputMode="numeric"
                        placeholder="Month (MM)"
                        maxLength={2}
                        value={details.dob_month}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 2);
                          setDetail('dob_month')({ target: { value: val } });
                          if (val.length === 2 && yearInputRef.current) yearInputRef.current.focus();
                        }}
                        className="w-full px-3 py-3 text-center border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
                      />
                    </div>
                    <div>
                      <input
                        ref={yearInputRef}
                        type="text"
                        inputMode="numeric"
                        placeholder="Year (YYYY)"
                        maxLength={4}
                        value={details.dob_year}
                        onChange={(e) => setDetail('dob_year')({ target: { value: e.target.value.replace(/\D/g, '').slice(0, 4) } })}
                        className="w-full px-3 py-3 text-center border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-stone-400">e.g. 15 / 08 / 1996</p>
                </div>

                {/* Same chips as the intake questionnaire (Onboarding.jsx); tap again to clear */}
                <div className="space-y-2">
                  <label className="font-label-sm text-on-surface-variant">LEVEL OF EDUCATION</label>
                  <div className="flex flex-wrap gap-2">
                    {EDUCATION_LEVELS.map((level) => {
                      const active = details.education_level === level;
                      return (
                        <button
                          key={level}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setDetail('education_level')({ target: { value: active ? '' : level } })}
                          className={`px-4 py-2.5 rounded-full border-2 text-sm font-semibold transition-all active:scale-95 ${
                            active
                              ? 'border-primary bg-primary text-white shadow-sm'
                              : 'border-primary/20 bg-white text-slate-700 hover:border-primary/50'
                          }`}
                        >
                          {level}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-label-sm text-on-surface-variant">EMAIL</label>
                  <input
                    type="text"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    value={details.email}
                    onChange={setDetail('email')}
                    className={inputClass}
                    placeholder="johndoe@gmail.com"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-label-sm text-on-surface-variant">PHONE NUMBER</label>
                  <input
                    type="tel"
                    autoComplete="tel"
                    value={details.phone_number}
                    onChange={setDetail('phone_number')}
                    className={inputClass}
                    placeholder="e.g. 0803 123 4567"
                  />
                </div>

                {error && <p className="text-error font-label-sm text-sm text-center">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary text-white font-label-sm py-4 rounded-lg flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60"
                >
                  {loading ? 'Checking…' : 'Continue'}
                  {!loading && <span className="material-symbols-outlined text-sm">arrow_forward</span>}
                </button>

                <p className="text-center text-sm text-on-surface-variant">
                  Remembered it?{' '}
                  <button type="button" onClick={() => navigate('/register?mode=login')} className="text-primary font-bold underline">
                    Back to log in
                  </button>
                </p>
              </form>
            </section>
          ) : (
            <section className="space-y-6 animate-fade-in">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined text-emerald-700 text-4xl">verified_user</span>
                </div>
                <h1 className="font-headline-lg text-primary mb-2">We found your account</h1>
                <p className="font-body-md text-on-surface-variant">
                  Now create login details you'll remember. You'll use these every time you log in.
                </p>
              </div>

              <form onSubmit={handleSaveLogin} className="space-y-5">
                <div className="space-y-2">
                  <p className="font-label-sm text-on-surface-variant">HOW DO YOU WANT TO LOG IN?</p>
                  <div className="grid grid-cols-2 gap-2 rounded-xl bg-stone-100 p-1">
                    {[
                      { id: 'email', icon: 'mail', label: 'With email' },
                      { id: 'username', icon: 'person', label: 'With username' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setMethod(m.id);
                          setError('');
                        }}
                        className={`py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
                          method === m.id ? 'bg-white text-primary shadow-sm' : 'text-stone-500'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[18px]">{m.icon}</span>
                        {m.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-on-surface-variant">
                    {method === 'email'
                      ? 'Use a real email you can open. We will send you a link to confirm it.'
                      : "No email? Pick a username instead. Write it down somewhere safe."}
                  </p>
                </div>

                {method === 'email' ? (
                  <div className="space-y-1">
                    <label className="font-label-sm text-on-surface-variant">EMAIL</label>
                    <input
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputClass}
                      placeholder="johndoe@gmail.com"
                      required
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="font-label-sm text-on-surface-variant">USERNAME</label>
                    <input
                      type="text"
                      autoComplete="username"
                      autoCapitalize="none"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.replace(/\s/g, '').toLowerCase())}
                      className={inputClass}
                      placeholder="e.g. ada.okafor"
                      maxLength={30}
                      required
                    />
                    <p className="text-xs text-on-surface-variant">Letters, numbers, dots or underscores. At least 3 characters.</p>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="font-label-sm text-on-surface-variant">NEW PASSWORD</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${inputClass} pr-11`}
                      placeholder="At least 6 characters"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 flex items-center justify-center p-1"
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-label-sm text-on-surface-variant">CONFIRM PASSWORD</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={inputClass}
                    placeholder="Type it again"
                    required
                  />
                </div>

                {error && <p className="text-error font-label-sm text-sm text-center">{error}</p>}

                {sessionExpired ? (
                  <button
                    type="button"
                    onClick={startOver}
                    className="w-full bg-primary text-white font-label-sm py-4 rounded-lg flex items-center justify-center gap-2 hover:opacity-90"
                  >
                    <span className="material-symbols-outlined text-sm">restart_alt</span>
                    Start again
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary text-white font-label-sm py-4 rounded-lg flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60"
                  >
                    {loading ? 'Saving…' : 'Save and log in'}
                    {!loading && <span className="material-symbols-outlined text-sm">arrow_forward</span>}
                  </button>
                )}
                <p className="text-center text-xs text-on-surface-variant">You have 15 minutes to finish this step.</p>
              </form>
            </section>
          )}
        </div>
      </main>
    </div>
  );
};

export default RecoverAccount;
