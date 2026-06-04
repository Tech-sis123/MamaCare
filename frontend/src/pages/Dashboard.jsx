import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, CheckCircle2, Leaf, CalendarDays, CalendarCheck,
  BookOpen, AlertTriangle, ClipboardList, Home, Calendar,
  User, ChevronRight, Heart,
} from 'lucide-react';
import { getPatientDashboard, getPatientMe } from '../lib/api';
import { getPatientData, isPatientAuthenticated } from '../lib/auth';

const PatientDashboard = () => {
  const navigate = useNavigate();
  const [dashData, setDashData] = useState(null);
  const [patientData, setPatientData] = useState(getPatientData());

  useEffect(() => {
    if (!isPatientAuthenticated()) {
      navigate('/register');
      return;
    }
    getPatientDashboard()
      .then(r => setDashData(r.data))
      .catch(() => {});
    getPatientMe()
      .then(r => setPatientData(r.data))
      .catch(() => {});
  }, [navigate]);

  const firstName = patientData?.name?.split(' ')[0] || 'Mama';
  const ega = dashData?.gestational_age || dashData?.ega;
  const weeks = ega?.weeks ?? 12;
  const trimester = weeks <= 12 ? 'First trimester' : weeks <= 27 ? 'Second trimester' : 'Third trimester';
  const riskTier = (dashData?.risk_tier || dashData?.latest_risk_tier || 'LOW').toUpperCase();
  const riskColor = riskTier === 'HIGH' ? 'bg-[#F8D7DA]' : riskTier === 'MEDIUM' ? 'bg-[#FFF3CD]' : 'bg-[#D4E6D8]';
  const riskLabel = riskTier === 'HIGH' ? 'HIGH RISK' : riskTier === 'MEDIUM' ? 'MEDIUM RISK' : 'LOW RISK';
  const nextAppt = dashData?.next_appointment;
  const eduModule = dashData?.educational_module || dashData?.recommended_module;
  return (
    <div className="min-h-screen text-on-surface font-body-md selection:bg-secondary/20">
      {/* Navbar & Header Cluster */}
      <header className="bg-primary pt-6 pb-12 px-6 sticky top-0 z-40">
        <div className="max-w-[640px] mx-auto">
          <nav className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-2 text-on-primary font-headline-md text-xl">
              <Heart className="w-5 h-5 text-on-primary fill-current" />
              <span>Mama Care AI</span>
            </div>
            <button className="relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">
              <Bell className="w-5 h-5 text-white" />
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-secondary rounded-full border-2 border-primary"></span>
            </button>
          </nav>
          <div className="space-y-1">
            <h1 className="font-headline-md text-headline-md text-white">Hello, {firstName} 👋</h1>
            <p className="font-body-md text-white/80">Week {weeks} · {trimester}</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[640px] mx-auto px-4 -mt-6 pb-32 space-y-6">
        {/* Risk Level Card */}
        <section className={`${riskColor} rounded-xl p-6 flex justify-between items-center card-shadow`}>
          <div className="space-y-3">
            <div className="inline-flex items-center px-3 py-1 bg-primary text-white rounded-full font-label-sm text-[10px]">
              {riskLabel}
            </div>
            <div>
              <h3 className="font-label-sm text-primary uppercase opacity-60">Your risk level</h3>
              <div className="flex items-center gap-2 mt-1">
                <CheckCircle2 className="w-8 h-8 text-primary" />
                <p className="font-body-md text-primary/80">Safe &amp; Stable</p>
              </div>
            </div>
            <div className="flex items-center gap-4 pt-1">
              <span className="text-xs text-primary/60">Last assessed: Today</span>
              <button onClick={() => navigate('/intake')} className="text-xs font-bold text-primary underline underline-offset-4 decoration-primary/30">
                Retake check →
              </button>
            </div>
          </div>
          <div className="w-20 h-20 opacity-10 flex items-center justify-center">
            <Leaf className="w-20 h-20" />
          </div>
        </section>

        {/* Pregnancy Progress Card */}
        <section className="bg-surface-container-lowest rounded-xl p-6 card-shadow border border-surface-container">
          <h3 className="font-headline-md text-body-lg text-primary mb-6">Week {weeks} of 40</h3>
          <div className="relative pt-1">
            <div className="overflow-hidden h-2 mb-8 text-xs flex rounded-full bg-surface-container">
              <div
                className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary"
                style={{ width: `${Math.round((weeks / 40) * 100)}%` }}
              ></div>
            </div>
            <div className="flex justify-between relative">
              <div className="text-center">
                <div className="w-3 h-3 bg-primary rounded-full mx-auto mb-2"></div>
                <p className="text-[10px] font-label-sm text-outline">
                  Week 1<br />Start
                </p>
              </div>
              <div className="text-center absolute -translate-x-1/2" style={{ left: `${Math.round((weeks / 40) * 100)}%` }}>
                <div className="w-5 h-5 bg-primary rounded-full mx-auto mb-1 flex items-center justify-center ring-4 ring-secondary/20">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <p className="text-[10px] font-label-sm text-primary">
                  Week {weeks}<br />You are here
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
              <CalendarDays className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-label-sm text-outline uppercase mb-1">Next Appointment</h3>
              <p className="font-headline-md text-lg text-primary">
                {nextAppt?.date
                  ? new Date(nextAppt.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }) +
                    (nextAppt.time ? ` · ${nextAppt.time}` : '')
                  : 'Tuesday, 14 May · 10:30 AM'}
              </p>
            </div>
          </div>
          <div className="space-y-1 mb-6 pl-16">
            <p className="font-body-md text-on-surface">{nextAppt?.doctor || 'Dr. Adaeze Nwankwo'}</p>
            <p className="font-body-md text-on-surface-variant text-sm">{nextAppt?.location || 'ANC Clinic B, UBTH'}</p>
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
              <span>Week {weeks} tip</span>
              <BookOpen className="w-3 h-3" />
            </div>
            <h3 className="font-headline-md text-xl text-white mb-4 max-w-[200px]">
              {eduModule?.title || 'What happens to your body this week?'}
            </h3>
            <button onClick={() => navigate('/education')} className="text-white font-label-sm text-sm underline underline-offset-4">
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
          <button onClick={() => navigate('/appointments')} className="bg-surface-container-lowest p-4 rounded-xl card-shadow border border-surface-container flex flex-col items-center gap-3 text-center transition-transform active:scale-95 hover:border-primary/20 hover:shadow-md">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <CalendarCheck className="w-5 h-5 text-primary" />
            </div>
            <span className="font-label-sm text-xs text-on-surface">Book appointment</span>
          </button>
          <button onClick={() => navigate('/education')} className="bg-surface-container-lowest p-4 rounded-xl card-shadow border border-surface-container flex flex-col items-center gap-3 text-center transition-transform active:scale-95 hover:border-primary/20 hover:shadow-md">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <span className="font-label-sm text-xs text-on-surface">Learn</span>
          </button>
          <button onClick={() => navigate('/emergency')} className="bg-[#FCEBEB] p-4 rounded-xl card-shadow border border-secondary/20 flex flex-col items-center gap-3 text-center transition-transform active:scale-95 hover:bg-secondary/10">
            <div className="w-10 h-10 bg-secondary/10 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-secondary" />
            </div>
            <span className="font-label-sm text-xs text-secondary">Danger sign</span>
          </button>
          <button className="bg-surface-container-lowest p-4 rounded-xl card-shadow border border-surface-container flex flex-col items-center gap-3 text-center transition-transform active:scale-95 hover:border-primary/20 hover:shadow-md">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-primary" />
            </div>
            <span className="font-label-sm text-xs text-on-surface">My records</span>
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
        <div className="font-headline-md text-xl font-bold text-primary mb-4">Mama Care AI</div>
        <p className="font-body-md text-sm text-outline tracking-wide leading-relaxed">
          © 2024 Mama Care AI. Safe pregnancies, every time. Partnered with UBTH.
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
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-surface-container z-50 px-6 py-3 pb-8">
        <div className="max-w-[640px] mx-auto flex justify-between items-center">
          <button onClick={() => navigate('/dashboard')} className="flex flex-col items-center gap-1">
            <Home className="w-5 h-5 text-primary" />
            <span className="text-[10px] font-label-sm text-primary">Home</span>
          </button>
          <button onClick={() => navigate('/appointments')} className="flex flex-col items-center gap-1 text-outline hover:text-primary transition-colors">
            <Calendar className="w-5 h-5" />
            <span className="text-[10px] font-label-sm">Appointments</span>
          </button>
          <button onClick={() => navigate('/education')} className="flex flex-col items-center gap-1 text-outline hover:text-primary transition-colors">
            <BookOpen className="w-5 h-5" />
            <span className="text-[10px] font-label-sm">Learn</span>
          </button>
          <button onClick={() => navigate('/profile')} className="flex flex-col items-center gap-1 text-outline hover:text-primary transition-colors">
            <User className="w-5 h-5" />
            <span className="text-[10px] font-label-sm">Profile</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default PatientDashboard;