import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getEducationModule, markModuleComplete } from '../lib/api';

const STATIC_MODULES = {
  'baby-growth': {
    id: 'baby-growth',
    type: 'Video',
    typeIcon: 'play_circle',
    week: 'Week 12',
    tag: 'Development',
    duration: '8 min',
    title: "Understanding Your Baby's Rapid Growth",
    subtitle: "Your baby is now the size of a lime — and almost fully formed.",
    video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    nextModule: { id: 'mindful-breathing', type: 'Audio', duration: '12 min', title: 'Mindful Breathing for Relief', icon: 'music_note' },
    sections: [
      {
        kind: 'intro',
        body: `At 12 weeks, your pregnancy has reached an important milestone. Almost all of your baby's major organs and body structures are fully formed. From now on, they will continue to grow and mature until birth. This is a time of enormous change — and knowing what is happening inside you can help you feel more confident and calm.`,
      },
      {
        kind: 'body',
        heading: "What Is Happening This Week",
        body: `Your baby is about 5–6 cm long and weighs roughly 14 grams — the size of a lime or a small plum. The face is now recognisably human, with eyes that have moved to the front of the head. Tiny fingernails are forming on fingers and toes. The brain is growing rapidly, and the nervous system is beginning to make the first connections that will control movement and sensation.\n\nThe placenta is now fully taking over from the yolk sac. It delivers oxygen and nutrients directly to your baby through the umbilical cord, and removes waste products. This is why eating well and staying hydrated matters so much right now.`,
      },
      {
        kind: 'highlight',
        icon: 'favorite',
        heading: "Did You Know?",
        body: `Your baby can now open and close their fingers, curl their toes, and even make sucking movements with their mouth — long before they will need to feed. These reflex movements are the body's way of practising for life outside the womb.`,
      },
      {
        kind: 'body',
        heading: "How Your Body Is Changing",
        body: `Many women find that the first-trimester fatigue and nausea begin to ease around week 12. Your uterus has grown large enough that your midwife can now feel it just above your pubic bone. You may begin to notice a small, firm bump.\n\nYour blood volume is increasing significantly — by the end of pregnancy, it will be about 50% more than normal. This is why some women feel warmer than usual, or notice their heart beating faster. These are normal signs that your body is working hard.`,
      },
      {
        kind: 'takeaways',
        heading: 'Key Takeaways',
        items: [
          'The placenta is now fully functional — it feeds and protects your baby.',
          'All major organs are formed; the focus now shifts to growth and maturation.',
          'Your baby has fingernails, working kidneys, and beginning reflexes.',
          'Morning sickness often begins to ease from this week onward.',
          'Your uterus is now large enough to feel above the pubic bone.',
        ],
      },
      {
        kind: 'warning',
        heading: 'When to Contact Your Nurse',
        items: [
          'Heavy bleeding or bright red discharge',
          'Severe cramps or lower abdominal pain that does not go away',
          'High fever (above 38°C)',
          'No longer feeling pregnant — sudden disappearance of all symptoms',
        ],
      },
      {
        kind: 'body',
        heading: 'Your Antenatal Appointment',
        body: `Your first major antenatal scan — called the dating or nuchal scan — usually happens between 11 and 13 weeks. If you have not had yours yet, book it at your clinic. The scan checks that your baby is growing well, confirms the due date, and screens for certain chromosomal conditions. Your midwife will measure the fluid at the back of the baby's neck (the nuchal fold) and check the blood flow in the placenta.\n\nBring your antenatal card and a full bladder. The ultrasound gel may feel cold, but the scan is painless and usually takes 20–30 minutes.`,
      },
      {
        kind: 'highlight',
        icon: 'restaurant',
        heading: 'Nutrition Tip for Week 12',
        body: `Iron-rich foods are especially important right now as your blood volume grows. In Nigeria, excellent sources include ugu (fluted pumpkin leaves), ofe akwu (palm nut soup with fish), egusi soup with beef liver, and garden eggs. Pair them with vitamin C — like fresh orange or tomato — to help your body absorb the iron better.`,
      },
    ],
  },
  'mindful-breathing': {
    id: 'mindful-breathing',
    type: 'Audio',
    typeIcon: 'music_note',
    week: 'Week 12',
    tag: 'Wellness',
    duration: '12 min',
    title: 'Mindful Breathing for Relief',
    subtitle: 'Simple exercises for managing nausea, anxiety, and fatigue.',
    nextModule: { id: 'nutrition-iron-zinc', type: 'Article', duration: '5 min read', title: 'Nutrition Essentials: Iron & Zinc', icon: 'description' },
    sections: [
      {
        kind: 'intro',
        body: `Breathing is something we do without thinking — but learning to breathe intentionally is one of the most powerful tools you have during pregnancy. In this module, you will learn three simple techniques that can help ease nausea, reduce anxiety, and give you more energy on difficult days.`,
      },
      {
        kind: 'body',
        heading: 'Why Breathing Matters in Pregnancy',
        body: `During pregnancy, your body needs about 20% more oxygen than usual to support both you and your growing baby. At the same time, the hormonal changes of the first trimester can leave many women feeling anxious, short of breath, or overwhelmed.\n\nSlow, deep breathing activates the parasympathetic nervous system — the part of your body that controls rest and digestion. This reduces stress hormones like cortisol, calms the heart rate, and can even settle nausea by reducing the body's fight-or-flight response.`,
      },
      {
        kind: 'takeaways',
        heading: 'Three Techniques to Practise',
        items: [
          '4-7-8 Breathing: Inhale for 4 counts, hold for 7, exhale slowly for 8. Repeat 4 times.',
          'Box Breathing: Inhale 4, hold 4, exhale 4, hold 4. Good for anxiety and sleep.',
          'Belly Breathing: Place one hand on your chest, one on your belly. Breathe so only the belly hand rises.',
        ],
      },
      {
        kind: 'highlight',
        icon: 'self_improvement',
        heading: 'When to Use These Techniques',
        body: `Try 4-7-8 breathing when you feel nausea coming on, especially in the morning. Use box breathing before your antenatal appointments if you feel nervous. Practise belly breathing at night to help you fall asleep more easily.`,
      },
      {
        kind: 'warning',
        heading: 'Stop and Rest If You Feel',
        items: [
          'Dizziness or lightheadedness during any breathing exercise',
          'Shortness of breath that does not improve with rest',
          'Chest tightness or palpitations lasting more than a few seconds',
        ],
      },
    ],
  },
  'nutrition-iron-zinc': {
    id: 'nutrition-iron-zinc',
    type: 'Article',
    typeIcon: 'description',
    week: 'Week 12',
    tag: 'Nutrition',
    duration: '5 min read',
    title: 'Nutrition Essentials: Iron & Zinc',
    subtitle: 'The best local foods to keep you and your baby strong.',
    nextModule: { id: 'first-scan', type: 'Video', duration: '15 min', title: 'First Scan: What to Expect', icon: 'play_circle' },
    sections: [
      {
        kind: 'intro',
        body: `What you eat during pregnancy directly affects how your baby grows. Two minerals that are especially important in the first trimester are iron and zinc. Many women in Nigeria enter pregnancy with low iron stores, which is why understanding your food choices now can make a real difference to your health and your baby's development.`,
      },
      {
        kind: 'body',
        heading: 'Why Iron Matters',
        body: `Iron is needed to make haemoglobin — the protein in red blood cells that carries oxygen to your baby. During pregnancy, your blood volume increases by up to 50%, so your iron needs almost double. Without enough iron, you may feel very tired, dizzy, or short of breath. Severe iron deficiency (anaemia) is one of the most common causes of complications during labour in Nigeria.\n\nThe good news: many of the foods already eaten regularly in Southern Nigeria are excellent iron sources.`,
      },
      {
        kind: 'takeaways',
        heading: 'Best Local Sources of Iron',
        items: [
          'Ugu (fluted pumpkin) — one of the richest plant sources of iron available locally',
          'Beef liver and kidney — eaten in small portions 2–3 times per week',
          'Egusi soup with meat or fish',
          'Ofe onugbu (bitter leaf soup) with stock fish',
          'Beans — black-eyed peas, honey beans (oloyin), or black beans',
        ],
      },
      {
        kind: 'highlight',
        icon: 'tips_and_updates',
        heading: 'Boost Absorption with Vitamin C',
        body: `Your body absorbs iron from plant foods much better when eaten alongside vitamin C. Add fresh tomatoes, orange slices, or lime juice to your iron-rich meals. Avoid drinking tea or coffee with meals — the tannins in tea can reduce iron absorption by up to 60%.`,
      },
      {
        kind: 'body',
        heading: 'Why Zinc Matters',
        body: `Zinc supports your baby's cell growth and the development of a healthy immune system. It is also important for healing and for your own immune function during pregnancy. Zinc deficiency is linked to low birth weight and preterm delivery.\n\nGood sources of zinc in Nigerian cuisine include beef, chicken, turkey, egusi seeds, groundnuts (peanuts), and dried crayfish. Eating a varied diet that includes these foods most days will help you meet your needs without supplements.`,
      },
      {
        kind: 'warning',
        heading: 'Foods to Limit or Avoid',
        items: [
          'Raw or undercooked meat, fish, or eggs — risk of foodborne illness',
          'Soft unpasteurised cheese (like some local wara) — risk of listeria',
          'Excess vitamin A supplements or liver more than once a week — can be harmful in high doses',
          'Alcohol — no safe amount in pregnancy',
        ],
      },
    ],
  },
  'first-scan': {
    id: 'first-scan',
    type: 'Video',
    typeIcon: 'play_circle',
    week: 'Week 11–13',
    tag: 'Antenatal Care',
    duration: '15 min',
    title: 'First Scan: What to Expect',
    subtitle: 'A guide to your dating ultrasound.',
    video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    nextModule: { id: 'baby-growth', type: 'Video', duration: '8 min', title: "Understanding Baby's Growth", icon: 'play_circle' },
    sections: [
      {
        kind: 'intro',
        body: `Your first ultrasound scan is one of the most exciting moments of early pregnancy. It is the first time you will see your baby on screen — and it provides your midwife with important information about how your pregnancy is progressing. This guide will help you know what to expect before, during, and after the scan at your clinic.`,
      },
      {
        kind: 'body',
        heading: 'What the Scan Checks',
        body: `The dating scan (also called the nuchal translucency scan) is done between 11 and 13 weeks and 6 days. It checks that your baby has a heartbeat and is growing in the right place — in the uterus, not the fallopian tube. The sonographer will measure your baby from head to bottom (crown-rump length) to confirm your due date.\n\nThe scan also measures the fluid at the back of your baby's neck, called the nuchal fold. A thicker measurement may indicate a higher chance of chromosomal conditions like Down syndrome. If this is a concern, your midwife will explain what the next steps are — in most cases, everything is completely normal.`,
      },
      {
        kind: 'takeaways',
        heading: 'How to Prepare',
        items: [
          'Drink 4–6 glasses of water in the hour before the scan and do not use the toilet — a full bladder helps the image quality.',
          'Bring your antenatal card and any previous scan reports.',
          'Wear loose, comfortable clothing you can lift or roll down easily.',
          'You may bring one support person with you — a partner, mother, or friend.',
          'The scan is painless. Cold gel will be applied to your belly.',
        ],
      },
      {
        kind: 'highlight',
        icon: 'ultrasound',
        heading: 'What You Will See',
        body: `At 12 weeks, your baby looks remarkably like a tiny person on the screen. You will be able to see the head, body, arms, and legs moving. You may see the heart flickering rapidly — a healthy baby's heart rate at this stage is between 150 and 170 beats per minute. The sonographer will show you where to look and explain what you are seeing.`,
      },
      {
        kind: 'body',
        heading: 'After the Scan',
        body: `You will receive printed scan images to take home. Your midwife will review the measurements and results with you, usually at the same appointment or shortly after. If everything looks normal, your next scan will be at around 20 weeks — the anatomy scan.\n\nIf any measurements are outside the normal range, do not panic. Your midwife will refer you to an obstetrician who will carry out further assessments. Most concerns found at the dating scan turn out to be nothing serious.`,
      },
      {
        kind: 'warning',
        heading: 'Contact Your Clinic If You Have',
        items: [
          'Not yet had a scan and are past 13 weeks and 6 days',
          'Vaginal bleeding or cramping before your appointment',
          'Lost all pregnancy symptoms suddenly',
          'Any questions or concerns about the scan results',
        ],
      },
    ],
  },
};

const getYouTubeEmbedUrl = (url) => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = String(url).match(regExp);
  if (match && match[2].length === 11) {
    return `https://www.youtube.com/embed/${match[2]}?autoplay=0&rel=0`;
  }
  return url;
};

const typeColors = {
  Video:   { bg: 'bg-primary-fixed-dim', text: 'text-primary-container' },
  Audio:   { bg: 'bg-tertiary-fixed',    text: 'text-tertiary' },
  Article: { bg: 'bg-surface-container', text: 'text-on-surface-variant' },
};

const EducationDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [completed, setCompleted] = useState(false);
  const [apiModule, setApiModule] = useState(null);

  useEffect(() => {
    if (!id) return;
    // If it's one of the known static rich articles, we already have full content
    if (STATIC_MODULES[id]) {
      return;
    }
    // Otherwise fetch from backend API
    getEducationModule(id)
      .then((r) => {
        if (r.data?.module) {
          setApiModule(r.data.module);
        }
      })
      .catch(() => {});
  }, [id]);

  // Priority: static rich article > API module > fallback static
  const staticMatch = STATIC_MODULES[id];
  
  const mod = staticMatch || (apiModule
    ? {
        id: apiModule.id,
        type: apiModule.video_url ? 'Video' : apiModule.audio_url ? 'Audio' : 'Article',
        typeIcon: apiModule.video_url ? 'play_circle' : apiModule.audio_url ? 'music_note' : 'description',
        week: apiModule.week_number ? `Week ${apiModule.week_number}` : 'Pregnancy Guide',
        tag: 'Clinical Guidance',
        duration: apiModule.video_url ? '8 min' : apiModule.audio_url ? '10 min' : '5 min read',
        title: apiModule.title,
        subtitle: apiModule.summary ? apiModule.summary.slice(0, 110) + '...' : 'Antenatal care and maternal guidance.',
        video_url: apiModule.video_url,
        audio_url: apiModule.audio_url,
        nextModule: { id: 'baby-growth', type: 'Video', duration: '8 min', title: "Understanding Baby's Growth", icon: 'play_circle' },
        sections: [
          { kind: 'intro', body: apiModule.summary || 'Welcome to this week\'s pregnancy lesson.' },
          ...(apiModule.transcript ? [{ kind: 'highlight', icon: 'record_voice_over', heading: 'Pidgin Summary / Audio Transcript', body: apiModule.transcript }] : []),
          {
            kind: 'takeaways',
            heading: 'Key Takeaways',
            items: [
              'Continue taking your daily prenatal iron and folic acid supplements.',
              'Stay well hydrated by drinking clean water regularly throughout the day.',
              'Attend all scheduled antenatal clinic visits with your healthcare provider.',
            ],
          },
          {
            kind: 'warning',
            heading: 'When to Contact Your Clinic Immediately',
            items: [
              'Heavy vaginal bleeding or leaking of fluid',
              'Severe persistent headache, vision changes, or sudden severe swelling',
              'High fever or chills',
              'Noticeable decrease in baby movements',
            ],
          },
        ],
      }
    : STATIC_MODULES['baby-growth']);

  const tc = typeColors[mod.type] || typeColors.Article;
  const isVideo = mod.type === 'Video' || !!mod.video_url;
  const isAudio = mod.type === 'Audio' || !!mod.audio_url;

  const embedUrl = isVideo && mod.video_url ? getYouTubeEmbedUrl(mod.video_url) : null;
  const isYouTubeEmbed = embedUrl && embedUrl.includes('youtube.com/embed');

  return (
    <div className="font-body-md text-on-surface min-h-screen">
      <div className="grain-overlay" />

      <main className="max-w-[640px] mx-auto min-h-screen bg-surface-container-low relative flex flex-col">
        {/* STICKY HEADER */}
        <header className="bg-primary text-on-primary sticky top-0 z-50 px-4 py-3 flex items-center gap-3 shadow-sm">
          <button
            type="button"
            onClick={() => navigate('/education')}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors flex-shrink-0 cursor-pointer"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-label-sm text-[10px] uppercase tracking-widest text-on-primary-container opacity-80">
              {mod.week} · {mod.tag}
            </p>
            <h1 className="font-headline-md text-sm leading-tight truncate">{mod.title}</h1>
          </div>
        </header>

        {/* ── VIDEO / AUDIO / ARTICLE HEADER ── */}
        {isVideo ? (
          <div className="relative aspect-video bg-black overflow-hidden shadow-xl flex-shrink-0">
            {embedUrl ? (
              isYouTubeEmbed ? (
                <iframe
                  className="w-full h-full"
                  src={embedUrl}
                  title={mod.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video
                  controls
                  className="w-full h-full object-contain"
                  src={mod.video_url}
                  poster="https://images.unsplash.com/photo-1584515933487-779824d29309?w=640&q=80"
                />
              )
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-white/80 bg-stone-900">
                <span className="material-symbols-outlined text-5xl mb-2 text-white/60">smart_display</span>
                <p className="text-sm font-semibold">Video Demonstration</p>
                <p className="text-xs text-white/50 max-w-xs mt-1">Video is currently loading or being prepared.</p>
              </div>
            )}
          </div>
        ) : isAudio ? (
          <div className="bg-primary px-6 py-8 flex flex-col items-center gap-5 flex-shrink-0">
            <div className="w-24 h-24 bg-primary-container rounded-full flex items-center justify-center shadow-lg">
              <span className="material-symbols-outlined text-on-primary-container text-5xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                headphones
              </span>
            </div>
            <div className="text-center">
              <p className="font-headline-md text-on-primary text-base font-bold">{mod.title}</p>
              <p className="text-on-primary-container text-xs opacity-80 mt-1">{mod.week} • {mod.duration}</p>
            </div>
            {mod.audio_url && (
              <audio controls className="w-full max-w-sm mt-2" src={mod.audio_url} />
            )}
          </div>
        ) : (
          <div className="bg-tertiary-fixed px-6 py-6 flex items-center gap-4 flex-shrink-0 border-b border-primary/10">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-primary shadow-xs shrink-0">
              <span className="material-symbols-outlined text-2xl">description</span>
            </div>
            <div>
              <span className="font-label-sm text-[10px] uppercase tracking-widest text-primary font-bold">
                {mod.week} • Reading Article
              </span>
              <h3 className="font-headline-md text-sm text-primary font-bold leading-snug">{mod.title}</h3>
            </div>
          </div>
        )}

        {/* ── CONTENT BODY ── */}
        <div className="flex-1 flex flex-col pb-40">
          {/* Module meta strip */}
          <div className="px-5 pt-6 pb-4 flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`${tc.bg} ${tc.text} px-3 py-1 rounded-full font-label-sm text-[10px] uppercase tracking-wide flex items-center gap-1 font-semibold`}>
                  <span className="material-symbols-outlined text-[12px]">{mod.typeIcon}</span>
                  {mod.type} · {mod.duration}
                </span>
                <span className="bg-tertiary-fixed text-primary px-3 py-1 rounded-full font-label-sm text-[10px] uppercase tracking-wide font-semibold">
                  {mod.week}
                </span>
              </div>
              <h2 className="font-headline-lg text-primary text-xl leading-snug font-bold">{mod.title}</h2>
              <p className="text-on-surface-variant text-sm mt-1">{mod.subtitle}</p>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-outline-variant/20 mx-5" />

          {/* Content sections */}
          <div className="px-5 py-6 space-y-8">
            {mod.sections.map((s, i) => {
              if (s.kind === 'intro') {
                return (
                  <p key={i} className="font-body-lg text-on-surface leading-relaxed text-base">
                    {s.body}
                  </p>
                );
              }

              if (s.kind === 'body') {
                return (
                  <div key={i} className="space-y-3">
                    <h3 className="font-headline-md text-primary text-base font-bold">{s.heading}</h3>
                    {s.body.split('\n\n').map((para, j) => (
                      <p key={j} className="font-body-md text-on-surface-variant leading-relaxed text-sm">
                        {para}
                      </p>
                    ))}
                  </div>
                );
              }

              if (s.kind === 'takeaways') {
                return (
                  <div key={i} className="bg-surface-container-high rounded-xl p-5 space-y-4">
                    <h3 className="font-label-sm uppercase tracking-widest text-primary border-b border-primary/10 pb-2 text-xs font-bold">
                      {s.heading}
                    </h3>
                    <ul className="space-y-3">
                      {s.items.map((item, j) => (
                        <li key={j} className="flex gap-3 items-start">
                          <span
                            className="material-symbols-outlined text-primary-container mt-0.5 flex-shrink-0 text-[18px]"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            check_circle
                          </span>
                          <span className="font-body-md text-on-surface text-sm leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              }

              if (s.kind === 'highlight') {
                return (
                  <div key={i} className="bg-tertiary-fixed border border-primary/10 rounded-xl p-5 flex gap-4">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
                      <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                        {s.icon}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-label-sm text-primary uppercase tracking-widest text-[10px] font-bold">
                        {s.heading}
                      </h4>
                      <p className="font-body-md text-tertiary leading-relaxed text-sm">{s.body}</p>
                    </div>
                  </div>
                );
              }

              if (s.kind === 'warning') {
                return (
                  <div key={i} className="border border-secondary/20 bg-secondary-fixed/30 rounded-xl p-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-secondary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                        warning
                      </span>
                      <h3 className="font-label-sm uppercase tracking-widest text-secondary text-xs font-bold">
                        {s.heading}
                      </h3>
                    </div>
                    <ul className="space-y-2">
                      {s.items.map((item, j) => (
                        <li key={j} className="flex gap-3 items-start">
                          <span className="w-1.5 h-1.5 bg-secondary rounded-full mt-2 flex-shrink-0" />
                          <span className="font-body-md text-on-surface text-sm leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              }

              return null;
            })}
          </div>

          {/* Divider */}
          <div className="h-px bg-outline-variant/20 mx-5" />

          {/* Up Next */}
          {mod.nextModule && (
            <div className="px-5 py-6 space-y-3">
              <h3 className="font-headline-md text-on-surface text-base">Up Next</h3>
              <button
                type="button"
                onClick={() => navigate(`/education/${mod.nextModule.id}`)}
                className="w-full flex items-center gap-4 p-4 bg-surface-container-lowest rounded-xl organic-shadow hover:shadow-md transition-shadow active:scale-[0.99] text-left cursor-pointer"
              >
                <div className={`w-12 h-12 ${typeColors[mod.nextModule.type]?.bg || 'bg-surface-container'} rounded-lg flex items-center justify-center flex-shrink-0`}>
                  <span className={`material-symbols-outlined ${typeColors[mod.nextModule.type]?.text || 'text-on-surface-variant'}`}>
                    {mod.nextModule.icon}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-on-surface text-sm leading-snug">{mod.nextModule.title}</p>
                  <p className="text-xs text-on-surface-variant">{mod.nextModule.type} · {mod.nextModule.duration}</p>
                </div>
                <span className="material-symbols-outlined text-outline-variant flex-shrink-0">chevron_right</span>
              </button>
            </div>
          )}

          {/* Source note */}
          <p className="px-5 py-6 text-center italic text-outline font-body-md text-xs">
            Content reviewed by clinical team • 9Care AI v1.0
          </p>
        </div>

        {/* ── STICKY COMPLETION FOOTER ── */}
        {!completed ? (
          <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[640px] bg-white/95 backdrop-blur-lg border-t border-outline-variant/20 px-5 py-4 flex gap-3 shadow-lg">
            <button
              type="button"
              onClick={() => navigate('/education')}
              className="flex-1 py-3.5 font-bold text-primary border-2 border-primary/20 rounded-xl hover:bg-primary/5 transition-all active:scale-95 text-sm cursor-pointer"
            >
              Back to list
            </button>
            <button
              type="button"
              onClick={() => {
                setCompleted(true);
                markModuleComplete(id).catch(() => {});
              }}
              className="flex-[2] py-3.5 font-bold text-white bg-primary rounded-xl hover:opacity-95 shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 text-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                check_circle
              </span>
              Mark as complete
            </button>
          </div>
        ) : (
          <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[640px] bg-primary text-white px-5 py-5 rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.15)] animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-headline-md text-base font-bold">Module completed!</p>
                <p className="text-white/80 text-xs mt-0.5">You've earned +10 9Care Points for learning</p>
              </div>
              <span className="material-symbols-outlined text-4xl text-amber-300" style={{ fontVariationSettings: "'FILL' 1" }}>
                celebration
              </span>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => navigate('/education')}
                className="w-full py-3 bg-white text-primary font-bold rounded-xl hover:bg-amber-50 transition-colors text-sm cursor-pointer"
              >
                Back to All Modules
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default EducationDetail;
