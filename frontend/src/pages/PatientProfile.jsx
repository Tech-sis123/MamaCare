import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const PatientProfile = () => {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [lang, setLang] = useState('EN');

  const InfoRow = ({ label, value, icon }) => (
    <div className="flex items-center justify-between py-4 border-b border-outline-variant/20 last:border-0">
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-primary/60 text-base">{icon}</span>
        <span className="font-body-md text-on-surface-variant text-sm">{label}</span>
      </div>
      <span className="font-body-md text-on-surface font-medium">{value}</span>
    </div>
  );

  return (
    <div className="min-h-screen font-body-md text-on-surface">
      {/* Header */}
      <header className="bg-primary text-on-primary sticky top-0 z-40 px-6 py-4">
        <div className="max-w-[640px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="hover:bg-white/10 p-2 rounded-full transition-colors">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <h1 className="font-headline-md text-lg">My Profile</h1>
          </div>
          <button
            onClick={() => setEditing(!editing)}
            className="px-4 py-1.5 rounded-full border border-white/30 font-label-sm text-xs hover:bg-white/10 transition-all"
          >
            {editing ? 'Save' : 'Edit'}
          </button>
        </div>
      </header>

      <main className="max-w-[640px] mx-auto px-4 pb-40 space-y-6 pt-6">
        {/* Avatar + Name */}
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="w-24 h-24 rounded-full bg-tertiary-fixed flex items-center justify-center border-4 border-white shadow-lg">
            <span className="font-headline-md text-primary text-3xl">ME</span>
          </div>
          <div className="text-center">
            <h2 className="font-headline-md text-primary text-xl">Mama Efe</h2>
            <p className="font-body-md text-on-surface-variant text-sm mt-1">Patient ID: MCA-2025-0047</p>
            <div className="inline-flex items-center gap-2 mt-3 px-3 py-1 bg-tertiary-fixed rounded-full">
              <span className="material-symbols-outlined text-primary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              <span className="font-label-sm text-primary text-xs">UBTH Verified Patient</span>
            </div>
          </div>
        </div>

        {/* Pregnancy Status */}
        <section className="bg-primary rounded-xl p-6 text-white relative overflow-hidden">
          <div className="absolute right-4 top-4 opacity-10">
            <span className="material-symbols-outlined text-[80px]">pregnant_woman</span>
          </div>
          <p className="font-label-sm text-xs uppercase tracking-widest opacity-70 mb-2">Current Pregnancy</p>
          <h3 className="font-headline-md text-2xl mb-1">Week 12 of 40</h3>
          <p className="font-body-md text-white/80 text-sm">First Trimester · Low Risk</p>
          <div className="mt-4 bg-white/10 rounded-full h-1.5">
            <div className="bg-white/80 h-1.5 rounded-full" style={{ width: '30%' }} />
          </div>
          <div className="flex justify-between mt-2">
            <span className="font-label-sm text-[10px] opacity-60">Week 1</span>
            <span className="font-label-sm text-[10px] opacity-90">EDD: Nov 12, 2025</span>
          </div>
        </section>

        {/* Personal Info */}
        <section className="bg-white rounded-xl card-shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-outline-variant/20">
            <p className="font-label-sm text-on-surface-variant text-xs uppercase tracking-widest">Personal Information</p>
          </div>
          <div className="px-6">
            <InfoRow label="Full Name"    value="Efemena Okoye"        icon="person" />
            <InfoRow label="Date of Birth" value="March 14, 2000"      icon="cake" />
            <InfoRow label="Age"           value="25 years"            icon="today" />
            <InfoRow label="Phone"         value="+234 801 234 5678"   icon="phone" />
            <InfoRow label="Language"      value={lang}                icon="translate" />
            <InfoRow label="State"         value="Edo State, Nigeria"  icon="location_on" />
          </div>
        </section>

        {/* Health Info */}
        <section className="bg-white rounded-xl card-shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-outline-variant/20">
            <p className="font-label-sm text-on-surface-variant text-xs uppercase tracking-widest">Health Profile</p>
          </div>
          <div className="px-6">
            <InfoRow label="Blood Type"    value="O+"           icon="bloodtype" />
            <InfoRow label="Genotype"      value="AA"           icon="genetics" />
            <InfoRow label="Allergies"     value="None known"   icon="warning" />
            <InfoRow label="Risk Level"    value="Low Risk ✓"   icon="analytics" />
            <InfoRow label="Last Assessed" value="Today"        icon="schedule" />
          </div>
        </section>

        {/* Emergency Contact */}
        <section className="bg-white rounded-xl card-shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-outline-variant/20">
            <p className="font-label-sm text-on-surface-variant text-xs uppercase tracking-widest">Emergency Contact</p>
          </div>
          <div className="px-6">
            <InfoRow label="Name"         value="Chukwuemeka Okoye"  icon="person" />
            <InfoRow label="Relationship" value="Husband"            icon="favorite" />
            <InfoRow label="Phone"        value="+234 803 456 7890"  icon="phone" />
          </div>
        </section>

        {/* Language Preference */}
        <section className="bg-white rounded-xl card-shadow p-6">
          <p className="font-label-sm text-on-surface-variant text-xs uppercase tracking-widest mb-4">Language Preference</p>
          <div className="flex gap-3">
            {['EN', 'Pidgin'].map(l => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`flex-1 py-3 rounded-xl border-2 font-body-md font-medium transition-all ${
                  lang === l ? 'border-primary bg-tertiary-fixed text-primary' : 'border-outline-variant text-on-surface-variant hover:border-primary/30'
                }`}
              >
                {l === 'EN' ? '🇬🇧 English' : '🇳🇬 Pidgin'}
              </button>
            ))}
          </div>
        </section>

        {/* Assigned Clinic */}
        <section className="bg-white rounded-xl card-shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-outline-variant/20">
            <p className="font-label-sm text-on-surface-variant text-xs uppercase tracking-widest">Assigned Clinic</p>
          </div>
          <div className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-primary">local_hospital</span>
            </div>
            <div>
              <p className="font-body-md font-bold text-on-surface">ANC Clinic B</p>
              <p className="font-body-md text-on-surface-variant text-sm">University of Benin Teaching Hospital</p>
              <p className="font-label-sm text-outline text-xs mt-1">Dr. Adaeze Nwankwo · Obstetrician</p>
            </div>
          </div>
        </section>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={() => navigate('/intake')}
            className="w-full flex items-center gap-3 p-4 bg-white rounded-xl card-shadow border border-outline-variant/30 hover:border-primary/20 transition-all group"
          >
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <span className="material-symbols-outlined text-primary text-lg">refresh</span>
            </div>
            <span className="font-body-md flex-grow text-on-surface">Retake Health Assessment</span>
            <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors">chevron_right</span>
          </button>

          <button className="w-full flex items-center gap-3 p-4 bg-white rounded-xl card-shadow border border-outline-variant/30 hover:border-secondary/20 transition-all group text-secondary">
            <div className="w-10 h-10 bg-secondary/10 rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-secondary text-lg">logout</span>
            </div>
            <span className="font-body-md flex-grow">Sign Out</span>
            <span className="material-symbols-outlined text-secondary/50 group-hover:text-secondary transition-colors">chevron_right</span>
          </button>
        </div>
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-surface-container z-50 px-6 py-3 pb-8">
        <div className="max-w-[640px] mx-auto flex justify-between items-center">
          <button onClick={() => navigate('/dashboard')} className="flex flex-col items-center gap-1 text-outline hover:text-primary transition-colors">
            <span className="material-symbols-outlined">home</span>
            <span className="text-[10px] font-label-sm">Home</span>
          </button>
          <button onClick={() => navigate('/appointments')} className="flex flex-col items-center gap-1 text-outline hover:text-primary transition-colors">
            <span className="material-symbols-outlined">calendar_month</span>
            <span className="text-[10px] font-label-sm">Appointments</span>
          </button>
          <button onClick={() => navigate('/education')} className="flex flex-col items-center gap-1 text-outline hover:text-primary transition-colors">
            <span className="material-symbols-outlined">auto_stories</span>
            <span className="text-[10px] font-label-sm">Learn</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-primary">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
            <span className="text-[10px] font-label-sm text-primary">Profile</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default PatientProfile;
