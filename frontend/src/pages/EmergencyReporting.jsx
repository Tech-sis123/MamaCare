import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const EmergencyReporting = () => {
  const navigate = useNavigate();
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [isEmergencyActive, setIsEmergencyActive] = useState(false);
  const [timer, setTimer] = useState(54); // seconds

  const symptomsList = [
    { id: 'headache', emoji: '😫', title: 'Severe Headache', description: 'Dizziness or blurred vision', risk: 'high' },
    { id: 'bleeding', emoji: '🩸', title: 'Vaginal Bleeding', description: 'Any amount of blood loss', risk: 'high' },
    { id: 'swelling', emoji: '🦶', title: 'Swollen Hands/Face', description: 'Sudden puffiness', risk: 'medium' },
    { id: 'pain', emoji: '⚡', title: 'Abdominal Pain', description: 'Sharp or constant cramps', risk: 'high' },
    { id: 'fever', emoji: '🤒', title: 'High Fever', description: 'Chills or excessive heat', risk: 'medium' },
    { id: 'movement', emoji: '👶', title: 'Reduced Movement', description: 'Baby moving less than usual', risk: 'high' },
  ];

  const toggleSymptom = (symptomId) => {
    if (selectedSymptoms.includes(symptomId)) {
      setSelectedSymptoms(selectedSymptoms.filter(id => id !== symptomId));
    } else {
      setSelectedSymptoms([...selectedSymptoms, symptomId]);
    }
  };

  const handleSendAlert = () => {
    setIsEmergencyActive(true);
    // Start countdown timer
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleCancelAlert = () => {
    setIsEmergencyActive(false);
    setTimer(54);
    setSelectedSymptoms([]);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="font-body-md text-on-surface">
      {/* Grain overlay */}
      <div className="grain-overlay"></div>

      {/* Top Navigation Shell */}
      <header className="bg-stone-50/80 backdrop-blur-md border-b border-emerald-900/5 sticky top-0 z-50">
        <nav className="flex justify-between items-center w-full px-6 py-4 max-w-7xl mx-auto">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-2xl font-serif font-bold text-emerald-900 hover:opacity-80 transition-opacity">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            <span className="material-symbols-outlined">eco</span>
            Mama Care AI
          </button>
          <div className="hidden md:flex gap-8 items-center">
            <a href="#" className="font-serif text-lg font-medium text-stone-600 hover:text-emerald-800 transition-all duration-300">
              How it works
            </a>
            <a href="#" className="font-serif text-lg font-medium text-stone-600 hover:text-emerald-800 transition-all duration-300">
              For Providers
            </a>
            <a href="#" className="font-serif text-lg font-medium text-stone-600 hover:text-emerald-800 transition-all duration-300">
              About
            </a>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-serif text-lg font-medium text-emerald-900">EN | Pidgin</span>
            <button className="bg-primary text-on-primary px-6 py-2 rounded-lg font-bold hover:opacity-80 active:scale-95 transition-all">
              Get Started
            </button>
          </div>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12 md:py-16">
        {/* State A: Symptom Selection */}
        {!isEmergencyActive && (
          <section>
            <div className="mb-12">
              <h1 className="font-headline-lg text-display-xl text-primary mb-4">Danger Sign Reporting</h1>
              <p className="font-body-lg text-on-surface-variant max-w-2xl">
                If you feel unwell, please select any symptoms you are experiencing. This alert goes directly to UBTH medical staff.
              </p>
            </div>

            {/* Dynamic Urgency Banner */}
            {selectedSymptoms.length > 0 && (
              <div className="bg-secondary-container text-on-secondary-container p-6 rounded-xl mb-12 shadow-sm border border-secondary/20 flex items-center gap-4">
                <span className="material-symbols-outlined text-3xl">warning</span>
                <div>
                  <h2 className="font-headline-md text-headline-md">Multiple Symptoms Detected</h2>
                  <p className="font-body-md">
                    Your urgency level is rising. Please finish selecting signs so we can notify help.
                  </p>
                </div>
              </div>
            )}

            {/* 3-Column Symptom Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-32">
              {symptomsList.map((symptom) => (
                <button
                  key={symptom.id}
                  onClick={() => toggleSymptom(symptom.id)}
                  className={`bg-white p-8 rounded-[10px] text-left border-2 transition-all group flex flex-col items-center justify-center text-center gap-4 shadow-[0_2px_16px_rgba(27,94,59,0.08)] min-h-[200px] ${
                    selectedSymptoms.includes(symptom.id)
                      ? 'border-secondary bg-secondary/5'
                      : 'border-transparent hover:border-primary'
                  }`}
                >
                  <span className="text-6xl group-hover:scale-110 transition-transform">{symptom.emoji}</span>
                  <div>
                    <h3
                      className={`font-headline-md text-headline-md ${
                        selectedSymptoms.includes(symptom.id) ? 'text-secondary' : 'text-primary'
                      }`}
                    >
                      {symptom.title}
                    </h3>
                    <p className="font-label-sm text-on-surface-variant mt-2">{symptom.description}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Sticky CTA Area */}
            <div className="fixed bottom-8 left-0 right-0 px-6 max-w-7xl mx-auto z-40">
              <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl shadow-xl border border-primary-container/10 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center text-white">
                    <span className="material-symbols-outlined">emergency</span>
                  </div>
                  <p className="font-headline-md text-headline-md text-on-surface">
                    {selectedSymptoms.length} Symptom{selectedSymptoms.length !== 1 ? 's' : ''} Selected
                  </p>
                </div>
                <button
                  onClick={handleSendAlert}
                  disabled={selectedSymptoms.length === 0}
                  className={`w-full md:w-auto px-12 py-5 rounded-xl font-bold text-lg active:scale-95 transition-all shadow-lg flex items-center justify-center gap-3 ${
                    selectedSymptoms.length > 0
                      ? 'bg-secondary hover:bg-on-secondary-fixed-variant text-white'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Send High Urgency Alert
                  <span className="material-symbols-outlined">arrow_forward</span>
                </button>
              </div>
            </div>
          </section>
        )}

        {/* State B: Emergency Active */}
        {isEmergencyActive && (
          <section className="fixed inset-0 z-[100] bg-secondary flex flex-col items-center justify-center text-white p-6 overflow-hidden">
            <div className="max-w-md w-full text-center">
              {/* Pulsing Radar Icon */}
              <div className="radar-pulse w-32 h-32 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-12">
                <span
                  className="material-symbols-outlined text-6xl text-white"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  emergency_share
                </span>
              </div>
              <h2 className="font-headline-lg text-display-xl mb-4">Emergency Alert Active</h2>
              <p className="font-body-lg mb-12 opacity-90">
                Your location and health data have been sent to UBTH Emergency Care. A nurse is reviewing your case now.
              </p>

              {/* Countdown Timer */}
              <div className="mb-16">
                <div className="text-8xl font-serif font-bold mb-2">{formatTime(timer)}</div>
                <p className="font-label-sm tracking-widest uppercase opacity-75">Estimated Response Time</p>
              </div>

              {/* Immediate Action Button */}
              <div className="flex flex-col gap-4">
                <a
                  href="tel:+234000000000"
                  className="bg-white text-secondary w-full py-6 rounded-2xl font-bold text-2xl shadow-2xl flex items-center justify-center gap-4 active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-3xl">call</span>
                  Call UBTH Emergency
                </a>
                <button
                  onClick={handleCancelAlert}
                  className="bg-white/10 hover:bg-white/20 text-white w-full py-4 rounded-xl font-medium transition-all"
                >
                  I am safe / Cancel Alert
                </button>
              </div>
            </div>

            {/* Background Aesthetic Images (Subtle) */}
            <div className="absolute bottom-0 left-0 w-full opacity-10 pointer-events-none">
              <img
                alt="Decorative medical network pattern"
                className="w-full h-64 object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCV95c1lgXF1zOZTYfWi1fqdOS6sxI08uTK3O9q7gSpkP0UmyZEwNTVjSHq6Qn_CJ1ZhtuWnDv9rhGTYfIMJqrhCW0MO8W3f_5M9IWsgg8RFzQ5-hcEXnFwL_TCIyiQK6cZ6Up6NdvqS_CJwI8TqmfiF7QrV2BfKjqkrkccLH6pnQ8Cq_eux3xKiXa_kFC9PrCfUAbvgKIKT2UU6o1jBEUYn8WbZ0l6zXFvWQWsi49WM2x5dI7PJ67IZUBu7m3e64UgrY7jdqotj2E"
              />
            </div>
          </section>
        )}
      </main>

      {/* Trust Section (only show when not in emergency mode) */}
      {!isEmergencyActive && (
        <section className="max-w-7xl mx-auto px-6 py-24">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div>
              <span className="font-label-sm text-secondary tracking-[0.2em] uppercase mb-4 block">
                Institutional Trust
              </span>
              <h2 className="font-headline-lg text-headline-lg text-primary mb-6">
                Partnered with University of Benin Teaching Hospital (UBTH)
              </h2>
              <p className="font-body-lg text-on-surface-variant mb-8">
                Every alert sent through Mama Care AI is routed directly to the obstetrics triage team.
                We ensure that your data is shared securely and that medical professionals have the context
                they need to provide immediate life-saving care.
              </p>
              <div className="flex gap-4">
                <div className="bg-sage p-4 rounded-lg bg-tertiary-fixed flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary">verified_user</span>
                  <span className="font-label-sm text-primary">Certified Protocol</span>
                </div>
                <div className="bg-sage p-4 rounded-lg bg-tertiary-fixed flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary">speed</span>
                  <span className="font-label-sm text-primary">Fast Triage</span>
                </div>
              </div>
            </div>
            <div className="relative">
              <img
                className="rounded-2xl shadow-xl w-full h-[400px] object-cover"
                alt="UBTH hospital entrance"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuD8wNJW-kuJ0PKFUWyTF4bi55BYUE9isEYXeH75Pbdqa7FgS0ks685Oqus3r901Uqvnsd65bEILb8uBZugXJkLtqi7L3PhHewfSamTH2Jj8pMMv0Rp_hljtaVz9GzVAddDVX5iYtB99AlWi-Ug9kEPJDUS5o1NYVAlzx85TFHlSU_rFsMtL-P8AL3OCYyPS_Kt8INuu514R5ESPLSe9TJnH5o1VIZEeYdbhIpG1OGBRn-iCgjQ0aH4LgQ9-jB7AW4bf3oK0UlbeFeg"
              />
              <div className="absolute -bottom-6 -left-6 bg-primary text-white p-6 rounded-xl shadow-lg max-w-[240px]">
                <p className="font-headline-md text-headline-md leading-tight italic">
                  "Response times improved by 40% using Mama Care AI triage."
                </p>
                <p className="mt-4 font-label-sm opacity-80">— Dr. Osa, UBTH Obstetrics</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Footer Shell */}
      <footer className="bg-stone-50 border-t border-emerald-900/10 w-full mt-24">
        <div className="flex flex-col md:flex-row justify-between items-center w-full px-8 py-16 max-w-7xl mx-auto gap-8">
          <div className="text-xl font-serif font-bold text-emerald-900">Mama Care AI</div>
          <div className="flex flex-wrap justify-center gap-6">
            <a href="#" className="font-serif text-sm tracking-wide text-stone-500 hover:text-emerald-700 underline underline-offset-4">
              How it works
            </a>
            <a href="#" className="font-serif text-sm tracking-wide text-stone-500 hover:text-emerald-700 underline underline-offset-4">
              For Providers
            </a>
            <a href="#" className="font-serif text-sm tracking-wide text-stone-500 hover:text-emerald-700 underline underline-offset-4">
              About
            </a>
            <a href="#" className="font-serif text-sm tracking-wide text-stone-500 hover:text-emerald-700 underline underline-offset-4">
              Privacy Policy
            </a>
            <a href="#" className="font-serif text-sm tracking-wide text-stone-500 hover:text-emerald-700 underline underline-offset-4">
              Terms
            </a>
          </div>
          <div className="font-serif text-sm tracking-wide text-emerald-900 text-center md:text-right">
            © 2024 Mama Care AI. Safe pregnancies, every time. Partnered with UBTH.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default EmergencyReporting;