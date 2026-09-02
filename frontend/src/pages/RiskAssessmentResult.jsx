import React from 'react';
import { useNavigate } from 'react-router-dom';

const HEADER_BG = '#1B5E3B';
const HERO_BG = '#D4E6D8';

const RiskAssessmentResult = () => {
  const navigate = useNavigate();

  return (
    <div className="font-body-md text-on-surface min-h-screen">
      <div className="grain-overlay" />

      <header
        className="sticky top-0 z-50 w-full text-white"
        style={{ backgroundColor: HEADER_BG }}
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
        <section
          className="mt-6 rounded-xl p-6 md:p-10 flex flex-col items-center text-center border shadow-sm"
          style={{ backgroundColor: HERO_BG, borderColor: `${HEADER_BG}22` }}
        >
          <div className="relative mb-6">
            <div className="p-6 rounded-full" style={{ backgroundColor: `${HEADER_BG}15` }}>
              <span
                className="material-symbols-outlined text-6xl text-primary"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                check_circle
              </span>
            </div>
          </div>

          <h2 className="font-headline-lg text-3xl mb-4 max-w-md" style={{ color: HEADER_BG }}>
            You&apos;re all set
          </h2>
          <p className="font-body-lg text-on-surface-variant max-w-xl">
            Up next is to book your first antenatal clinic visit and have your booking investigations done.
          </p>
        </section>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-lg border-t border-outline-variant/20">
        <div className="max-w-xl mx-auto p-6 space-y-3">
          <button
            onClick={() => navigate('/appointments')}
            className="w-full text-white font-label-sm py-5 rounded-lg shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-3 font-bold"
            style={{ backgroundColor: HEADER_BG }}
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              event_available
            </span>
            Book your Antenatal clinic visit
          </button>
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
