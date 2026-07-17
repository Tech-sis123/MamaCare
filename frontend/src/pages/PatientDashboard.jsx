import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { askPatientAI } from '../lib/api';

const AIChatPanel = ({ onClose }) => {
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Hi! I'm your 9Care AI assistant. Ask me anything about your pregnancy, symptoms, or health.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const q = input.trim();
    if (!q || q.length < 5 || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setLoading(true);
    try {
      const { data } = await askPatientAI(q);
      setMessages(prev => [...prev, { role: 'ai', text: data.answer }]);
    } catch (err) {
      const msg = err.response?.status === 404
        ? 'Please complete your profile first so I can give personalised advice.'
        : 'Sorry, I couldn't reach the AI right now. Please try again.';
      setMessages(prev => [...prev, { role: 'ai', text: msg }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl w-full max-w-[640px] mx-auto flex flex-col shadow-2xl"
        style={{ maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-container">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-lg">smart_toy</span>
            </div>
            <div>
              <p className="font-headline-md text-sm text-primary">9Care AI</p>
              <p className="font-label-sm text-[10px] text-outline">Powered by Groq · Not medical advice</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container">
            <span className="material-symbols-outlined text-outline">close</span>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              {m.role === 'ai' && (
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="material-symbols-outlined text-primary text-sm">smart_toy</span>
                </div>
              )}
              <div
                className={`max-w-[78%] px-4 py-3 rounded-2xl font-body-md text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-primary text-white rounded-tr-sm'
                    : 'bg-surface-container text-on-surface rounded-tl-sm'
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-primary text-sm">smart_toy</span>
              </div>
              <div className="bg-surface-container px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 pb-8 pt-3 border-t border-surface-container flex items-end gap-3">
          <textarea
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask about your pregnancy…"
            className="flex-1 resize-none rounded-2xl border border-surface-container bg-surface-container-low px-4 py-3 font-body-md text-sm focus:outline-none focus:border-primary transition-colors"
            style={{ maxHeight: '120px', overflowY: 'auto' }}
          />
          <button
            onClick={send}
            disabled={input.trim().length < 5 || loading}
            className="w-11 h-11 bg-primary rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-opacity"
          >
            <span className="material-symbols-outlined text-white text-lg">send</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const PatientDashboard = () => {
  const navigate = useNavigate();
  const [showAI, setShowAI] = useState(false);

  return (
    <div className="min-h-screen text-on-surface font-body-md selection:bg-secondary/20">
      {/* Navbar & Header Cluster */}
      <header className="bg-primary pt-6 pb-12 px-6 sticky top-0 z-40">
        <div className="max-w-[640px] mx-auto">
          <nav className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-2 text-on-primary font-headline-md text-xl">
              <span className="material-symbols-outlined text-on-primary">pregnant_woman</span>
              <span>9Care AI</span>
            </div>
            <button className="relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">
              <span className="material-symbols-outlined text-white">notifications</span>
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-secondary rounded-full border-2 border-primary"></span>
            </button>
          </nav>
          <div className="space-y-1">
            <h1 className="font-headline-md text-headline-md text-white">Hello, Mama Efe 👋</h1>
            <p className="font-body-md text-white/80">Week 12 · First trimester</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[640px] mx-auto px-4 -mt-6 pb-32 space-y-6">
        {/* Risk Level Card */}
        <section className="bg-[#D4E6D8] rounded-xl p-6 flex justify-between items-center card-shadow">
          <div className="space-y-3">
            <div className="inline-flex items-center px-3 py-1 bg-primary text-white rounded-full font-label-sm text-[10px]">
              LOW RISK
            </div>
            <div>
              <h3 className="font-label-sm text-primary uppercase opacity-60">Your risk level</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="material-symbols-outlined text-primary text-3xl font-bold">check_circle</span>
                <p className="font-body-md text-primary/80">Safe &amp; Stable</p>
              </div>
            </div>
            <div className="flex items-center gap-4 pt-1">
              <span className="text-xs text-primary/60">Last assessed: Today</span>
              <a className="text-xs font-bold text-primary underline underline-offset-4 decoration-primary/30" href="#">
                Retake check →
              </a>
            </div>
          </div>
          <div className="w-20 h-20 opacity-10">
            <span className="material-symbols-outlined text-[80px]">spa</span>
          </div>
        </section>

        {/* Pregnancy Progress Card */}
        <section className="bg-surface-container-lowest rounded-xl p-6 card-shadow border border-surface-container">
          <h3 className="font-headline-md text-body-lg text-primary mb-6">Week 12 of 40</h3>
          <div className="relative pt-1">
            <div className="overflow-hidden h-2 mb-8 text-xs flex rounded-full bg-surface-container">
              <div
                className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary"
                style={{ width: '30%' }}
              ></div>
            </div>
            <div className="flex justify-between relative">
              <div className="text-center">
                <div className="w-3 h-3 bg-primary rounded-full mx-auto mb-2"></div>
                <p className="text-[10px] font-label-sm text-outline">
                  Week 1<br />Start
                </p>
              </div>
              <div className="text-center absolute left-[30%] -translate-x-1/2">
                <div className="w-5 h-5 bg-primary rounded-full mx-auto mb-1 flex items-center justify-center ring-4 ring-secondary/20">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <p className="text-[10px] font-label-sm text-primary">
                  Week 12<br />You are here
                </p>
              </div>
              <div className="text-center">
                <div className="w-3 h-3 bg-surface-container rounded-full mx-auto mb-2"></div>
                <p className="text-[10px] font-label-sm text-outline">
                  Week 40<br />Due date
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Next Appointment Card */}
        <section className="bg-surface-container-lowest rounded-xl p-6 card-shadow border border-surface-container">
          <div className="flex gap-4 mb-6">
            <div className="w-12 h-12 bg-surface-container-low rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">calendar_month</span>
            </div>
            <div>
              <h3 className="font-label-sm text-outline uppercase mb-1">Next Appointment</h3>
              <p className="font-headline-md text-lg text-primary">Tuesday, 14 May · 10:30 AM</p>
            </div>
          </div>
          <div className="space-y-1 mb-6 pl-16">
            <p className="font-body-md text-on-surface">Dr. Adaeze Nwankwo</p>
            <p className="font-body-md text-on-surface-variant text-sm">ANC Clinic B</p>
          </div>
          <div className="flex gap-3 pl-16">
            <button className="px-4 py-2 border border-outline rounded-lg text-sm font-label-sm text-on-surface-variant hover:bg-surface-container transition-colors">
              Reschedule
            </button>
            <button className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-label-sm hover:opacity-90 transition-opacity">
              Get directions
            </button>
          </div>
        </section>

        {/* Education Nudge */}
        <section className="bg-primary rounded-xl p-6 card-shadow relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-white/70 font-label-sm text-xs mb-2">
              <span>Week 12 tip</span>
              <span className="material-symbols-outlined text-xs">menu_book</span>
            </div>
            <h3 className="font-headline-md text-xl text-white mb-4 max-w-[200px]">
              What happens to your body this week?
            </h3>
            <button className="text-white font-label-sm text-sm underline underline-offset-4">
              Read full article
            </button>
          </div>
          <div className="absolute right-0 bottom-0 top-0 w-1/2">
            <img
              className="w-full h-full object-cover opacity-40 mix-blend-overlay"
              alt="Expectant mother's hands on belly"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuA5HHI9tMOcn_iIL9yyXOxfjbRdmAe3YRJb7vslOBZzelayBjtLz-Ez5iW2AfuXYgrnJ4-eFLj2sUpvtmDLe_PadQK3DsJuf9eiqpU7gxuO7OCJOXM9b-UZ3965xwiJffo3bmlAOA8CTX6cmss20jb_I7hqEDwGDBZ3EtbnTSNcAeEky2UPy_e7Yc7BZkm1iJmdH6U8_UiRPixcbo6YPEQ31QwCyOObcWtbOj8h_TYImZyFYBkNwxqKpg0L2IKUIbhlEwZxx1pcFq8"
            />
          </div>
        </section>

        {/* Quick Actions Grid */}
        <section className="grid grid-cols-2 gap-4">
          <button onClick={() => navigate('/appointments')} className="bg-surface-container-lowest p-4 rounded-xl card-shadow border border-surface-container flex flex-col items-center gap-3 text-center transition-transform active:scale-95">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">event_available</span>
            </div>
            <span className="font-label-sm text-xs text-on-surface">Book appointment</span>
          </button>
          <button className="bg-surface-container-lowest p-4 rounded-xl card-shadow border border-surface-container flex flex-col items-center gap-3 text-center transition-transform active:scale-95">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">school</span>
            </div>
            <span className="font-label-sm text-xs text-on-surface">Learn</span>
          </button>
          <button className="bg-[#FCEBEB] p-4 rounded-xl card-shadow border border-secondary/20 flex flex-col items-center gap-3 text-center transition-transform active:scale-95">
            <div className="w-10 h-10 bg-secondary/10 rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-secondary">report_problem</span>
            </div>
            <span className="font-label-sm text-xs text-secondary">Danger sign</span>
          </button>
          <button onClick={() => setShowAI(true)} className="bg-primary/5 p-4 rounded-xl card-shadow border border-primary/20 flex flex-col items-center gap-3 text-center transition-transform active:scale-95">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">smart_toy</span>
            </div>
            <span className="font-label-sm text-xs text-primary">Ask AI</span>
          </button>
        </section>

        {/* Recent Activity */}
        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-headline-md text-lg text-primary">Recent Activity</h3>
            <button className="text-xs font-label-sm text-outline hover:text-primary">View all</button>
          </div>
          <div className="bg-surface-container-lowest rounded-xl card-shadow border border-surface-container overflow-hidden">
            <div className="divide-y divide-surface-container">
              <div className="p-4 flex items-center gap-4">
                <div className="w-2 h-2 rounded-full bg-primary/40"></div>
                <div>
                  <p className="font-body-md text-sm text-on-surface">Health check completed</p>
                  <p className="text-[10px] text-outline">2 hours ago</p>
                </div>
              </div>
              <div className="p-4 flex items-center gap-4">
                <div className="w-2 h-2 rounded-full bg-primary/40"></div>
                <div>
                  <p className="font-body-md text-sm text-on-surface">Appointment booked</p>
                  <p className="text-[10px] text-outline">Yesterday, 4:15 PM</p>
                </div>
              </div>
              <div className="p-4 flex items-center gap-4">
                <div className="w-2 h-2 rounded-full bg-primary/40"></div>
                <div>
                  <p className="font-body-md text-sm text-on-surface">Module 3 watched</p>
                  <p className="text-[10px] text-outline">Monday, 10:20 AM</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer Copyright */}
      <footer className="max-w-[640px] mx-auto px-8 py-16 text-center border-t border-primary/10 bg-surface-container-low mb-20">
        <div className="font-headline-md text-xl font-bold text-primary mb-4">9Care AI</div>
        <p className="font-body-md text-sm text-outline tracking-wide leading-relaxed">
          © 2026 9Care AI. Safe pregnancies, every time.
        </p>
        <div className="flex justify-center gap-6 mt-8 flex-wrap">
          <a href="#" className="text-outline text-xs font-label-sm hover:text-primary underline underline-offset-4">
            Privacy Policy
          </a>
          <a href="#" className="text-outline text-xs font-label-sm hover:text-primary underline underline-offset-4">
            Terms
          </a>
          <a href="#" className="text-outline text-xs font-label-sm hover:text-primary underline underline-offset-4">
            Contact
          </a>
        </div>
      </footer>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-surface-container z-50 px-6 py-3 pb-8">
        <div className="max-w-[640px] mx-auto flex justify-between items-center">
          <button onClick={() => navigate('/dashboard')} className="flex flex-col items-center gap-1 group">
            <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
              home
            </span>
            <span className="text-[10px] font-label-sm text-primary">Home</span>
          </button>
          <button onClick={() => navigate('/appointments')} className="flex flex-col items-center gap-1 group text-outline">
            <span className="material-symbols-outlined">calendar_month</span>
            <span className="text-[10px] font-label-sm">Appointments</span>
          </button>
          <button onClick={() => navigate('/education')} className="flex flex-col items-center gap-1 group text-outline">
            <span className="material-symbols-outlined">auto_stories</span>
            <span className="text-[10px] font-label-sm">Learn</span>
          </button>
          <button onClick={() => navigate('/profile')} className="flex flex-col items-center gap-1 group text-outline">
            <span className="material-symbols-outlined">person</span>
            <span className="text-[10px] font-label-sm">Profile</span>
          </button>
        </div>
      </nav>

      {/* Floating AI button */}
      <button
        onClick={() => setShowAI(true)}
        className="fixed bottom-24 right-5 z-50 w-14 h-14 bg-primary rounded-full shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
        aria-label="Ask AI"
      >
        <span className="material-symbols-outlined text-white text-2xl">smart_toy</span>
      </button>

      {/* AI Chat Panel */}
      {showAI && <AIChatPanel onClose={() => setShowAI(false)} />}
    </div>
  );
};

export default PatientDashboard;