import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEducationModules, getPatientDashboard } from '../lib/api';

const TYPE_STYLE = {
  video:   { icon: 'play_circle',  bg: 'bg-primary-fixed-dim', color: 'text-primary-container', border: 'border-tertiary-fixed' },
  audio:   { icon: 'music_note',   bg: 'bg-tertiary-fixed',    color: 'text-primary-container', border: 'border-primary/20' },
  article: { icon: 'description',  bg: 'bg-surface-container', color: 'text-on-surface-variant', border: 'border-transparent' },
};

const getTypeStyle = (type) => TYPE_STYLE[(type || '').toLowerCase()] || TYPE_STYLE.article;

const getModuleType = (mod) => {
  if (mod.video_url || (mod.type && mod.type.toLowerCase() === 'video') || (mod.content_type && mod.content_type.toLowerCase() === 'video')) {
    return 'video';
  }
  if (mod.audio_url || (mod.type && mod.type.toLowerCase() === 'audio') || (mod.content_type && mod.content_type.toLowerCase() === 'audio')) {
    return 'audio';
  }
  return 'article';
};

const STATIC_FALLBACK_MODULES = [
  { id: 'baby-growth',        type: 'video',   week_number: 12, title: "Understanding Baby's Growth",    summary: "Week 12 · 8 min · Your baby is now the size of a lime.", completed: true,  recommended: true },
  { id: 'mindful-breathing',  type: 'audio',   week_number: 12, title: 'Mindful Breathing for Relief',  summary: 'Simple exercises for managing morning sickness.',         completed: false, recommended: false },
  { id: 'nutrition-iron-zinc',type: 'article', week_number: 12, title: 'Nutrition Essentials: Iron & Zinc', summary: 'Best local foods to boost your energy levels.',        completed: false, recommended: false },
  { id: 'first-scan',         type: 'video',   week_number: 12, title: 'First Scan: What to Expect',    summary: 'A guide to your first ultrasound.',               completed: false, recommended: false },
];

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'video', label: 'Videos' },
  { id: 'audio', label: 'Audio' },
  { id: 'article', label: 'Articles' },
  { id: 'completed', label: 'Completed' },
];

const PregnancyEducation = () => {
  const navigate = useNavigate();
  const [modules, setModules] = useState([]);
  const [modulesLoading, setModulesLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(null);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    // 1. Fetch education modules and patient's week from the education endpoint
    getEducationModules()
      .then((r) => {
        const data = Array.isArray(r.data) ? r.data : r.data?.modules || [];
        if (data.length > 0) {
          setModules(data);
        }
        if (r.data?.patient?.current_ega_weeks != null) {
          setCurrentWeek(r.data.patient.current_ega_weeks);
        }
      })
      .catch(() => {})
      .finally(() => setModulesLoading(false));

    // 2. Fetch patient dashboard to ensure we have the exact gestational age
    getPatientDashboard()
      .then((r) => {
        const weeks = r.data?.current_ega?.weeks;
        if (weeks != null && !Number.isNaN(Number(weeks))) {
          setCurrentWeek(Number(weeks));
        }
      })
      .catch(() => {});
  }, []);

  const allModules = modules.length > 0 ? modules : STATIC_FALLBACK_MODULES;

  // Counts for tabs
  const videoCount = allModules.filter((m) => getModuleType(m) === 'video').length;
  const audioCount = allModules.filter((m) => getModuleType(m) === 'audio').length;
  const articleCount = allModules.filter((m) => getModuleType(m) === 'article').length;
  const completedCount = allModules.filter((m) => m.is_completed || m.completed).length;
  const totalCount = allModules.length;

  const tabCounts = {
    all: totalCount,
    video: videoCount,
    audio: audioCount,
    article: articleCount,
    completed: completedCount,
  };

  // Filter modules based on selected tab
  const filteredModules = allModules.filter((m) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'video') return getModuleType(m) === 'video';
    if (activeTab === 'audio') return getModuleType(m) === 'audio';
    if (activeTab === 'article') return getModuleType(m) === 'article';
    if (activeTab === 'completed') return m.is_completed || m.completed;
    return true;
  });

  // Calculate progress ring percentage
  const percentCompleted = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const circleCircumference = 176;
  const strokeDashoffset = circleCircumference - (circleCircumference * percentCompleted) / 100;

  return (
    <div className="font-body-md text-on-surface min-h-screen">
      {/* Grain overlay */}
      <div className="grain-overlay" />

      {/* MAIN CONTAINER (Max-width 640px for mobile-first editorial feel) */}
      <main className="max-w-[640px] mx-auto min-h-screen bg-surface-container-low relative flex flex-col">
        {/* TOP APP BAR */}
        <header className="bg-primary text-on-primary sticky top-0 z-50 px-6 py-4 flex items-center gap-4 shadow-sm">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-primary-container transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="font-headline-md text-headline-md">Pregnancy Education</h1>
          <div className="ml-auto">
            <span className="material-symbols-outlined text-on-primary-container">pregnant_woman</span>
          </div>
        </header>

        {/* VIEW: MODULE LIST */}
        <section className="flex-1 flex flex-col gap-6 pb-32">
          {/* HERO STRIP — DYNAMICALLY TIED TO PATIENT'S WEEK */}
          <div className="bg-tertiary-fixed px-6 py-8 flex items-center justify-between shadow-xs">
            <div className="space-y-1">
              <span className="font-label-sm text-label-sm text-primary uppercase tracking-widest font-semibold">
                {currentWeek ? `Trimester ${currentWeek <= 12 ? '1' : currentWeek <= 27 ? '2' : '3'} • Ongoing Learning` : 'Ongoing Learning'}
              </span>
              <h2 className="font-headline-lg text-headline-lg text-primary font-bold">
                {currentWeek ? `Learning for Week ${currentWeek}` : 'Learning for Your Pregnancy'}
              </h2>
              <p className="text-primary/80 text-xs font-medium">
                {completedCount > 0
                  ? `${completedCount} of ${totalCount} lessons completed`
                  : 'Start your weekly maternal lessons'}
              </p>
            </div>

            {/* Circular Progress Ring */}
            <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
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
                  className="text-primary transition-all duration-700 ease-out"
                  cx="32"
                  cy="32"
                  fill="transparent"
                  r="28"
                  stroke="currentColor"
                  strokeDasharray={circleCircumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute text-[11px] font-bold text-primary">
                {completedCount}/{totalCount}
              </span>
            </div>
          </div>

          {/* FILTER TABS & DOWNLOAD */}
          <div className="px-6 space-y-4">
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                const count = tabCounts[tab.id];
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 rounded-full font-label-sm text-xs whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                      isActive
                        ? 'bg-primary text-white shadow-sm font-semibold'
                        : 'bg-surface text-on-surface-variant border border-outline-variant hover:bg-surface-container-high'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        isActive ? 'bg-white/20 text-white' : 'bg-surface-container-high text-on-surface-variant'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* MODULE CARDS LIST */}
          <div className="px-6 space-y-4">
            {modulesLoading && (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-on-surface-variant font-medium">Loading educational modules...</p>
              </div>
            )}

            {!modulesLoading && filteredModules.length === 0 && (
              <div className="bg-surface-container-lowest rounded-2xl p-8 text-center border border-outline-variant/30 organic-shadow flex flex-col items-center justify-center my-4 animate-fade-in">
                <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center text-primary mb-4">
                  <span className="material-symbols-outlined text-3xl">
                    {activeTab === 'video'
                      ? 'smart_display'
                      : activeTab === 'audio'
                      ? 'headphones'
                      : activeTab === 'article'
                      ? 'article'
                      : 'task_alt'}
                  </span>
                </div>
                <h3 className="font-headline-md text-base text-on-surface mb-1">
                  {activeTab === 'video'
                    ? 'No Videos Available'
                    : activeTab === 'audio'
                    ? 'No Audio Lessons Available'
                    : activeTab === 'article'
                    ? 'No Articles Available'
                    : 'No Completed Modules Yet'}
                </h3>
                <p className="text-on-surface-variant text-xs max-w-xs leading-relaxed mb-5">
                  {activeTab === 'video'
                    ? 'Video lessons for this stage of your pregnancy are currently being prepared by our medical team.'
                    : activeTab === 'audio'
                    ? 'Audio guides and relaxation exercises will appear here once published.'
                    : activeTab === 'article'
                    ? 'No articles found in this category at this time.'
                    : 'Modules you complete will appear here so you can easily review them whenever you want.'}
                </p>
                {activeTab !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('all')}
                    className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-semibold hover:opacity-95 transition-opacity cursor-pointer shadow-sm"
                  >
                    View All Learning Modules
                  </button>
                )}
              </div>
            )}

            {!modulesLoading &&
              filteredModules.map((mod, idx) => {
                const modType = getModuleType(mod);
                const ts = getTypeStyle(modType);
                const isCurrentWeekModule =
                  currentWeek != null &&
                  mod.week_number === currentWeek;
                const isRecommended =
                  isCurrentWeekModule || mod.is_current_recommendation || mod.recommended || idx === 0;
                const isCompleted = mod.is_completed || mod.completed;
                const typeLabel = modType.charAt(0).toUpperCase() + modType.slice(1);
                const duration = mod.duration || (modType === 'video' ? '8 min' : modType === 'audio' ? '10 min' : '5 min read');
                const weekLabel = mod.week_number ? `Week ${mod.week_number}` : mod.week || 'Pregnancy Guide';
                const description = mod.summary || mod.description || mod.subtitle || '';

                return (
                  <div
                    key={mod.id}
                    onClick={() => navigate(`/education/${mod.id}`)}
                    className={`bg-surface-container-lowest rounded-[12px] organic-shadow overflow-hidden flex border-l-4 ${ts.border} relative group cursor-pointer hover:shadow-md transition-all active:scale-[0.99]`}
                  >
                    <div className="p-4 flex gap-4 w-full items-center">
                      <div className={`w-14 h-14 ${ts.bg} rounded-xl flex items-center justify-center ${ts.color} shrink-0 shadow-xs`}>
                        <span className="material-symbols-outlined text-3xl">{ts.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {isRecommended && (
                            <span className="bg-tertiary-fixed text-primary px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight">
                              {isCurrentWeekModule ? `Week ${currentWeek} Pick` : 'Recommended'}
                            </span>
                          )}
                          <span className="text-on-surface-variant font-label-sm text-[10px] capitalize">
                            {weekLabel} • {typeLabel} • {duration}
                          </span>
                        </div>
                        <h3 className="font-bold text-body-lg text-on-surface truncate text-sm">
                          {mod.title}
                        </h3>
                        {description && (
                          <p className="text-on-surface-variant text-xs truncate mt-0.5 opacity-85">
                            {description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-center shrink-0 w-8">
                        {isCompleted ? (
                          <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>
                            check_circle
                          </span>
                        ) : (
                          <span className="material-symbols-outlined text-outline-variant group-hover:text-primary transition-colors">
                            chevron_right
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-surface-container z-50 px-6 py-3 pb-8 shadow-lg">
        <div className="max-w-[640px] mx-auto flex justify-between items-center">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="flex flex-col items-center gap-1 text-outline hover:text-primary transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined">home</span>
            <span className="text-[10px] font-label-sm">Home</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/appointments')}
            className="flex flex-col items-center gap-1 text-outline hover:text-primary transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined">calendar_month</span>
            <span className="text-[10px] font-label-sm">Appointments</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/education')}
            className="flex flex-col items-center gap-1 text-primary cursor-pointer"
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>auto_stories</span>
            <span className="text-[10px] font-label-sm font-bold">Learn</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="flex flex-col items-center gap-1 text-outline hover:text-primary transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined">person</span>
            <span className="text-[10px] font-label-sm">Profile</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default PregnancyEducation;