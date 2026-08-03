import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

const RISK_CONFIG = {
  LOW: {
    headerBg: '#1B5E3B',
    heroBg: '#D4E6D8',
    icon: 'check_circle',
    iconColor: 'text-primary',
    title: "You're doing well!",
    body: 'Your assessment looks healthy. Keep attending your antenatal visits and follow your care plan.',
    reason:
      'Your blood pressure, blood levels, and symptoms are all within safe ranges. This means your baby is growing in a healthy environment. Keep eating well, resting, and attending all your checkups.',
    factors: [
      { type: 'ok', icon: 'check_circle', title: 'BP within normal range', desc: 'Your latest reading was within a safe range for pregnancy.' },
      { type: 'ok', icon: 'check_circle', title: 'Healthy blood levels', desc: 'Haemoglobin / PCV within safe range for pregnancy.' },
      { type: 'ok', icon: 'check_circle', title: 'Age within range', desc: 'Your age factor is considered low-risk.' },
      { type: 'ok', icon: 'check_circle', title: 'No major risk flags', desc: 'No high-risk clinical flags were raised by the assessment.' },
    ],
    ctaLabel: 'Book your next appointment',
    ctaRoute: '/appointments',
    urgent: false,
  },
  MEDIUM: {
    headerBg: '#BA7517',
    heroBg: '#FFF3CD',
    icon: 'warning',
    iconColor: 'text-amber-700',
    title: 'Some monitoring needed.',
    body: 'Your results suggest a few areas to watch. Your doctor has been notified and will review your case at your next visit.',
    reason:
      'One or more parts of your assessment need closer monitoring. These are not always emergencies, but they can become serious if not watched. Please do not miss your next visit.',
    factors: [
      { type: 'warn', icon: 'warning', title: 'Closer monitoring needed', desc: 'Your nurse or doctor will review these points at your next visit.' },
      { type: 'ok', icon: 'check_circle', title: 'Care plan continues', desc: 'Keep attending antenatal visits and follow your care plan.' },
    ],
    ctaLabel: 'Book a priority appointment',
    ctaRoute: '/appointments',
    urgent: false,
  },
  HIGH: {
    headerBg: '#C0533A',
    heroBg: '#FCEBEB',
    icon: 'notifications_active',
    iconColor: 'text-secondary',
    title: 'You need to see a doctor today.',
    body: 'A doctor has been notified and will contact you. Please go to your nearest hospital today — do not wait.',
    reason:
      'Your assessment raised urgent clinical concerns. Please seek care today — you do not need to wait for a routine appointment.',
    factors: [
      { type: 'danger', icon: 'emergency_home', title: 'Urgent review required', desc: 'Please go to the hospital or contact emergency care now.' },
    ],
    ctaLabel: 'CALL EMERGENCY LINE NOW',
    ctaRoute: null,
    ctaPhone: 'tel:08012345678',
    urgent: true,
  },
};

/** Map engine reason strings → mother-friendly factor cards (tier-aware styling). */
function reasonToFactor(reason, riskLevel) {
  const r = String(reason || '');
  const lower = r.toLowerCase();

  // Missing data is informational, not a clinical danger for the mother-facing UI
  if (lower.includes('missing critical field')) {
    return {
      type: 'warn',
      icon: 'info',
      title: 'Some information is incomplete',
      desc: 'We could not verify every clinical detail yet. Your care team may ask for more information.',
    };
  }

  if (lower.includes('elevated bp') || lower.includes('blood pressure')) {
    return {
      type: riskLevel === 'HIGH' ? 'danger' : 'warn',
      icon: riskLevel === 'HIGH' ? 'emergency_home' : 'warning',
      title: riskLevel === 'HIGH' ? 'Blood pressure needs urgent attention' : 'Blood pressure needs monitoring',
      desc: r,
    };
  }

  if (lower.includes('anaemia') || lower.includes('hemoglobin') || lower.includes('haemoglobin')) {
    return {
      type: riskLevel === 'HIGH' ? 'danger' : 'warn',
      icon: 'bloodtype',
      title: 'Blood level concern',
      desc: r,
    };
  }

  if (lower.includes('genotype')) {
    return {
      type: 'danger',
      icon: 'genetics',
      title: 'Genotype requires close monitoring',
      desc: r,
    };
  }

  if (lower.includes('stillbirth')) {
    return {
      type: 'danger',
      icon: 'medical_information',
      title: 'Previous pregnancy loss noted',
      desc: r,
    };
  }

  if (lower.includes('eclampsia')) {
    return {
      type: 'danger',
      icon: 'emergency_home',
      title: 'History of eclampsia',
      desc: r,
    };
  }

  if (lower.includes('caesarean') || lower.includes('c-section') || lower.includes('csection')) {
    return {
      type: 'warn',
      icon: 'local_hospital',
      title: 'Previous caesarean section',
      desc: r,
    };
  }

  if (lower.includes('multiparity') || lower.includes('parity')) {
    return {
      type: 'warn',
      icon: 'pregnant_woman',
      title: 'Higher number of previous births',
      desc: r,
    };
  }

  if (lower.includes('twin') || lower.includes('multiple')) {
    return {
      type: 'warn',
      icon: 'group',
      title: 'Twin or multiple pregnancy',
      desc: r,
    };
  }

  if (lower.includes('hiv')) {
    return {
      type: 'warn',
      icon: 'medical_services',
      title: 'HIV care pathway',
      desc: r,
    };
  }

  if (lower.includes('maternal age') || lower.includes('age under') || lower.includes('advanced maternal')) {
    return {
      type: 'warn',
      icon: 'person',
      title: 'Age-related monitoring',
      desc: r,
    };
  }

  // Default: surface the engine reason with tier-appropriate severity
  return {
    type: riskLevel === 'HIGH' ? 'danger' : riskLevel === 'MEDIUM' ? 'warn' : 'ok',
    icon: riskLevel === 'HIGH' ? 'warning' : riskLevel === 'MEDIUM' ? 'info' : 'check_circle',
    title: 'Assessment note',
    desc: r,
  };
}

function loadStoredReasons() {
  try {
    const raw = localStorage.getItem('mc_risk_reasons');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
  } catch {
    return [];
  }
}

const RiskAssessmentResult = () => {
  const navigate = useNavigate();
  const stored = localStorage.getItem('mc_risk_tier');
  const riskLevel = ['HIGH', 'MEDIUM', 'LOW'].includes(stored) ? stored : 'LOW';
  const cfg = RISK_CONFIG[riskLevel];
  const engineVersion = localStorage.getItem('mc_risk_engine') || '1.0';

  const factors = useMemo(() => {
    const reasons = loadStoredReasons();
    // Only show clinical reasons (skip pure "missing field" noise if we also have real clinical flags)
    const clinical = reasons.filter(r => !String(r).toLowerCase().includes('missing critical field'));
    const source = clinical.length > 0 ? clinical : reasons;

    if (source.length > 0) {
      return source.map(r => reasonToFactor(r, riskLevel));
    }
    // Fallback static factors for this tier when no engine reasons are available
    return cfg.factors;
  }, [riskLevel, cfg.factors]);

  const factorStyles = {
    danger: 'bg-white border-l-4 border-secondary',
    warn: 'bg-amber-50 border-l-4 border-amber-500',
    ok: 'bg-primary-fixed/20 border-l-4 border-primary',
  };
  const factorIconStyles = {
    danger: 'text-secondary',
    warn: 'text-amber-600',
    ok: 'text-primary',
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
        {/* Hero Zone — overflow visible so the reason card is never clipped */}
        <section
          className="mt-6 rounded-xl p-6 md:p-10 flex flex-col items-center text-center border shadow-sm relative transition-all duration-500"
          style={{ backgroundColor: cfg.heroBg, borderColor: `${cfg.headerBg}22` }}
        >
          <div className="relative mb-6">
            <div
              className={`p-6 rounded-full ${riskLevel === 'HIGH' ? 'animate-pulse-custom' : ''}`}
              style={{ backgroundColor: `${cfg.headerBg}15` }}
            >
              <span
                className={`material-symbols-outlined text-6xl ${cfg.iconColor}`}
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                {cfg.icon}
              </span>
            </div>
          </div>

          <h2 className="font-headline-lg text-3xl mb-4 max-w-md" style={{ color: cfg.headerBg }}>
            {cfg.title}
          </h2>
          <p className="font-body-lg text-on-surface-variant max-w-xl">{cfg.body}</p>

          {/* Plain-language reason — full width inside padded hero, no clipping */}
          <div className="mt-6 w-full bg-white/90 border border-outline-variant/30 rounded-xl p-5 flex items-start gap-4 text-left shadow-sm">
            <span
              className="material-symbols-outlined text-2xl flex-shrink-0 mt-0.5"
              style={{ color: cfg.headerBg, fontVariationSettings: "'FILL' 1" }}
            >
              pregnant_woman
            </span>
            <div className="min-w-0 flex-1">
              <p
                className="font-label-sm uppercase tracking-widest text-xs mb-1"
                style={{ color: cfg.headerBg }}
              >
                Why this level?
              </p>
              <p className="font-body-md text-on-surface leading-relaxed text-sm break-words">
                {cfg.reason}
              </p>
            </div>
          </div>
        </section>

        {/* Contributing Factors */}
        <section className="mt-10">
          <div className="flex justify-between items-end mb-6 gap-3">
            <div>
              <h3 className="font-headline-md text-on-surface">Contributing Factors</h3>
              <p className="font-body-md text-on-surface-variant text-sm">Why we calculated this risk level</p>
            </div>
            <span className="font-label-sm text-outline px-3 py-1 bg-surface-container rounded-full text-xs flex-shrink-0">
              Engine v{engineVersion}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {factors.map((f, i) => (
              <div
                key={i}
                className={`p-4 rounded-xl shadow-[0_2px_16px_rgba(27,94,59,0.08)] flex items-start gap-4 ${factorStyles[f.type] || factorStyles.ok}`}
              >
                <span
                  className={`material-symbols-outlined mt-1 flex-shrink-0 ${factorIconStyles[f.type] || factorIconStyles.ok}`}
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {f.icon}
                </span>
                <div className="min-w-0">
                  <p className="font-body-md font-bold text-on-surface">{f.title}</p>
                  <p className="font-body-md text-sm text-on-surface-variant mt-0.5 break-words">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center italic text-outline font-body-md text-sm">
            Assessed by 9Care AI clinical rules based on current medical standards.
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
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                event_available
              </span>
              {cfg.ctaLabel}
            </button>
          ) : (
            <a
              href={cfg.ctaPhone}
              className="w-full text-white font-label-sm py-5 rounded-lg shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-3 font-bold"
              style={{ backgroundColor: cfg.headerBg }}
            >
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                call
              </span>
              {cfg.ctaLabel}
            </a>
          )}
          <button
            onClick={() => navigate('/emergency')}
            className="w-full bg-transparent border-2 border-secondary text-secondary font-label-sm py-4 rounded-lg hover:bg-secondary/5 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined">report_problem</span>
            Report symptoms
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
