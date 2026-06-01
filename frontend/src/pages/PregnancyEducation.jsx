import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEducationModules } from '../lib/api';

const TYPE_STYLE = {
  video:   { icon: 'play_circle',  bg: 'bg-primary-fixed-dim', color: 'text-primary-container', border: 'border-tertiary-fixed' },
  audio:   { icon: 'music_note',   bg: 'bg-tertiary-fixed',    color: 'text-primary-container', border: 'border-primary/20' },
  article: { icon: 'description',  bg: 'bg-surface-container', color: 'text-on-surface-variant', border: 'border-transparent' },
};

const getTypeStyle = type => TYPE_STYLE[(type || '').toLowerCase()] || TYPE_STYLE.article;

const STATIC_MODULES = [
  { id: 'baby-growth',        type: 'video',   title: "Understanding Baby's Growth",    description: "Week 12 · 8 min · Your baby is now the size of a lime.", completed: true,  recommended: true },
  { id: 'mindful-breathing',  type: 'audio',   title: 'Mindful Breathing for Relief',  description: 'Simple exercises for managing morning sickness.',         completed: true,  recommended: false },
  { id: 'nutrition-iron-zinc',type: 'article', title: 'Nutrition Essentials: Iron & Zinc', description: 'Best local foods to boost your energy levels.',        completed: false, recommended: false },
  { id: 'first-scan',         type: 'video',   title: 'First Scan: What to Expect',    description: 'A guide to your first ultrasound at UBTH.',               completed: false, recommended: false },
];

const PregnancyEducation = () => {
  const navigate = useNavigate();
  const [modules, setModules] = useState([]);
  const [modulesLoading, setModulesLoading] = useState(true);

  useEffect(() => {
    getEducationModules()
      .then(r => {
        const data = Array.isArray(r.data) ? r.data : r.data?.modules || [];
        if (data.length > 0) setModules(data);
      })
      .catch(() => {})
      .finally(() => setModulesLoading(false));
  }, []);

  const displayModules = modules.length > 0 ? modules : STATIC_MODULES;

  return (
    <div className="font-body-md text-on-surface min-h-screen">
      {/* Grain overlay */}
      <div className="grain-overlay"></div>

      {/* MAIN CONTAINER (Max-width 640px for mobile-first editorial feel) */}
      <main className="max-w-[640px] mx-auto min-h-screen bg-surface-container-low relative flex flex-col">
        {/* TOP APP BAR */}
        <header className="bg-primary text-on-primary sticky top-0 z-50 px-6 py-4 flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-primary-container transition-colors">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="font-headline-md text-headline-md">Pregnancy Education</h1>
          <div className="ml-auto">
            <span className="material-symbols-outlined text-on-primary-container">pregnant_woman</span>
          </div>
        </header>

        {/* VIEW A: MODULE LIST */}
        <section className="flex-1 flex flex-col gap-6 pb-24">
          {/* HERO STRIP */}
          <div className="bg-tertiary-fixed px-6 py-8 flex items-center justify-between">
            <div className="space-y-1">
              <span className="font-label-sm text-label-sm text-primary uppercase tracking-widest">
                Ongoing Learning
              </span>
              <h2 className="font-headline-lg text-headline-lg text-primary">
                Learning for Week 12
              </h2>
            </div>
            {/* Circular Progress Ring */}
            <div className="relative w-16 h-16 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90">
                <circle
                  className="text-tertiary-fixed-dim"
                  cx="32"
                  cy="32"
                  fill="transparent"
                  r="28"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <circle
                  className="text-primary"
                  cx="32"
                  cy="32"
                  fill="transparent"
                  r="28"
                  stroke="currentColor"
                  strokeDasharray="176"
                  strokeDashoffset="140"
                  strokeWidth="4"
                />
              </svg>
              <span className="absolute text-[10px] font-bold text-primary">3 / 15</span>
            </div>
          </div>

          {/* FILTER TABS & DOWNLOAD */}
          <div className="px-6 space-y-4">
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              <button className="bg-primary text-on-primary px-5 py-2 rounded-full font-label-sm whitespace-nowrap">
                All
              </button>
              <button className="bg-surface text-on-surface-variant border border-outline-variant px-5 py-2 rounded-full font-label-sm whitespace-nowrap hover:bg-surface-container-high transition-colors">
                Videos
              </button>
              <button className="bg-surface text-on-surface-variant border border-outline-variant px-5 py-2 rounded-full font-label-sm whitespace-nowrap hover:bg-surface-container-high transition-colors">
                Audio
              </button>
              <button className="bg-surface text-on-surface-variant border border-outline-variant px-5 py-2 rounded-full font-label-sm whitespace-nowrap hover:bg-surface-container-high transition-colors">
                Articles
              </button>
              <button className="bg-surface text-on-surface-variant border border-outline-variant px-5 py-2 rounded-full font-label-sm whitespace-nowrap hover:bg-surface-container-high transition-colors">
                Completed
              </button>
            </div>
            <button className="w-full border border-primary text-primary font-label-sm py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-primary/5 transition-colors">
              <span className="material-symbols-outlined text-[18px]">download</span>
              Download all for offline use
            </button>
          </div>

          {/* MODULE CARDS */}
          <div className="px-6 space-y-4">
            {modulesLoading && (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {!modulesLoading && displayModules.map((mod, idx) => {
              const ts = getTypeStyle(mod.type || mod.content_type);
              const isRecommended = mod.recommended || mod.is_recommended || mod.is_pinned || idx === 0;
              const isCompleted = mod.completed || mod.is_completed;
              const typeLabel = (mod.type || mod.content_type || 'Article');
              const duration = mod.duration || mod.estimated_duration || '';
              const description = mod.description || mod.subtitle || '';
              return (
                <div
                  key={mod.id}
                  onClick={() => navigate(`/education/${mod.id}`)}
                  className={`bg-surface-container-lowest rounded-[10px] organic-shadow overflow-hidden flex border-l-4 ${ts.border} relative group cursor-pointer`}
                >
                  <div className="p-4 flex gap-4 w-full">
                    <div className={`w-16 h-16 ${ts.bg} rounded-lg flex items-center justify-center ${ts.color} shrink-0`}>
                      <span className="material-symbols-outlined text-3xl">{ts.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {isRecommended && (
                          <span className="bg-tertiary-fixed text-primary px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tighter">
                            Recommended
                          </span>
                        )}
                        <span className="text-on-surface-variant font-label-sm text-[10px] capitalize">
                          {isRecommended ? '• ' : ''}{typeLabel}{duration ? ` · ${duration}` : ''}
                        </span>
                      </div>
                      <h3 className="font-bold text-body-lg text-on-surface truncate">{mod.title}</h3>
                      {description && (
                        <p className="text-on-surface-variant text-sm truncate">{description}</p>
                      )}
                    </div>
                    <div className="flex items-center justify-center shrink-0 w-8">
                      {isCompleted ? (
                        <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>
                          check_circle
                        </span>
                      ) : (
                        <span className="material-symbols-outlined text-outline-variant">circle</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* VIEW B: MODULE DETAIL (HIDDEN - VISUALIZED FOR DESIGN) */}
        {/* To show this, toggle visibility in your state management */}
        <section className="hidden flex-1 flex-col bg-surface-container-low pb-32">
          {/* VIDEO PLAYER AREA */}
          <div className="relative aspect-video bg-black overflow-hidden shadow-xl">
            <img
              className="w-full h-full object-cover opacity-80"
              alt="Doctor consulting with expectant mother"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDnO9mQYTJZPvW7zvEaUktuRZNRugHO_JTI7ce7J1MC36YZepQCI6GMeSK7I3Os2XeCWZ09vAfuLjH4eKKPIV97zJk-Z__Gx0z-HTlaehc4npM7BJAsqoI4LcBH-qApRw76h3PTqbI5wGk3P1zJkKawGFrvgIfEzItsaKWoJfMnx2rGAzx_6hLH9yeHrZ-dp7E4dk5BFpsxD_BZBqAD-V7mkcOn_ILyStfJUmTKKhPdvgeRSpbzhPWlCim92PNHI5k5hjTUCdKNKNo"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <button className="w-20 h-20 bg-primary/90 text-on-primary rounded-full flex items-center justify-center organic-shadow transition-transform hover:scale-105 active:scale-95">
                <span
                  className="material-symbols-outlined text-5xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  play_arrow
                </span>
              </button>
            </div>
            <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center text-white text-xs font-bold">
              <span>02:45 / 08:12</span>
              <span className="material-symbols-outlined cursor-pointer">closed_caption</span>
            </div>
          </div>

          {/* CONTENT BODY */}
          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-secondary bg-secondary-fixed px-3 py-1 rounded-full">
                  Week 12 • Development
                </span>
                <span className="material-symbols-outlined text-primary cursor-pointer">download</span>
              </div>
              <h2 className="font-headline-lg text-headline-lg text-primary leading-tight">
                Understanding Your Baby's Rapid Growth
              </h2>
              <p className="text-body-lg text-on-surface-variant">
                In this module, we explore the incredible changes happening during your 12th week.
                Your baby is now fully formed, with tiny fingernails and developing reflexes.
              </p>
            </div>

            <div className="bg-surface-container-high rounded-[10px] p-6 space-y-4">
              <h3 className="font-bold text-primary font-label-sm uppercase tracking-widest border-b border-primary/10 pb-2">
                Key Takeaways
              </h3>
              <ul className="space-y-3">
                <li className="flex gap-3 items-start">
                  <span className="material-symbols-outlined text-secondary mt-0.5">check_circle</span>
                  <span className="text-body-md">
                    The placenta is now fully functional and providing oxygen.
                  </span>
                </li>
                <li className="flex gap-3 items-start">
                  <span className="material-symbols-outlined text-secondary mt-0.5">check_circle</span>
                  <span className="text-body-md">
                    Kidneys have begun to produce urine which fills the bladder.
                  </span>
                </li>
                <li className="flex gap-3 items-start">
                  <span className="material-symbols-outlined text-secondary mt-0.5">check_circle</span>
                  <span className="text-body-md">
                    Vital organs like the brain and lungs are maturing rapidly.
                  </span>
                </li>
              </ul>
            </div>

            {/* RELATED MODULES */}
            <div className="space-y-4">
              <h3 className="font-headline-md text-primary">Up Next</h3>
              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-center gap-3 p-3 bg-surface-container-lowest rounded-lg organic-shadow">
                  <div className="w-12 h-12 bg-tertiary-fixed rounded flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-primary">music_note</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-on-surface text-sm">Managing Fatigue</p>
                    <p className="text-xs text-on-surface-variant">Audio • 10 min</p>
                  </div>
                  <span className="material-symbols-outlined text-outline-variant">chevron_right</span>
                </div>
              </div>
            </div>
          </div>

          {/* COMPLETION ACTION (SLIDE-UP BANNER) */}
          <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[640px] bg-primary text-on-primary p-6 rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.15)] flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-headline-md">Module Complete!</p>
                <p className="text-on-primary-container text-sm opacity-90">
                  You've unlocked +10 Mama Points
                </p>
              </div>
              <span className="material-symbols-outlined text-4xl text-tertiary-fixed">celebration</span>
            </div>
            <div className="flex gap-3">
              <button className="flex-1 py-4 bg-tertiary-fixed text-primary font-bold rounded-xl hover:bg-tertiary-fixed-dim transition-colors">
                Mark as Done
              </button>
              <button className="flex-1 py-4 bg-primary-container text-on-primary-container border border-primary-fixed-dim/30 font-bold rounded-xl hover:bg-primary-container/80 transition-colors">
                Next Module
              </button>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="mt-auto bg-stone-50 border-t border-amber-900/10 px-8 py-12 flex flex-col items-center gap-6">
          <p className="font-headline-md text-primary text-xl font-bold">Mama Care AI</p>
          <p className="text-on-tertiary-fixed-variant text-sm text-center max-w-[280px]">
            Safe pregnancies, every time. Partnered with UBTH.
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-stone-500 hover:text-primary transition-colors">
              About
            </a>
            <a href="#" className="text-stone-500 hover:text-primary transition-colors">
              Privacy
            </a>
            <a href="#" className="text-stone-500 hover:text-primary transition-colors">
              Help
            </a>
          </div>
          <p className="text-[10px] text-stone-400 uppercase tracking-widest mt-4">
            © 2024 Mama Care AI. Benin City, Nigeria.
          </p>
        </footer>
      </main>

      {/* FLOATING ACTION BUTTON */}
      <button className="fixed bottom-8 right-8 md:right-[calc(50%-280px)] w-14 h-14 bg-secondary text-on-secondary rounded-full flex items-center justify-center organic-shadow group">
        <span className="material-symbols-outlined text-3xl group-hover:rotate-12 transition-transform">
          chat_bubble
        </span>
      </button>
    </div>
  );
};

export default PregnancyEducation;