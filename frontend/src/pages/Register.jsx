import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { requestOtp, verifyOtp, upsertProfile } from '../lib/api';
import { setPatientAuth } from '../lib/auth';

const RegistrationFlow = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState('phone'); // 'phone', 'otp', 'profile'
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pinId, setPinId] = useState('');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [resendTimer, setResendTimer] = useState(45);
  const [otpError, setOtpError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dob: '',
  });

  const inputRefs = useRef([]);

  // Resend timer effect
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
    // Handle users who paste their full international number (+2348XXXXXXXXX → 2348XXXXXXXXX)
    if (digits.startsWith('234') && digits.length >= 13) return '+' + digits;
    return '+234' + digits.replace(/^0/, '');
  };

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    if (phoneNumber.trim().length < 8) return;
    setLoading(true);
    setApiError('');
    try {
      const { data } = await requestOtp(formatPhone(phoneNumber));
      setPinId(data.pin_id);
      setStep('otp');
      setResendTimer(45);
    } catch (err) {
      const d = err.response?.data;
      const msg = d?.issues?.[0]?.message || d?.message || d?.error || 'Failed to send OTP. Try again.';
      setApiError(msg);
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

    // Auto-focus next
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
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
      if (!data.patient.name) {
        setStep('profile');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      const d = err.response?.data;
      const msg = d?.issues?.[0]?.message || d?.message || d?.error;
      setOtpError(msg || true);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setApiError('');
    try {
      const dob = new Date(formData.dob);
      const age = new Date().getFullYear() - dob.getFullYear();
      await upsertProfile({
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        age,
        language_preference: 'en',
      });
      navigate('/intake');
    } catch (err) {
      setApiError(err.response?.data?.message || 'Failed to save profile. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setLoading(true);
    setApiError('');
    try {
      const { data } = await requestOtp(formatPhone(phoneNumber));
      setPinId(data.pin_id);
      setResendTimer(45);
    } catch (err) {
      const d = err.response?.data;
      const msg = d?.issues?.[0]?.message || d?.message || d?.error || 'Failed to resend OTP.';
      setApiError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-body-md text-on-surface">
      {/* TopAppBar */}
      <header className="bg-stone-50/80 backdrop-blur-md border-b border-amber-900/5 sticky top-0 z-50">
        <div className="flex justify-between items-center w-full px-6 py-4 max-w-7xl mx-auto">
          <div className="text-2xl font-serif font-bold text-amber-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
              pregnant_woman
            </span>
            <span className="font-headline-md">Mama Care AI</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden md:flex gap-6">
              <a href="#" className="text-stone-600 hover:text-amber-800 font-label-sm uppercase">
                How it works
              </a>
              <a href="#" className="text-stone-600 hover:text-amber-800 font-label-sm uppercase">
                For Providers
              </a>
              <a href="#" className="text-stone-600 hover:text-amber-800 font-label-sm uppercase">
                About
              </a>
            </div>
            <button className="text-amber-900 font-label-sm border border-primary/20 px-4 py-2 rounded-lg hover:bg-primary/5 transition-all">
              EN | Pidgin
            </button>
          </div>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center p-0 md:p-8">
        <div className="w-full max-w-[480px] bg-white md:rounded-xl custom-shadow min-h-screen md:min-h-[auto] p-8 md:p-12 flex flex-col relative overflow-hidden">
          {/* Step 1: Phone Entry */}
          {step === 'phone' && (
            <section className="space-y-8 animate-fade-in">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-primary-fixed rounded-full flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined text-primary text-4xl">pregnant_woman</span>
                </div>
                <h1 className="font-headline-lg text-primary mb-2">Welcome to Mama Care</h1>
                <p className="font-body-md text-on-surface-variant">Enter your phone number to get started</p>
              </div>
              <form onSubmit={handlePhoneSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="font-label-sm text-on-surface-variant">PHONE NUMBER</label>
                  <div className="flex gap-2">
                    <div className="flex items-center gap-2 px-3 py-3 border border-outline-variant rounded-lg bg-surface-container-low">
                      <img
                        alt="Nigeria Flag"
                        className="w-6 h-4 object-cover rounded-sm"
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuD6UpAjXBWVNkltbXwYYwxx3RKJx4QM9ATix-zPpojezIZL8A3FCAIjGLodq-deHvoNa0r0sa7PZx1RhloQM7yzj9YPxzp9OaMiqwreXw4nHbmOFRwmsZBNhfB1N1u9qe1nG8dl6nIodnPGoZL6f9mq03giYVRA-8nCHu0KjaFA-hVUWngEJNIK6-BVgnH8fM9N1cmYe33LKFPrBs9AOOYmr2epz5dpkcGMA9676Is3P0RVvCZrc4sNp-CHvDH7RyM1Thz1tPH0-zk"
                      />
                      <span className="font-body-md font-bold">+234</span>
                    </div>
                    <input
                      type="tel"
                      placeholder="801 234 5678"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="flex-grow px-4 py-3 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all font-body-md outline-none"
                      required
                    />
                  </div>
                </div>
                {apiError && (
                  <p className="text-error font-label-sm text-sm text-center">{apiError}</p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary text-white font-label-sm py-4 rounded-lg flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-60"
                >
                  {loading ? 'Sending…' : 'Send verification code'}
                  {!loading && <span className="material-symbols-outlined text-sm">arrow_forward</span>}
                </button>
                <div className="text-center">
                  <a href="#" className="font-label-sm text-secondary hover:underline underline-offset-4 flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-sm">chat</span>
                    Didn't get SMS? Use WhatsApp instead
                  </a>
                </div>
              </form>
            </section>
          )}

          {/* Step 2: OTP Verification */}
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
                      maxLength="1"
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
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
                    Resend in <span className="text-primary">{resendTimer > 0 ? `0:${resendTimer.toString().padStart(2, '0')}` : '0:00'}</span>
                  </p>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary text-white font-label-sm py-4 rounded-lg flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60"
                  >
                    {loading ? 'Verifying…' : 'Confirm code'}
                    {!loading && <span className="material-symbols-outlined text-sm">check</span>}
                  </button>
                  {apiError && (
                    <p className="text-error font-label-sm text-sm">{apiError}</p>
                  )}
                  {resendTimer === 0 && (
                    <button type="button" onClick={handleResend} className="font-label-sm text-secondary underline">
                      Resend code
                    </button>
                  )}
                </div>
              </form>
            </section>
          )}

          {/* Step 3: Profile */}
          {step === 'profile' && (
            <section className="space-y-8">
              <h1 className="font-headline-lg text-primary">Almost done! Tell us your name</h1>
              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="font-label-sm text-on-surface-variant">FIRST NAME</label>
                  <input
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleProfileChange}
                    className="w-full px-4 py-3 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary outline-none"
                    type="text"
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
                    type="text"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-label-sm text-on-surface-variant">DATE OF BIRTH</label>
                  <input
                    name="dob"
                    value={formData.dob}
                    onChange={handleProfileChange}
                    className="w-full px-4 py-3 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary outline-none"
                    type="date"
                    required
                  />
                </div>
                {apiError && (
                  <p className="text-error font-label-sm text-sm text-center">{apiError}</p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary text-white font-label-sm py-4 rounded-lg flex items-center justify-center gap-2 mt-4 disabled:opacity-60"
                >
                  {loading ? 'Saving…' : 'Start my health profile'}
                  {!loading && <span className="material-symbols-outlined text-sm">colors_spark</span>}
                </button>
              </form>
            </section>
          )}

          {/* Decorative leaf */}
          <div className="absolute -bottom-12 -right-12 opacity-5 pointer-events-none">
            <span className="material-symbols-outlined text-[160px] text-primary">pregnant_woman</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-stone-50 border-t border-amber-900/10 mt-auto">
        <div className="flex flex-col md:flex-row justify-between items-center w-full px-8 py-16 max-w-7xl mx-auto gap-8">
          <div className="flex flex-col items-center md:items-start gap-4">
            <div className="text-xl font-serif font-bold text-amber-900">Mama Care AI</div>
            <p className="font-serif text-sm tracking-wide text-stone-500 text-center md:text-left max-w-md">
              © 2024 Mama Care AI. Safe pregnancies, every time. Partnered with UBTH.
            </p>
          </div>
          <nav className="flex flex-wrap justify-center gap-6">
            <a href="#" className="font-serif text-sm tracking-wide text-stone-500 hover:text-amber-700 underline underline-offset-4">
              How it works
            </a>
            <a href="#" className="font-serif text-sm tracking-wide text-stone-500 hover:text-amber-700 underline underline-offset-4">
              For Providers
            </a>
            <a href="#" className="font-serif text-sm tracking-wide text-stone-500 hover:text-amber-700 underline underline-offset-4">
              Privacy Policy
            </a>
            <a href="#" className="font-serif text-sm tracking-wide text-stone-500 hover:text-amber-700 underline underline-offset-4">
              Terms
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
};

export default RegistrationFlow;