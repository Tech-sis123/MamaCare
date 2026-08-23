import React from 'react';

const ScreenShell = ({ title, subtitle, onBack, children }) => {
  return (
    <div className="bg-background text-on-surface font-body-md min-h-screen flex flex-col">
      <div className="grain-overlay pointer-events-none" />
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-outline-variant/40">
        <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-3 flex items-start gap-3">
          <button
            type="button"
            onClick={onBack}
            className="mt-0.5 text-on-surface-variant hover:text-on-surface transition-colors shrink-0"
            aria-label="Back"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="font-headline-lg text-lg text-on-surface leading-tight">{title}</h1>
            {subtitle ? (
              <p className="font-body-md text-xs text-on-surface-variant truncate mt-0.5">{subtitle}</p>
            ) : null}
          </div>
        </div>
      </header>
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-5 pb-32 space-y-6">
        {children}
      </main>
    </div>
  );
};

const formatDate = (raw) => {
  if (!raw) return '—';
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? String(raw) : d.toLocaleDateString('en-GB') + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

const formatKey = (key) => {
  if (!key) return '';
  return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const PatientSelfReported = ({ patientName, fullPatient, onBack }) => {
  const symptoms = fullPatient?.symptoms || [];
  const intake = fullPatient?.intake_responses || [];

  // Group intake by domain
  const intakeByDomain = intake.reduce((acc, curr) => {
    if (!acc[curr.domain]) acc[curr.domain] = [];
    acc[curr.domain].push(curr);
    return acc;
  }, {});

  const domains = Object.keys(intakeByDomain).sort();

  return (
    <ScreenShell title="Patient Self-Reported Data" subtitle={patientName} onBack={onBack}>
      
      {/* Symptoms Section */}
      <section className="bg-white border border-outline-variant/40 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-surface-container-low px-4 py-3 border-b border-outline-variant/25">
          <h2 className="font-label-sm text-on-surface font-semibold text-sm">Recent Symptoms</h2>
        </div>
        <div className="p-4">
          {symptoms.length === 0 ? (
            <p className="text-sm text-on-surface-variant italic">No symptoms reported by patient.</p>
          ) : (
            <div className="space-y-3">
              {symptoms.map(s => (
                <div key={s.id} className="border border-outline-variant/30 rounded-lg p-3 bg-surface-container-lowest">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-semibold text-sm">{formatKey(s.symptom_key)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      s.severity === 'severe' ? 'bg-secondary/10 text-secondary' :
                      s.severity === 'moderate' ? 'bg-amber-100 text-amber-800' :
                      'bg-primary/10 text-primary'
                    }`}>
                      {s.severity}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant mb-1">Reported: {formatDate(s.reported_at)}</p>
                  {s.notes && <p className="text-sm mt-2 text-on-surface">{s.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Intake / Biodata Section */}
      <section className="bg-white border border-outline-variant/40 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-surface-container-low px-4 py-3 border-b border-outline-variant/25">
          <h2 className="font-label-sm text-on-surface font-semibold text-sm">Patient Biodata & History</h2>
        </div>
        <div className="p-4 space-y-6">
          {domains.length === 0 ? (
            <p className="text-sm text-on-surface-variant italic">No intake forms completed.</p>
          ) : (
            domains.map(domain => (
              <div key={domain}>
                <h3 className="font-label-sm text-primary uppercase text-xs tracking-wider mb-2">{formatKey(domain)}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                  {intakeByDomain[domain].map(ir => (
                    <div key={ir.id} className="text-sm">
                      <span className="text-on-surface-variant block text-xs">{formatKey(ir.question_key)}</span>
                      <span className="font-medium text-on-surface">
                        {typeof ir.answer === 'boolean' 
                          ? (ir.answer ? 'Yes' : 'No') 
                          : (ir.answer || '—')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

    </ScreenShell>
  );
};

export default PatientSelfReported;
