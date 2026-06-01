import React, { useState } from 'react';

const IntakeQuestionnaire = () => {
  // Current step index (0‑based)
  const [step, setStep] = useState(1); // 1 = Pregnancy step (as shown)
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showDangerBanner, setShowDangerBanner] = useState(false);
  const [loading, setLoading] = useState(false);

  // Step titles & pill labels
  const steps = [
    { id: 'personal', label: 'Personal', icon: 'person' },
    { id: 'pregnancy', label: 'Pregnancy', icon: 'pregnant_woman' },
    { id: 'symptoms', label: 'Symptoms', icon: 'medical_services' },
    { id: 'history', label: 'History', icon: 'history' },
    { id: 'lifestyle', label: 'Lifestyle', icon: 'spa' },
  ];

  // Mock question for each step (simplified; you can expand)
  const questions = [
    { text: "What's your name and age?", type: 'text' },
    { text: 'How many pregnancies have you had before?', type: 'pregnancyCount' },
    { text: 'Do you have any current symptoms?', type: 'symptoms' },
    { text: 'Any previous medical conditions?', type: 'history' },
    { text: 'Tell us about your lifestyle', type: 'lifestyle' },
  ];

  const progressPercent = ((step + 1) / steps.length) * 100;

  const handleSelectAnswer = (value) => {
    setSelectedAnswer(value);
    // Show danger banner for high‑risk answers (e.g., 3+ pregnancies)
    if (step === 1 && (value === 3 || value === '3+')) {
      setShowDangerBanner(true);
    } else {
      setShowDangerBanner(false);
    }
  };

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
      setSelectedAnswer(null);
      setShowDangerBanner(false);
    } else {
      // Last step – simulate API call
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        alert('Questionnaire completed!');
      }, 2000);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
      setSelectedAnswer(null);
      setShowDangerBanner(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-body-md text-on-background selection:bg-primary-fixed">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-stone-50/80 backdrop-blur-md border-b border-primary/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button className="p-2 -ml-2 hover:bg-surface-container-high rounded-full transition-colors duration-300">
              <span className="material-symbols-outlined text-primary">arrow_back</span>
            </button>
            <div>
              <h1 className="font-headline-md text-primary text-lg md:text-xl">Your Health Profile</h1>
              <span className="flex items-center gap-1 text-label-sm text-primary/60">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                Saved
              </span>
            </div>
          </div>
          <button className="px-4 py-2 rounded-full border border-primary/20 text-label-sm text-primary font-bold hover:bg-primary/5 transition-all">
            EN | Pidgin
          </button>
        </div>

        {/* Sticky Progress Section */}
        <div className="w-full bg-surface-container-low">
          <div className="w-full h-1 bg-surface-container-highest">
            <div
              className="h-full bg-primary-container transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
          <div className="max-w-7xl mx-auto px-4 py-3 overflow-x-auto whitespace-nowrap scrollbar-hide flex gap-3 scroll-px-4">
            {steps.map((s, idx) => (
              <div
                key={s.id}
                className={`flex items-center px-4 py-1.5 rounded-full font-bold text-label-sm border transition-all ${
                  idx === step
                    ? 'bg-primary-container text-white shadow-sm ring-4 ring-primary-container/10 border-transparent'
                    : idx < step
                    ? 'bg-primary/10 text-primary border-primary/20'
                    : 'bg-white text-on-surface-variant border-outline-variant'
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[16px] mr-1 ${idx === step ? 'fill-white' : ''}`}
                  style={idx === step ? { fontVariationSettings: "'FILL' 1" } : {}}
                >
                  {s.icon}
                </span>
                {s.label}
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col items-center px-6 py-12 md:py-24">
        <div className="w-full max-w-[520px] space-y-10">
          {/* Question Text */}
          <div className="text-center md:text-left">
            <span className="text-label-sm text-primary uppercase tracking-[0.2em] block mb-4">
              Step {step + 1} of {steps.length}
            </span>
            <h2 className="font-headline-lg text-primary text-2xl md:text-3xl leading-snug">
              {questions[step].text}
            </h2>
          </div>

          {/* Helper Tooltip (only for pregnancy step) */}
          {step === 1 && (
            <div className="bg-tertiary-fixed rounded-xl p-5 border border-tertiary/10 relative overflow-hidden group">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-white rounded-full flex-shrink-0">
                  <span className="material-symbols-outlined text-tertiary">info</span>
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-label-sm text-tertiary">Why we ask this</h4>
                  <p className="text-body-md text-tertiary/80 leading-relaxed">
                    Knowing your history helps us provide tailored care. Please include all previous
                    pregnancies, including miscarriages or stillbirths.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Answer Options – dynamic based on step */}
          {step === 1 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { value: 0, emoji: '0️⃣', label: 'None', desc: 'First-time mama' },
                { value: 1, emoji: '1️⃣', label: '1 Previous', desc: 'One previous journey' },
                { value: 2, emoji: '2️⃣', label: '2 Previous', desc: 'Experienced mama' },
                { value: '3+', emoji: '3️⃣+', label: '3 or more', desc: 'Blessed family' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleSelectAnswer(opt.value)}
                  className={`flex flex-col items-center justify-center p-8 rounded-xl transition-all group active:scale-95 min-h-[140px] ${
                    selectedAnswer === opt.value
                      ? 'bg-tertiary-fixed border-2 border-primary-container/40 soft-shadow'
                      : 'bg-white border-2 border-transparent hover:border-primary-container/20 soft-shadow'
                  }`}
                >
                  {selectedAnswer === opt.value && (
                    <div className="absolute top-3 right-3 bg-primary-container text-white rounded-full p-0.5">
                      <span
                        className="material-symbols-outlined text-[16px]"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        check
                      </span>
                    </div>
                  )}
                  <span className="text-4xl mb-3 block group-hover:scale-110 transition-transform">
                    {opt.emoji}
                  </span>
                  <span className="font-bold text-primary text-body-lg">{opt.label}</span>
                  <p className="text-label-sm text-on-surface-variant mt-1">{opt.desc}</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="bg-white p-8 rounded-xl soft-shadow text-center text-on-surface-variant">
              {/* Placeholder for other step questions */}
              <p className="text-body-lg">Question content for "{questions[step].text}" would go here.</p>
            </div>
          )}

          {/* Decorative Illustration (only for pregnancy step) */}
          {step === 1 && (
            <div className="pt-8 opacity-40 grayscale group-hover:grayscale-0 transition-all duration-700">
              <img
                alt="Mother and child"
                className="w-32 mx-auto rounded-full aspect-square object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAXJaS8O_aADPYbZmLMsTWOOosvB-CSXLl8_9YFWuQvV5iw6sDhnZsIAQvapid309qIkHeL4dyHW4i5Op0CX0Jb0ZFd3Y_PyLU2geQht4J7Iw4cWL9YaAwfhZG03NcdikacwPcBw46eefGFzmJXxWaKkk2A1juyeFkuyQIA3j6xvWTN8JhUeY82vENRSTv_7SxF-nB8Tw4pcegNiueiVJPgnC9iV5n3uyt-6Wdc93xbJrITvzNP6DKvnmADJOTMc29GW80DvS8FOz8"
              />
            </div>
          )}
        </div>
      </main>

      {/* Navigation Footer */}
      <footer className="sticky bottom-0 w-full bg-white/90 backdrop-blur-xl border-t border-primary/5 p-4 md:p-6 flex flex-col gap-4">
        <div className="max-w-[520px] mx-auto w-full">
          {/* Danger Sign Banner */}
          {showDangerBanner && (
            <div className="bg-secondary text-on-secondary px-5 py-4 rounded-xl flex items-center gap-4 soft-shadow transform translate-y-0 opacity-100 transition-all duration-500">
              <div className="p-2 bg-white/20 rounded-full">
                <span
                  className="material-symbols-outlined"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  warning
                </span>
              </div>
              <div className="flex-grow">
                <p className="font-bold text-body-md leading-tight">This sounds urgent...</p>
                <p className="text-label-sm opacity-90">
                  Higher frequency of previous pregnancies may require extra monitoring.
                  We will flag this for your nurse.
                </p>
              </div>
              <button
                onClick={() => setShowDangerBanner(false)}
                className="p-1 hover:bg-white/10 rounded-full transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
          )}
        </div>

        <div className="max-w-[520px] mx-auto w-full flex items-center gap-4">
          <button
            onClick={handleBack}
            disabled={step === 0}
            className="flex-1 py-4 font-bold text-primary border-2 border-primary/10 rounded-xl hover:bg-primary/5 transition-all active:scale-95 min-h-[56px] disabled:opacity-40 disabled:pointer-events-none"
          >
            Back
          </button>
          <button
            onClick={handleNext}
            className="flex-[2] py-4 font-bold text-white bg-primary-container rounded-xl hover:bg-primary shadow-lg shadow-primary-container/20 transition-all active:scale-95 min-h-[56px]"
          >
            {step === steps.length - 1 ? 'Finish' : 'Next'}
          </button>
        </div>
      </footer>

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-background/95 z-[100] flex flex-col items-center justify-center p-8">
          <div className="relative w-24 h-24">
            <div className="absolute inset-0 border-4 border-primary-fixed border-t-primary-container rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="material-symbols-outlined text-primary-container text-4xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                pregnant_woman
              </span>
            </div>
          </div>
          <h3 className="font-headline-md text-primary mt-8">Calculating your risk...</h3>
          <p className="text-on-surface-variant text-center max-w-xs mt-2">
            Mama, we are reviewing your profile to ensure you get the safest care possible.
          </p>
        </div>
      )}
    </div>
  );
};

export default IntakeQuestionnaire;
