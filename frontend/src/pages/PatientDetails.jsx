import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const PatientDetailPanel = () => {
  const navigate = useNavigate();
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [openDetails, setOpenDetails] = useState({
    personal: false,
    pregnancy: true,
    vitals: false,
  });

  const toggleDetails = (key) => {
    setOpenDetails((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="bg-background text-on-surface font-body-md min-h-screen flex justify-end overflow-hidden">
      {/* Grain overlay */}
      <div className="grain-overlay"></div>

      {/* Background Content Simulation */}
      <main className="hidden md:flex flex-col flex-1 p-12 opacity-30 grayscale pointer-events-none">
        <header className="flex justify-between items-center mb-12">
          <h1 className="font-display-xl text-display-xl">Provider Dashboard</h1>
          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-full bg-surface-container"></div>
            <div className="w-12 h-12 rounded-full bg-surface-container"></div>
          </div>
        </header>
        <div className="grid grid-cols-3 gap-8">
          <div className="h-64 rounded-xl bg-surface-container"></div>
          <div className="h-64 rounded-xl bg-surface-container"></div>
          <div className="h-64 rounded-xl bg-surface-container"></div>
        </div>
      </main>

      {/* Side Detail Panel */}
      <aside className="w-full md:w-[480px] bg-surface h-screen shadow-2xl flex flex-col relative z-50 border-l border-outline-variant">
        {/* HEADER */}
        <header className="bg-[#1A1A18] text-white p-6 shrink-0">
          <div className="flex justify-between items-start mb-4">
            <button onClick={() => navigate('/provider')} className="text-white/60 hover:text-white transition-colors">
              <span className="material-symbols-outlined">close</span>
            </button>
            <div className="bg-secondary text-white px-3 py-1 rounded-full font-label-sm flex items-center gap-1">
              <span
                className="material-symbols-outlined text-[14px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                error
              </span>
              HIGH RISK
            </div>
          </div>
          <h2 className="font-headline-lg text-headline-lg mb-1">Ngozi Okonkwo</h2>
          <p className="font-body-md text-white/70">Age 29 • 14 Weeks Pregnant (Trimester 2)</p>
          <div className="mt-4 flex gap-4 text-white/50 font-label-sm border-t border-white/10 pt-4">
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">location_on</span>
              Benin City, Edo
            </div>
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">calendar_month</span>
              EDD: May 12, 2025
            </div>
          </div>
        </header>

        {/* SCROLLABLE CONTENT */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
          {/* PRE-CONSULT SUMMARY */}
          <section>
            <h3 className="font-label-sm text-on-surface-variant uppercase tracking-widest mb-3">
              AI Pre-Consult Summary
            </h3>
            <div className="bg-surface-container-low border-l-4 border-primary p-4 rounded-r-lg shadow-sm">
              <p className="font-body-md text-primary-container leading-relaxed">
                Patient presents with <strong className="text-secondary">active spotting</strong> and a
                critically high BP of <strong className="text-secondary">160/100 mmHg</strong>.
                Historical data indicates a previous C-section in 2021. AI risk model suggests
                immediate pre-eclampsia screening and placental positioning check due to reported
                abdominal discomfort.
              </p>
            </div>
          </section>

          {/* CLINICAL FLAGS GRID */}
          <section>
            <h3 className="font-label-sm text-on-surface-variant uppercase tracking-widest mb-3">
              Clinical Flags
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 p-3 bg-secondary-fixed rounded-lg border border-secondary/20">
                <span
                  className="material-symbols-outlined text-secondary"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  blood_pressure
                </span>
                <span className="font-label-sm text-on-secondary-fixed-variant">Hypertension</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-secondary-fixed rounded-lg border border-secondary/20">
                <span
                  className="material-symbols-outlined text-secondary"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  vital_signs
                </span>
                <span className="font-label-sm text-on-secondary-fixed-variant">Bleeding</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-tertiary-fixed rounded-lg border border-tertiary/20">
                <span className="material-symbols-outlined text-primary">monitor_weight</span>
                <span className="font-label-sm text-on-tertiary-fixed-variant">Normal BMI</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-tertiary-fixed rounded-lg border border-tertiary/20">
                <span className="material-symbols-outlined text-primary">vaccines</span>
                <span className="font-label-sm text-on-tertiary-fixed-variant">
                  Tetanus Up-to-date
                </span>
              </div>
            </div>
          </section>

          {/* INTAKE DATA ACCORDION */}
          <section className="space-y-2">
            <h3 className="font-label-sm text-on-surface-variant uppercase tracking-widest mb-3">
              Clinical Intake Data
            </h3>

            {/* Personal Info */}
            <details
              className="group bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden"
              open={openDetails.personal}
            >
              <summary
                onClick={() => toggleDetails('personal')}
                className="flex justify-between items-center p-4 cursor-pointer hover:bg-surface-container-low transition-colors"
              >
                <span className="font-label-sm">PERSONAL INFORMATION</span>
                <span
                  className={`material-symbols-outlined transition-transform ${
                    openDetails.personal ? 'rotate-180' : ''
                  }`}
                >
                  expand_more
                </span>
              </summary>
              <div className="p-4 pt-0 text-sm grid grid-cols-2 gap-4 border-t border-outline-variant/30">
                <div>
                  <p className="text-on-surface-variant font-label-sm">Blood Type</p>
                  <p className="font-medium">O Positive</p>
                </div>
                <div>
                  <p className="text-on-surface-variant font-label-sm">Genotype</p>
                  <p className="font-medium">AA</p>
                </div>
              </div>
            </details>

            {/* Pregnancy Details (Expanded) */}
            <details
              className="group bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden"
              open={openDetails.pregnancy}
            >
              <summary
                onClick={() => toggleDetails('pregnancy')}
                className="flex justify-between items-center p-4 cursor-pointer hover:bg-surface-container-low transition-colors"
              >
                <span className="font-label-sm">PREGNANCY DETAILS</span>
                <span
                  className={`material-symbols-outlined transition-transform ${
                    openDetails.pregnancy ? 'rotate-180' : ''
                  }`}
                >
                  expand_more
                </span>
              </summary>
              <div className="p-4 pt-0 space-y-4 border-t border-outline-variant/30 mt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-on-surface-variant font-label-sm">LMP</p>
                    <p className="font-medium">Aug 05, 2024</p>
                  </div>
                  <div>
                    <p className="text-on-surface-variant font-label-sm">Gestation</p>
                    <p className="font-medium">14w 2d</p>
                  </div>
                  <div className="col-span-2 p-3 bg-error-container rounded-lg border border-error/10">
                    <p className="text-on-error-container font-label-sm mb-1">
                      Obstetric History
                    </p>
                    <p className="text-on-error-container font-medium">
                      G2 P1+0, Previous C-Section (2021)
                    </p>
                  </div>
                </div>
              </div>
            </details>

            {/* Vitals/Labs */}
            <details
              className="group bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden"
              open={openDetails.vitals}
            >
              <summary
                onClick={() => toggleDetails('vitals')}
                className="flex justify-between items-center p-4 cursor-pointer hover:bg-surface-container-low transition-colors"
              >
                <span className="font-label-sm">VITALS &amp; LABORATORIES</span>
                <span
                  className={`material-symbols-outlined transition-transform ${
                    openDetails.vitals ? 'rotate-180' : ''
                  }`}
                >
                  expand_more
                </span>
              </summary>
              <div className="p-4 pt-0 space-y-3 border-t border-outline-variant/30 mt-2">
                <div className="flex justify-between items-center py-2 border-b border-outline-variant/10">
                  <span className="font-body-md">Blood Pressure</span>
                  <span className="font-headline-md text-secondary">160/100</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-outline-variant/10">
                  <span className="font-body-md">Heart Rate</span>
                  <span className="font-headline-md text-primary">88 bpm</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="font-body-md">Urinalysis</span>
                  <span className="font-label-sm bg-secondary-fixed text-on-secondary-fixed px-2 py-1 rounded">
                    Protein ++
                  </span>
                </div>
              </div>
            </details>
          </section>

          {/* APPOINTMENT HISTORY */}
          <section>
            <h3 className="font-label-sm text-on-surface-variant uppercase tracking-widest mb-3">
              Appointment History
            </h3>
            <div className="relative pl-8 space-y-8 before:content-[''] before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-outline-variant">
              <div className="relative">
                <div className="absolute -left-8 top-1 w-6 h-6 rounded-full bg-secondary ring-4 ring-white flex items-center justify-center">
                  <span className="material-symbols-outlined text-[14px] text-white">
                    medical_services
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="font-label-sm text-secondary">TODAY - CURRENT</span>
                  <p className="font-body-md font-medium">Emergency Consult</p>
                  <p className="text-sm text-on-surface-variant">Attending: Dr. Emeka A.</p>
                </div>
              </div>
              <div className="relative opacity-60">
                <div className="absolute -left-8 top-1 w-6 h-6 rounded-full bg-primary ring-4 ring-white flex items-center justify-center">
                  <span className="material-symbols-outlined text-[14px] text-white">check</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-label-sm text-on-surface-variant">NOV 14, 2024</span>
                  <p className="font-body-md font-medium">Routine Antenatal Care</p>
                  <p className="text-sm text-on-surface-variant">Stable Vitals, UBTH Branch</p>
                </div>
              </div>
            </div>
          </section>

          {/* PROVIDER NOTES */}
          <section>
            <h3 className="font-label-sm text-on-surface-variant uppercase tracking-widest mb-3">
              Clinical Consultation Notes
            </h3>
            <div className="relative">
              <textarea
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                className="w-full h-40 bg-surface-container-low border border-outline rounded-lg p-4 font-body-md focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-outline/60"
                placeholder="Start typing clinical notes... (Auto-saving)"
              />
              <div className="absolute bottom-3 right-3 flex items-center gap-1 text-[10px] text-primary uppercase font-bold tracking-tighter opacity-50">
                <span className="material-symbols-outlined text-[12px]">sync</span>
                SAVED
              </div>
            </div>
          </section>
        </div>

        {/* ACTION FOOTER */}
        <footer className="p-6 bg-surface border-t border-outline-variant grid grid-cols-2 gap-4 shrink-0">
          <button className="col-span-2 bg-secondary text-white py-4 rounded-lg font-label-sm hover:brightness-95 transition-all flex items-center justify-center gap-2">
            <span className="material-symbols-outlined">emergency_share</span>
            ESCALATE TO EMERGENCY
          </button>
          <button className="bg-surface-container-high text-on-surface py-3 rounded-lg font-label-sm hover:bg-surface-container-highest transition-all border border-outline/20">
            Mark as seen
          </button>
          <button className="bg-primary text-white py-3 rounded-lg font-label-sm hover:bg-primary-container transition-all">
            Refer to specialist
          </button>
        </footer>
      </aside>

      {/* Visual Polish: Patient Image Floating Circle */}
      <div className="fixed top-12 right-[460px] w-24 h-24 rounded-full border-4 border-white shadow-xl z-50 overflow-hidden hidden lg:block">
        <img
          className="w-full h-full object-cover"
          alt="Ngozi Okonkwo portrait"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuCefaQ5WOQpWUFDp0Psq3ErVvhxRPfxrvPvNV3oY0j17_WAUMf1Kg3sJsLKVfMaRRvzQMjt-BMxvDUoWLAP-7elATW_SCvW23xUn1oLG877y5NX6Um0BP_JtzMNWAMyUWxrzWmLjA-7TLfRXwyyBPrCutvtJPaX2ZFu-SKxJ1asrlW4EAlq0dRad0FyTk457lxIwgFiR8RFt7bvD4mIxirO9MgErezmxPG6y0oblXErjDDnIWLSrsjWex7WhqOb2V0-Vi7tIrqMqLo"
        />
      </div>
    </div>
  );
};

export default PatientDetailPanel;