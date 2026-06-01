import React from 'react';
import { useNavigate } from 'react-router-dom';

const RISK_CONFIG = {
  LOW: {
    headerBg: '#1B5E3B',
    heroBg: '#D4E6D8',
    badgeBg: '#1B5E3B',
    badgeLabel: 'LOW RISK',
    icon: 'check_circle',
    iconColor: 'text-primary',
    title: "You're doing well!",
    body: "Your assessment looks healthy. Keep attending your antenatal visits and follow your care plan.",
    reason: "Your blood pressure, blood levels, and symptoms are all within safe ranges. This means your baby is growing in a healthy environment. Keep eating well, resting, and attending all your checkups.",
    factors: [
      { type: 'ok', icon: 'check_circle', title: 'BP within normal range', desc: 'Your latest reading was 110/70 mmHg — excellent.' },
      { type: 'ok', icon: 'check_circle', title: 'Healthy haemoglobin', desc: 'Hb of 11.5 g/dL — within safe range for pregnancy.' },
      { type: 'ok', icon: 'check_circle', title: 'Age within range',      desc: 'Your age factor is considered low-risk.' },
      { type: 'ok', icon: 'check_circle', title: 'No prior complications', desc: 'Your history shows no previous high-risk pregnancies.' },
    ],
    ctaLabel: 'Book your next appointment',
    ctaRoute: '/appointments',
    urgent: false,
  },
  MEDIUM: {
    headerBg: '#BA7517',
    heroBg: '#FFF3CD',
    badgeBg: '#BA7517',
    badgeLabel: 'MEDIUM RISK',
    icon: 'warning',
    iconColor: 'text-amber-700',
    title: "Some monitoring needed.",
    body: "Your results suggest a few areas to watch. Your doctor has been notified and will review your case at your next visit.",
    reason: "Your blood pressure is a little higher than normal and you reported some swelling. These are not emergencies, but they can become serious if not watched. Your nurse will check on you more closely at your next visit — please do not miss it.",
    factors: [
      { type: 'warn', icon: 'warning',       title: 'Slightly elevated BP',  desc: 'Your reading was 135/85 mmHg — borderline. We are watching this.' },
      { type: 'warn', icon: 'warning',       title: 'Mild swelling reported', desc: 'Oedema can be normal but warrants monitoring.' },
      { type: 'ok',   icon: 'check_circle',  title: 'Normal heartbeat',       desc: 'Foetal heart rate is within the healthy range.' },
      { type: 'ok',   icon: 'check_circle',  title: 'Good blood sugar',       desc: 'No indicators of gestational diabetes detected.' },
    ],
    ctaLabel: 'Book a priority appointment',
    ctaRoute: '/appointments',
    urgent: false,
  },
  HIGH: {
    headerBg: '#C0533A',
    heroBg: '#FCEBEB',
    badgeBg: '#C0533A',
    badgeLabel: 'HIGH RISK',
    icon: 'notifications_active',
    iconColor: 'text-secondary',
    title: "You need to see a doctor today.",
    body: "A doctor has been notified and will contact you. Please go to UBTH today — do not wait.",
    reason: "Your blood pressure is very high and your headache is a warning sign of a condition called pre-eclampsia. This can be dangerous for you and your baby if not treated quickly. Please go to the hospital now — you do not need to wait for an appointment.",
    factors: [
      { type: 'danger', icon: 'emergency_home',      title: 'BP critically elevated',  desc: 'Your latest reading was 160/110 mmHg — requires immediate attention.' },
      { type: 'danger', icon: 'medical_information', title: 'Severe headache reported', desc: 'Symptoms matching pre-eclampsia warning signs.' },
      { type: 'ok',     icon: 'check_circle',        title: 'Age within range',         desc: 'Your age factor is currently considered low-risk.' },
      { type: 'ok',     icon: 'check_circle',        title: 'No prior complications',   desc: 'Your history does not indicate previous high-risk pregnancies.' },
    ],
    ctaLabel: 'CALL UBTH EMERGENCY LINE NOW',
    ctaRoute: null,
    ctaPhone: 'tel:08012345678',
    urgent: true,
  },
};

const RiskAssessmentResult = () => {
  const navigate = useNavigate();
  const stored = localStorage.getItem('mc_risk_tier');
  const riskLevel = ['HIGH', 'MEDIUM', 'LOW'].includes(stored) ? stored : 'LOW';
  const cfg = RISK_CONFIG[riskLevel];

  const factorStyles = {
    danger: 'bg-white border-l-4 border-secondary',
    warn:   'bg-amber-50 border-l-4 border-amber-500',
    ok:     'bg-primary-fixed/20 border-l-4 border-primary opacity-80',
  };
  const factorIconStyles = {
    danger: 'text-secondary',
    warn:   'text-amber-600',
    ok:     'text-primary',
  };

  return (
    <div className="font-body-md text-on-surface min-h-screen">
      <div className="grain-overlay" />

      {/* Header */}
      <header
        className="sticky top-0 z-50 w-full text-white transition-colors duration-500"
        style={{ backgroundColor: cfg.headerBg }}
      >
        <div className="flex justify-between items-center w-full px-6 py-4 max-w-3xl mx-auto">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 hover:opacity-80 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="font-headline-md">Your Result</h1>
          <span className="material-symbols-outlined">pregnant_woman</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 md:px-10 pb-64">
        {/* Hero Zone */}
        <section
          className="mt-6 rounded-xl p-8 md:p-12 flex flex-col items-center text-center border shadow-sm overflow-hidden relative transition-all duration-500"
          style={{ backgroundColor: cfg.heroBg, borderColor: `${cfg.headerBg}22` }}
        >
          <div className="relative mb-6">
            <div className={`p-6 rounded-full ${riskLevel === 'HIGH' ? 'animate-pulse-custom' : ''}`}
                 style={{ backgroundColor: `${cfg.headerBg}15` }}>
              <span
                className={`material-symbols-outlined text-6xl ${cfg.iconColor}`}
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                {cfg.icon}
              </span>
            </div>
          </div>

          <div
            className="text-white font-label-sm px-6 py-2 rounded-full mb-6 shadow-sm flex items-center gap-2 uppercase tracking-widest text-sm"
            style={{ backgroundColor: cfg.headerBg }}
          >
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
              {riskLevel === 'HIGH' ? 'warning' : riskLevel === 'MEDIUM' ? 'info' : 'verified'}
            </span>
            {cfg.badgeLabel}
          </div>

          <h2 className="font-headline-lg text-3xl mb-4 max-w-md" style={{ color: cfg.headerBg }}>
            {cfg.title}
          </h2>
          <p className="font-body-lg text-on-surface-variant max-w-xl">{cfg.body}</p>

          {/* Plain-language reason */}
          <div className="mt-6 w-full max-w-xl bg-white/70 border border-outline-variant/30 rounded-xl p-5 flex items-start gap-4 text-left">
            <span
              className="material-symbols-outlined text-2xl flex-shrink-0 mt-0.5"
              style={{ color: cfg.headerBg, fontVariationSettings: "'FILL' 1" }}
            >
              pregnant_woman
            </span>
            <div>
              <p className="font-label-sm uppercase tracking-widest text-xs mb-1" style={{ color: cfg.headerBg }}>
                Why this level?
              </p>
              <p className="font-body-md text-on-surface leading-relaxed text-sm">{cfg.reason}</p>
            </div>
          </div>
        </section>

        {/* Contributing Factors */}
        <section className="mt-12">
          <div className="flex justify-between items-end mb-6">
            <div>
              <h3 className="font-headline-md text-on-surface">Contributing Factors</h3>
              <p className="font-body-md text-on-surface-variant text-sm">Why we calculated this risk level</p>
            </div>
            <span className="font-label-sm text-outline px-3 py-1 bg-surface-container rounded-full text-xs">Engine v1.0</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cfg.factors.map((f, i) => (
              <div key={i} className={`p-4 rounded-xl shadow-[0_2px_16px_rgba(27,94,59,0.08)] flex items-start gap-4 ${factorStyles[f.type]}`}>
                <span
                  className={`material-symbols-outlined mt-1 ${factorIconStyles[f.type]}`}
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {f.icon}
                </span>
                <div>
                  <p className="font-body-md font-bold text-on-surface">{f.title}</p>
                  <p className="font-body-md text-sm text-on-surface-variant mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center italic text-outline font-body-md text-sm">
            Assessed by Mama Care AI clinical rules based on current medical standards.
          </p>
        </section>
      </main>

      {/* Sticky bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-lg border-t border-outline-variant/20">
        {cfg.urgent && (
          <div className="bg-error text-white text-center py-2 px-4 flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-sm">emergency</span>
            <span className="font-label-sm uppercase tracking-widest text-xs">This is urgent. Do not wait.</span>
          </div>
        )}
        <div className="max-w-xl mx-auto p-6 space-y-3">
          {cfg.ctaRoute ? (
            <button
              onClick={() => navigate(cfg.ctaRoute)}
              className="w-full text-white font-label-sm py-5 rounded-lg shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-3 font-bold"
              style={{ backgroundColor: cfg.headerBg }}
            >
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>event_available</span>
              {cfg.ctaLabel}
            </button>
          ) : (
            <a
              href={cfg.ctaPhone}
              className="w-full text-white font-label-sm py-5 rounded-lg shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-3 font-bold"
              style={{ backgroundColor: cfg.headerBg }}
            >
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>call</span>
              {cfg.ctaLabel}
            </a>
          )}
          <button
            onClick={() => navigate('/emergency')}
            className="w-full bg-transparent border-2 border-secondary text-secondary font-label-sm py-4 rounded-lg hover:bg-secondary/5 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined">report_problem</span>
            Report a danger sign
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full text-on-surface-variant font-label-sm py-3 rounded-lg hover:bg-surface-container active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">home</span>
            Back to dashboard
          </button>
        </div>
      </div>

    </div>
  );
};

export default RiskAssessmentResult;
