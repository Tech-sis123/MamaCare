import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const IntakeQuestionnaire = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({
    bloodType: null,
    genotype: null,
    pregnancies: null,
    symptoms: [],
    conditions: [],
    exercise: null,
    diet: null,
  });
  const [loading, setLoading] = useState(false);
  const [showDangerBanner, setShowDangerBanner] = useState(false);

  const steps = [
    { id: 'personal',  label: 'Personal',  icon: 'person' },
    { id: 'pregnancy', label: 'Pregnancy', icon: 'pregnant_woman' },
    { id: 'symptoms',  label: 'Symptoms',  icon: 'medical_services' },
    { id: 'history',   label: 'History',   icon: 'history' },
    { id: 'lifestyle', label: 'Lifestyle', icon: 'spa' },
  ];

  const progressPercent = ((step + 1) / steps.length) * 100;

  const setAnswer = (key, value) => {
    setAnswers(prev => ({ ...prev, [key]: value }));
  };

  const toggleMulti = (key, value) => {
    setAnswers(prev => {
      const arr = prev[key] || [];
      if (value === 'none') return { ...prev, [key]: ['none'] };
      const filtered = arr.filter(v => v !== 'none');
      if (filtered.includes(value)) {
        return { ...prev, [key]: filtered.filter(v => v !== value) };
      }
      const next = [...filtered, value];
      const dangerSymptoms = ['bleeding', 'blurred_vision', 'severe_headache'];
      setShowDangerBanner(next.some(v => dangerSymptoms.includes(v)));
      return { ...prev, [key]: next };
    });
  };

  const canProceed = () => {
    if (step === 0) return answers.bloodType && answers.genotype;
    if (step === 1) return answers.pregnancies !== null;
    if (step === 2) return true;
    if (step === 3) return true;
    if (step === 4) return answers.exercise && answers.diet;
    return true;
  };

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(s => s + 1);
      setShowDangerBanner(false);
      window.scrollTo(0, 0);
    } else {
      setLoading(true);
      setTimeout(() => navigate('/risk-result'), 2500);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(s => s - 1);
      setShowDangerBanner(false);
    } else {
      navigate(-1);
    }
  };

  // ── Step renderers ──────────────────────────────────────────────

  const renderPersonal = () => (
    <div className="space-y-8 animate-fade-in">
      <div>
        <p className="font-label-sm text-primary uppercase tracking-[0.2em] mb-3">Step 1 of 5</p>
        <h2 className="font-headline-lg text-primary text-2xl md:text-3xl leading-snug">
          Let's understand<br />your health profile.
        </h2>
        <p className="font-body-md text-on-surface-variant mt-2">
          This helps us personalise your risk assessment.
        </p>
      </div>

      <div>
        <p className="font-label-sm text-on-surface-variant uppercase tracking-widest mb-3">Blood Type</p>
        <div className="grid grid-cols-4 gap-3">
          {['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−'].map(bt => (
            <button
              key={bt}
              onClick={() => setAnswer('bloodType', bt)}
              className={`py-3 rounded-xl border-2 font-headline-md text-lg transition-all active:scale-95 ${
                answers.bloodType === bt
                  ? 'border-primary bg-tertiary-fixed text-primary shadow-md'
                  : 'border-outline-variant bg-white text-on-surface hover:border-primary/40'
              }`}
            >
              {bt}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="font-label-sm text-on-surface-variant uppercase tracking-widest mb-3">Genotype</p>
        <div className="grid grid-cols-4 gap-3">
          {['AA', 'AS', 'SS', 'AC'].map(g => (
            <button
              key={g}
              onClick={() => setAnswer('genotype', g)}
              className={`py-4 rounded-xl border-2 font-headline-md text-xl transition-all active:scale-95 ${
                answers.genotype === g
                  ? 'border-primary bg-tertiary-fixed text-primary shadow-md'
                  : 'border-outline-variant bg-white text-on-surface hover:border-primary/40'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
        {answers.genotype === 'SS' && (
          <div className="mt-4 bg-secondary/10 border border-secondary/20 rounded-xl p-4 flex items-start gap-3">
            <span className="material-symbols-outlined text-secondary mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
            <p className="font-body-md text-secondary text-sm">
              Sickle cell trait requires closer monitoring. We will flag this for your doctor.
            </p>
          </div>
        )}
      </div>
    </div>
  );

  const renderPregnancy = () => (
    <div className="space-y-8 animate-fade-in">
      <div>
        <p className="font-label-sm text-primary uppercase tracking-[0.2em] mb-3">Step 2 of 5</p>
        <h2 className="font-headline-lg text-primary text-2xl md:text-3xl leading-snug">
          How many pregnancies have you had before?
        </h2>
      </div>

      <div className="bg-tertiary-fixed rounded-xl p-5 border border-tertiary/10 flex items-start gap-4">
        <div className="p-2 bg-white rounded-full flex-shrink-0">
          <span className="material-symbols-outlined text-tertiary">info</span>
        </div>
        <div>
          <h4 className="font-bold font-label-sm text-tertiary">Why we ask this</h4>
          <p className="font-body-md text-tertiary/80 text-sm leading-relaxed mt-1">
            Your pregnancy history — including miscarriages or stillbirths — helps us provide tailored care.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {[
          { value: 0, emoji: '🌱', label: 'None', desc: 'First-time mama' },
          { value: 1, emoji: '⭐', label: '1 Previous', desc: 'One previous journey' },
          { value: 2, emoji: '✨', label: '2 Previous', desc: 'Experienced mama' },
          { value: '3+', emoji: '🌟', label: '3 or more', desc: 'Blessed family' },
        ].map(opt => (
          <button
            key={opt.value}
            onClick={() => {
              setAnswer('pregnancies', opt.value);
              if (opt.value === '3+') setShowDangerBanner(true);
              else setShowDangerBanner(false);
            }}
            className={`relative flex flex-col items-center justify-center p-8 rounded-xl transition-all active:scale-95 min-h-[140px] ${
              answers.pregnancies === opt.value
                ? 'bg-tertiary-fixed border-2 border-primary/30 shadow-md'
                : 'bg-white border-2 border-transparent hover:border-primary/20 card-shadow'
            }`}
          >
            {answers.pregnancies === opt.value && (
              <div className="absolute top-3 right-3 bg-primary text-white rounded-full p-0.5">
                <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
              </div>
            )}
            <span className="text-4xl mb-3">{opt.emoji}</span>
            <span className="font-bold text-primary font-body-md">{opt.label}</span>
            <p className="font-label-sm text-on-surface-variant mt-1 text-center">{opt.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );

  const symptomList = [
    { id: 'nausea',         emoji: '🤢', label: 'Nausea / Vomiting',  risk: 'low' },
    { id: 'fatigue',        emoji: '😴', label: 'Fatigue',             risk: 'low' },
    { id: 'severe_headache',emoji: '😫', label: 'Severe Headache',     risk: 'high' },
    { id: 'swelling',       emoji: '🦶', label: 'Swollen Hands/Face',  risk: 'medium' },
    { id: 'bleeding',       emoji: '🩸', label: 'Spotting / Bleeding', risk: 'high' },
    { id: 'blurred_vision', emoji: '👁️', label: 'Blurred Vision',      risk: 'high' },
    { id: 'back_pain',      emoji: '⚡', label: 'Back Pain',            risk: 'low' },
    { id: 'none',           emoji: '✅', label: 'None of these',        risk: 'none' },
  ];

  const renderSymptoms = () => (
    <div className="space-y-8 animate-fade-in">
      <div>
        <p className="font-label-sm text-primary uppercase tracking-[0.2em] mb-3">Step 3 of 5</p>
        <h2 className="font-headline-lg text-primary text-2xl md:text-3xl leading-snug">
          Are you experiencing any of these right now?
        </h2>
        <p className="font-body-md text-on-surface-variant mt-2">Select all that apply.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {symptomList.map(s => {
          const selected = answers.symptoms.includes(s.id);
          return (
            <button
              key={s.id}
              onClick={() => toggleMulti('symptoms', s.id)}
              className={`flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 transition-all active:scale-95 text-center ${
                selected
                  ? s.risk === 'high'
                    ? 'border-secondary bg-secondary/10 shadow-sm'
                    : 'border-primary bg-tertiary-fixed shadow-sm'
                  : 'border-outline-variant bg-white hover:border-primary/30'
              }`}
            >
              <span className="text-3xl">{s.emoji}</span>
              <span className={`font-label-sm text-xs ${selected && s.risk === 'high' ? 'text-secondary' : 'text-on-surface'}`}>
                {s.label}
              </span>
              {selected && (
                <span className={`material-symbols-outlined text-sm ${s.risk === 'high' ? 'text-secondary' : 'text-primary'}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                  check_circle
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  const conditionList = [
    { id: 'diabetes',     icon: 'glucose',         label: 'Diabetes' },
    { id: 'hypertension', icon: 'blood_pressure',  label: 'High Blood Pressure' },
    { id: 'sickle_cell',  icon: 'vaccines',        label: 'Sickle Cell Disease' },
    { id: 'c_section',    icon: 'surgical',        label: 'Previous C-Section' },
    { id: 'miscarriage',  icon: 'pregnant_woman',  label: 'Miscarriage / Stillbirth' },
    { id: 'twin',         icon: 'groups',          label: 'Twin / Multiple Pregnancy' },
    { id: 'none',         icon: 'check_circle',    label: 'None of these' },
  ];

  const renderHistory = () => (
    <div className="space-y-8 animate-fade-in">
      <div>
        <p className="font-label-sm text-primary uppercase tracking-[0.2em] mb-3">Step 4 of 5</p>
        <h2 className="font-headline-lg text-primary text-2xl md:text-3xl leading-snug">
          Do you have any of these conditions?
        </h2>
        <p className="font-body-md text-on-surface-variant mt-2">Select all that apply.</p>
      </div>

      <div className="space-y-3">
        {conditionList.map(c => {
          const selected = answers.conditions.includes(c.id);
          return (
            <button
              key={c.id}
              onClick={() => toggleMulti('conditions', c.id)}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left active:scale-[0.99] ${
                selected
                  ? 'border-primary bg-tertiary-fixed shadow-sm'
                  : 'border-outline-variant bg-white hover:border-primary/30'
              }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                selected ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant'
              }`}>
                <span className="material-symbols-outlined text-sm" style={selected ? { fontVariationSettings: "'FILL' 1" } : {}}>
                  {selected ? 'check' : c.icon}
                </span>
              </div>
              <span className="font-body-md font-medium">{c.label}</span>
              {selected && (
                <span className="ml-auto material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderLifestyle = () => (
    <div className="space-y-8 animate-fade-in">
      <div>
        <p className="font-label-sm text-primary uppercase tracking-[0.2em] mb-3">Step 5 of 5</p>
        <h2 className="font-headline-lg text-primary text-2xl md:text-3xl leading-snug">
          Tell us about your lifestyle.
        </h2>
        <p className="font-body-md text-on-surface-variant mt-2">
          Almost done! This helps us give you the right advice.
        </p>
      </div>

      <div>
        <p className="font-label-sm text-on-surface-variant uppercase tracking-widest mb-4">How active are you?</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: 'sedentary', emoji: '🛋️', label: 'Not Active', desc: 'Mostly resting' },
            { value: 'light',     emoji: '🚶', label: 'Light',      desc: 'Short walks' },
            { value: 'moderate',  emoji: '🏃', label: 'Moderate',   desc: '3–4×/week' },
            { value: 'active',    emoji: '💪', label: 'Active',     desc: 'Daily exercise' },
          ].map(e => (
            <button
              key={e.value}
              onClick={() => setAnswer('exercise', e.value)}
              className={`flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all active:scale-95 ${
                answers.exercise === e.value
                  ? 'border-primary bg-tertiary-fixed shadow-md'
                  : 'border-outline-variant bg-white hover:border-primary/30'
              }`}
            >
              <span className="text-3xl">{e.emoji}</span>
              <span className="font-bold font-body-md text-primary">{e.label}</span>
              <span className="font-label-sm text-on-surface-variant">{e.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="font-label-sm text-on-surface-variant uppercase tracking-widest mb-4">How is your diet?</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: 'poor',     emoji: '🍟', label: 'Poor',      desc: 'Mostly processed' },
            { value: 'fair',     emoji: '🥗', label: 'Fair',       desc: 'Mixed' },
            { value: 'good',     emoji: '🥦', label: 'Good',       desc: 'Mostly nutritious' },
          ].map(d => (
            <button
              key={d.value}
              onClick={() => setAnswer('diet', d.value)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all active:scale-95 ${
                answers.diet === d.value
                  ? 'border-primary bg-tertiary-fixed shadow-md'
                  : 'border-outline-variant bg-white hover:border-primary/30'
              }`}
            >
              <span className="text-3xl">{d.emoji}</span>
              <span className="font-bold font-body-md text-primary text-sm">{d.label}</span>
              <span className="font-label-sm text-on-surface-variant text-xs text-center">{d.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const stepContent = [renderPersonal, renderPregnancy, renderSymptoms, renderHistory, renderLifestyle];

  // ── Loading overlay ─────────────────────────────────────────────
  if (loading) {
    return (
      <div className="fixed inset-0 bg-surface-container-low z-[100] flex flex-col items-center justify-center p-8">
        <div className="relative mb-8">
          <div className="w-24 h-24 border-4 border-primary-fixed rounded-full animate-ping opacity-30" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-5xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              psychology
            </span>
          </div>
        </div>
        <h3 className="font-headline-md text-primary text-2xl">Calculating your risk...</h3>
        <p className="font-body-md text-on-surface-variant text-center max-w-xs mt-3">
          Our clinical AI is reviewing your profile using WHO-validated guidelines.
        </p>
        <div className="mt-8 flex gap-2">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-2 h-2 bg-primary rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col font-body-md text-on-surface">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-stone-50/90 backdrop-blur-md border-b border-primary/5">
        <div className="max-w-[640px] mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="p-2 -ml-2 hover:bg-surface-container-high rounded-full transition-colors"
            >
              <span className="material-symbols-outlined text-primary">arrow_back</span>
            </button>
            <div>
              <h1 className="font-headline-md text-primary text-lg">Your Health Profile</h1>
              <span className="flex items-center gap-1 font-label-sm text-primary/50 text-xs">
                <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                Auto-saved
              </span>
            </div>
          </div>
          <button className="px-3 py-1.5 rounded-full border border-primary/20 font-label-sm text-xs text-primary hover:bg-primary/5 transition-all">
            EN | Pidgin
          </button>
        </div>

        {/* Progress bar + step pills */}
        <div className="w-full bg-surface-container-low">
          <div className="h-0.5 bg-surface-container-highest">
            <div
              className="h-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="max-w-[640px] mx-auto px-4 py-3 overflow-x-auto whitespace-nowrap scrollbar-hide flex gap-2">
            {steps.map((s, idx) => (
              <div
                key={s.id}
                className={`inline-flex items-center px-3 py-1 rounded-full font-label-sm border text-xs transition-all ${
                  idx === step
                    ? 'bg-primary text-white shadow-sm border-transparent'
                    : idx < step
                    ? 'bg-primary/10 text-primary border-primary/20'
                    : 'bg-white text-on-surface-variant border-outline-variant'
                }`}
              >
                <span
                  className="material-symbols-outlined text-[14px] mr-1"
                  style={idx <= step ? { fontVariationSettings: "'FILL' 1" } : {}}
                >
                  {idx < step ? 'check_circle' : s.icon}
                </span>
                {s.label}
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-grow flex flex-col items-center px-6 py-10 md:py-16">
        <div className="w-full max-w-[520px]">
          {stepContent[step]()}
        </div>
      </main>

      {/* Sticky footer */}
      <footer className="sticky bottom-0 w-full bg-white/95 backdrop-blur-xl border-t border-primary/5 p-4 md:p-6">
        <div className="max-w-[520px] mx-auto w-full space-y-3">
          {/* Danger banner */}
          {showDangerBanner && (
            <div className="bg-secondary text-white px-5 py-4 rounded-xl flex items-center gap-4 animate-slide-up">
              <span className="material-symbols-outlined flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
              <div className="flex-grow">
                <p className="font-bold font-body-md text-sm">This may need urgent attention</p>
                <p className="font-label-sm text-xs opacity-90 mt-0.5">We will flag this for your nurse immediately.</p>
              </div>
              <button onClick={() => setShowDangerBanner(false)} className="p-1 hover:bg-white/10 rounded-full">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleBack}
              disabled={step === 0}
              className="flex-1 py-4 font-bold text-primary border-2 border-primary/15 rounded-xl hover:bg-primary/5 transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
            >
              Back
            </button>
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className={`flex-[2] py-4 font-bold text-white rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 ${
                canProceed()
                  ? 'bg-primary shadow-lg shadow-primary/20 hover:opacity-90'
                  : 'bg-outline-variant cursor-not-allowed'
              }`}
            >
              {step === steps.length - 1 ? 'Submit' : 'Continue'}
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default IntakeQuestionnaire;
