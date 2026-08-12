import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  requestOtp,
  verifyOtp,
  upsertProfile,
  setPatientCredentials,
  patientLogin,
  registerPatientEmail,
} from '../lib/api';
import { setPatientAuth, isPatientAuthenticated } from '../lib/auth';

const RegistrationFlow = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') === 'login' ? 'login' : 'signup';

  // 'login' | 'signup' — signup steps: phone → otp → credentials
  const [mode, setMode] = useState(initialMode);
  const [step, setStep] = useState(initialMode === 'login' ? 'login' : 'phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pinId, setPinId] = useState('');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [resendTimer, setResendTimer] = useState(45);
  const [otpError, setOtpError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [authChannel, setAuthChannel] = useState('sms');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dob: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const inputRefs = useRef([]);

  useEffect(() => {
    if (isPatientAuthenticated()) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    if (step === 'otp' && resendTimer > 0) {
      const interval = setInterval(() => {
        setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [step, resendTimer]);

  const formatPhone = (num) => {
    const digits = num.replace(/\D/g, '');
    if (digits.startsWith('234') && digits.length >= 13) return '+' + digits;
    return '+234' + digits.replace(/^0/, '');
  };

  const switchMode = (next) => {
    setMode(next);
    setApiError('');
    setOtpError(false);
    setStep(next === 'login' ? 'login' : 'phone');
  };

  const handlePhoneSubmit = async (e, channel = 'sms') => {
    if (e && e.preventDefault) e.preventDefault();
    if (phoneNumber.trim().length < 8) return;
    setAuthChannel(channel);
    setLoading(true);
    setApiError('');
    try {
      const { data } = await requestOtp(formatPhone(phoneNumber), channel);
      setPinId(data.pin_id);
      setStep('otp');
      setResendTimer(45);
    } catch (err) {
      const d = err.response?.data;
      const msg =
        d?.issues?.[0]?.message || d?.message || d?.error || 'Failed to send OTP. Try again.';
      if (err.response?.status === 409) {
        setApiError(msg);
        setMode('login');
        setStep('login');
      } else {
        setApiError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (value.length > 1) return;
    const newOtp = [...otpCode];
    newOtp[index] = value;
    setOtpCode(newOtp);
    setOtpError(false);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    const code = otpCode.join('');
    if (code.length < 6) return;
    setLoading(true);
    setOtpError(false);
    try {
      const { data } = await verifyOtp(pinId, code);
      setPatientAuth(data.access_token, data.refresh_token, data.patient);
      // Always collect email + password after OTP sign-up so they can log in without OTP next time
      setStep('credentials');
    } catch (err) {
      const d = err.response?.data;
      const msg = d?.issues?.[0]?.message || d?.message || d?.error;
      if (err.response?.status === 409) {
        setApiError(msg || 'Account already exists. Please log in.');
        setMode('login');
        setStep('login');
      } else {
        setOtpError(msg || true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleProfileChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();
    setApiError('');
    if (formData.password !== formData.confirmPassword) {
      setApiError('Passwords do not match.');
      return;
    }
    if (formData.password.length < 6) {
      setApiError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      const dob = formData.dob ? new Date(formData.dob) : null;
      let age;
      if (dob && !isNaN(dob.getTime())) {
        const today = new Date();
        age = today.getFullYear() - dob.getFullYear();
        const m = today.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age -= 1;
        if (age < 10 || age > 60) age = undefined;
      }
      const name = `${formData.firstName} ${formData.lastName}`.trim();

      const { data } = await setPatientCredentials({
        email: formData.email.trim(),
        password: formData.password,
        name: name || undefined,
        age: age != null ? age : undefined,
      });

      if (data?.patient) {
        const existing = JSON.parse(localStorage.getItem('mc_patient') || '{}');
        setPatientAuth(
          localStorage.getItem('mc_patient_token'),
          localStorage.getItem('mc_patient_refresh'),
          { ...existing, ...data.patient, age: data.patient.age ?? age }
        );
      }

      // Always try to persist age on the profile (risk engine requires it)
      await upsertProfile({
        name: name || undefined,
        age: age != null ? age : undefined,
        language_preference: 'en',
      }).catch(() => {});

      // Resume questionnaire if in progress; otherwise start intake
      const status = data?.patient?.intake_status;
      if (status === 'submitted') navigate('/dashboard');
      else navigate('/intake');
    } catch (err) {
      const d = err.response?.data;
      setApiError(d?.issues?.[0]?.message || d?.message || d?.error || 'Failed to save account.');
    } finally {
      setLoading(false);
    }
  };

  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerName, setRegisterName] = useState('');

  const handleEmailRegisterSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setApiError('');
    if (registerPassword.length < 6) {
      setApiError('Password must be at least 6 characters.');
      setLoading(false);
      return;
    }
    try {
      const { data } = await registerPatientEmail(registerEmail.trim(), registerPassword, registerName.trim());
      setPatientAuth(data.access_token, data.refresh_token, data.patient);
      // Email-registered users need to complete basic biodata before intake
      navigate('/profile');
    } catch (err) {
      const d = err.response?.data;
      setApiError(d?.issues?.[0]?.message || d?.message || d?.error || 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setApiError('');
    try {
      const { data } = await patientLogin(loginEmail.trim(), loginPassword);
      setPatientAuth(data.access_token, data.refresh_token, data.patient);
      const status = data.patient?.intake_status;
      if (status === 'not_started' || status === 'in_progress' || !status) {
        navigate('/intake');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      const d = err.response?.data;
      setApiError(d?.issues?.[0]?.message || d?.message || d?.error || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setLoading(true);
    setApiError('');
    try {
      const { data } = await requestOtp(formatPhone(phoneNumber), authChannel);
      setPinId(data.pin_id);
      setResendTimer(45);
    } catch (err) {
      const d = err.response?.data;
      setApiError(d?.issues?.[0]?.message || d?.message || d?.error || 'Failed to resend OTP.');
    } finally {
      setLoading(false);
    }
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
          <button
            type="button"
            onClick={() => navigate('/provider')}
            className="text-stone-600 hover:text-amber-800 font-label-sm uppercase transition-all"
          >
            For Providers
          </button>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center p-0 md:p-8">
        <div className="w-full max-w-[480px] bg-white md:rounded-xl custom-shadow min-h-screen md:min-h-[auto] p-8 md:p-12 flex flex-col relative overflow-hidden">
          {/* Mode tabs — hide during OTP / credentials mid-flow */}
          {(step === 'phone' || step === 'login') && (
            <div className="flex rounded-xl bg-stone-100 p-1 mb-8">
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  mode === 'signup' ? 'bg-white text-primary shadow-sm' : 'text-stone-500'
                }`}
              >
                Sign up
              </button>
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  mode === 'login' ? 'bg-white text-primary shadow-sm' : 'text-stone-500'
                }`}
              >
                Log in
              </button>
            </div>
          )}

          {/* Login — email + password, no OTP */}
          {step === 'login' && (
            <section className="space-y-8 animate-fade-in">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-primary-fixed rounded-full flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined text-primary text-4xl">login</span>
                </div>
                <h1 className="font-headline-lg text-primary mb-2">Welcome back</h1>
                <p className="font-body-md text-on-surface-variant">
                  Log in with your email and password — no code needed
                </p>
              </div>
              <form onSubmit={handleLoginSubmit} className="space-y-5">
                <div className="space-y-1">
                  <label className="font-label-sm text-on-surface-variant">EMAIL</label>
                  <input
                    type="email"
                    autoComplete="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary outline-none"
                    placeholder="you@example.com"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-label-sm text-on-surface-variant">PASSWORD</label>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary outline-none"
                    placeholder="Your password"
                    required
                  />
                </div>
                {apiError && <p className="text-error font-label-sm text-sm text-center">{apiError}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary text-white font-label-sm py-4 rounded-lg flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60"
                >
                  {loading ? 'Signing in…' : 'Log in'}
                  {!loading && <span className="material-symbols-outlined text-sm">arrow_forward</span>}
                </button>
                <p className="text-center text-sm text-on-surface-variant">
                  New here?{' '}
                  <button type="button" onClick={() => switchMode('signup')} className="text-primary font-bold underline">
                    Create an account
                  </button>
                </p>
              </form>
            </section>
          )}

          {/* Sign-up step 1: Choose Phone or Email */}
          {step === 'phone' && (
            <section className="space-y-8 animate-fade-in">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-primary-fixed rounded-full flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined text-primary text-4xl">pregnant_woman</span>
                </div>
                <h1 className="font-headline-lg text-primary mb-2">Welcome to 9Care</h1>
                <p className="font-body-md text-on-surface-variant">
                  Create your account below
                </p>
              </div>

              {/* Toggle for Email vs Phone signup */}
              <div className="flex justify-center mb-4">
                 <button type="button" onClick={() => setAuthChannel('email')} className={`px-4 py-2 text-sm font-bold border-b-2 ${authChannel === 'email' ? 'border-primary text-primary' : 'border-transparent text-stone-500'}`}>Email Signup</button>
                 <button type="button" onClick={() => setAuthChannel('sms')} className={`px-4 py-2 text-sm font-bold border-b-2 ${authChannel === 'sms' ? 'border-primary text-primary' : 'border-transparent text-stone-500'}`}>Phone Signup</button>
              </div>

              {authChannel === 'email' ? (
                 <form onSubmit={handleEmailRegisterSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="font-label-sm text-on-surface-variant">FULL NAME</label>
                    <input
                      type="text"
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                      className="w-full px-4 py-3 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary outline-none"
                      placeholder="Jane Doe"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="font-label-sm text-on-surface-variant">EMAIL</label>
                    <input
                      type="email"
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      className="w-full px-4 py-3 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary outline-none"
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="font-label-sm text-on-surface-variant">PASSWORD</label>
                    <input
                      type="password"
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      className="w-full px-4 py-3 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary outline-none"
                      placeholder="At least 6 characters"
                      required
                    />
                  </div>
                  {apiError && <p className="text-error font-label-sm text-sm text-center">{apiError}</p>}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary text-white font-label-sm py-4 rounded-lg flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60"
                  >
                    {loading ? 'Creating Account...' : 'Sign up'}
                    {!loading && <span className="material-symbols-outlined text-sm">arrow_forward</span>}
                  </button>
                 </form>
              ) : (
                <form onSubmit={(e) => handlePhoneSubmit(e, 'sms')} className="space-y-6">
                  <div className="space-y-2">
                  <label className="font-label-sm text-on-surface-variant">PHONE NUMBER</label>
                  <div className="flex gap-2">
                    <div className="flex items-center gap-2 px-3 py-3 border border-outline-variant rounded-lg bg-surface-container-low">
                      <span className="font-body-md font-bold">+234</span>
                    </div>
                    <input
                      type="tel"
                      placeholder="801 234 5678"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="flex-grow px-4 py-3 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary outline-none"
                      required
                    />
                  </div>
                </div>
                {apiError && <p className="text-error font-label-sm text-sm text-center">{apiError}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary text-white font-label-sm py-4 rounded-lg flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60"
                >
                  {loading ? 'Sending…' : 'Send verification code'}
                  {!loading && <span className="material-symbols-outlined text-sm">arrow_forward</span>}
                </button>
                <button
                  type="button"
                  onClick={(e) => handlePhoneSubmit(e, 'whatsapp')}
                  className="font-label-sm text-secondary hover:underline w-full flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">chat</span>
                  Use WhatsApp instead
                </button>
              </form>
              )}
            </section>
          )}

          {step === 'otp' && (
            <section className="space-y-8">
              <div className="text-center">
                <h1 className="font-headline-lg text-primary mb-2">Enter your code</h1>
                <p className="font-body-md text-on-surface-variant">
                  We sent a 6-digit code to <span className="font-bold text-on-surface">+234 {phoneNumber}</span>
                </p>
              </div>
              <form onSubmit={handleOtpSubmit}>
                <div className="flex justify-between gap-2 mb-6">
                  {otpCode.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (inputRefs.current[idx] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength="1"
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value.replace(/\D/g, ''))}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      className="otp-input w-[52px] h-[52px] text-center font-headline-md border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  ))}
                </div>
                {otpError && (
                  <p className="text-error font-label-sm text-center mb-4">
                    {typeof otpError === 'string' ? otpError : 'Invalid code. Please check and try again.'}
                  </p>
                )}
                <div className="text-center space-y-6">
                  <p className="font-label-sm text-on-surface-variant">
                    Resend in{' '}
                    <span className="text-primary">
                      {resendTimer > 0 ? `0:${resendTimer.toString().padStart(2, '0')}` : '0:00'}
                    </span>
                  </p>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary text-white font-label-sm py-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {loading ? 'Verifying…' : 'Confirm code'}
                  </button>
                  {apiError && <p className="text-error font-label-sm text-sm">{apiError}</p>}
                  {resendTimer === 0 && (
                    <button type="button" onClick={handleResend} className="font-label-sm text-secondary underline">
                      Resend code
                    </button>
                  )}
                </div>
              </form>
            </section>
          )}

          {/* After OTP: name + email + password for future logins */}
          {step === 'credentials' && (
            <section className="space-y-6">
              <div>
                <h1 className="font-headline-lg text-primary">Create your login</h1>
                <p className="font-body-md text-on-surface-variant mt-2 text-sm">
                  Set an email and password so you can sign in later without another OTP code.
                </p>
              </div>
              <form onSubmit={handleCredentialsSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-label-sm text-on-surface-variant">FIRST NAME</label>
                    <input
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleProfileChange}
                      className="w-full px-4 py-3 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary outline-none"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-label-sm text-on-surface-variant">LAST NAME</label>
                    <input
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleProfileChange}
                      className="w-full px-4 py-3 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary outline-none"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="font-label-sm text-on-surface-variant">DATE OF BIRTH</label>
                  <input
                    name="dob"
                    type="date"
                    value={formData.dob}
                    onChange={handleProfileChange}
                    className="w-full px-4 py-3 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary outline-none"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-label-sm text-on-surface-variant">EMAIL</label>
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={formData.email}
                    onChange={handleProfileChange}
                    className="w-full px-4 py-3 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary outline-none"
                    placeholder="you@example.com"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-label-sm text-on-surface-variant">PASSWORD</label>
                  <input
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    value={formData.password}
                    onChange={handleProfileChange}
                    className="w-full px-4 py-3 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary outline-none"
                    placeholder="At least 6 characters"
                    minLength={6}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-label-sm text-on-surface-variant">CONFIRM PASSWORD</label>
                  <input
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    value={formData.confirmPassword}
                    onChange={handleProfileChange}
                    className="w-full px-4 py-3 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary outline-none"
                    required
                  />
                </div>
                {apiError && <p className="text-error font-label-sm text-sm text-center">{apiError}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary text-white font-label-sm py-4 rounded-lg flex items-center justify-center gap-2 mt-2 disabled:opacity-60"
                >
                  {loading ? 'Saving…' : 'Save & start health profile'}
                </button>
              </form>
            </section>
          )}

          <div className="absolute -bottom-12 -right-12 opacity-5 pointer-events-none">
            <span className="material-symbols-outlined text-[160px] text-primary">pregnant_woman</span>
          </div>
        </div>
      </main>
    </div>
  );
};

export default RegistrationFlow;
