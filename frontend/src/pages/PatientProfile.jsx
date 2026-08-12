import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPatientMe, setPatientCredentials, upsertProfile } from '../lib/api';
import { getPatientData, setPatientAuth, clearPatientAuth } from '../lib/auth';

const PatientProfile = () => {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [lang, setLang] = useState('EN');
  const [patient, setPatient] = useState(getPatientData());
  const [editForm, setEditForm] = useState({
    name: '',
    age: '',
    occupation: '',
    address: '',
    education_level: '',
    marital_status: '',
    religion: '',
    ethnicity: '',
  });
  const [needsPassword, setNeedsPassword] = useState(true);

  // Password Modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  useEffect(() => {
    getPatientMe()
      .then(r => {
        if (r.data) {
          setPatient(prev => ({ ...prev, ...r.data }));
          setEditForm({
            name: r.data.name || '',
            age: r.data.age || '',
            occupation: r.data.occupation || '',
            address: r.data.address || '',
            education_level: r.data.education_level || '',
            marital_status: r.data.marital_status || '',
            religion: r.data.religion || '',
            ethnicity: r.data.ethnicity || '',
          });
          if (r.data.has_password || r.data.password_hash) {
            setNeedsPassword(false);
          }
          if (r.data.email) {
            setPasswordForm(f => ({ ...f, email: r.data.email }));
          }
        }
      })
      .catch(() => {});
  }, []);

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!passwordForm.email || !passwordForm.email.includes('@')) {
      setPasswordError('Please enter a valid email address.');
      return;
    }
    if (passwordForm.password.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      return;
    }
    if (passwordForm.password !== passwordForm.confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    const token = localStorage.getItem('mc_patient_token');
    console.log('[SetPassword] Token present:', !!token);
    console.log('[SetPassword] Token preview:', token ? token.substring(0, 20) + '...' : 'NONE');
    console.log('[SetPassword] API base URL:', import.meta.env.VITE_API_URL || 'http://localhost:3000');

    setPasswordLoading(true);
    try {
      console.log('[SetPassword] Sending request to /auth/patient/credentials...');
      const { data } = await setPatientCredentials({
        email: passwordForm.email.trim(),
        password: passwordForm.password,
      });
      console.log('[SetPassword] ✅ Success:', data);

      setNeedsPassword(false);
      setPasswordSuccess('Password saved successfully!');
      if (data?.patient) {
        setPatient(prev => ({ ...prev, ...data.patient, has_password: true }));
        const existing = getPatientData();
        setPatientAuth(
          localStorage.getItem('mc_patient_token'),
          localStorage.getItem('mc_patient_refresh'),
          { ...existing, ...data.patient, has_password: true }
        );
      }
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordSuccess('');
        setPasswordForm(f => ({ ...f, password: '', confirmPassword: '' }));
      }, 1500);
    } catch (err) {
      console.error('[SetPassword] ❌ Error:', {
        message: err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        code: err.code,
        url: err.config?.url,
        baseURL: err.config?.baseURL,
        hasToken: !!err.config?.headers?.Authorization,
      });
      const msg = err.response?.data?.message || err.response?.data?.error || `Failed to save password (${err.code || err.response?.status || 'network error'}). Please try again.`;
      setPasswordError(msg);
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSignOut = () => {
    clearPatientAuth();
    navigate('/');
  };

  const handleEditChange = (key, val) => setEditForm(prev => ({ ...prev, [key]: val }));

  const saveProfile = async () => {
    try {
      const payload = {
        name: editForm.name || undefined,
        age: editForm.age !== '' && editForm.age != null ? Number(editForm.age) : undefined,
        occupation: editForm.occupation || undefined,
        address: editForm.address || undefined,
        education_level: editForm.education_level || undefined,
        marital_status: editForm.marital_status || undefined,
        religion: editForm.religion || undefined,
        ethnicity: editForm.ethnicity || undefined,
      };
      const { data } = await upsertProfile(payload);
      if (data?.patient) {
        setPatient(data.patient);
        const existing = JSON.parse(localStorage.getItem('mc_patient') || '{}');
        // update stored patient
        localStorage.setItem('mc_patient', JSON.stringify({ ...existing, ...data.patient }));
      }
      setEditing(false);
    } catch (err) {
      console.error('Failed to save profile', err);
      // keep editing state for user to retry
    }
  };

  const pregnancy = patient?.pregnancies?.[0] || patient?.pregnancy_record || patient?.latest_pregnancy;
  const weeks = patient?.current_ega?.weeks ?? pregnancy?.current_ega_weeks ?? pregnancy?.gestational_age?.weeks ?? 12;
  const eddVal = pregnancy?.edd_computed || pregnancy?.edd;
  const edd = eddVal ? new Date(eddVal).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Nov 12, 2025';
  const riskTier = patient?.risk_tier || 'Low Risk';
  const progress = Math.round((weeks / 40) * 100);

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
            <h2 className="font-headline-md text-primary text-xl">{patient?.name || 'Patient'}</h2>
            <p className="font-body-md text-on-surface-variant text-sm mt-1">
              Phone: {patient?.phone_number || '—'}
            </p>
            <div className="inline-flex items-center gap-2 mt-3 px-3 py-1 bg-tertiary-fixed rounded-full">
              <span className="material-symbols-outlined text-primary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              <span className="font-label-sm text-primary text-xs">Verified Patient</span>
            </div>
          </div>
        </div>

        {/* Pregnancy Status */}
        <section className="bg-primary rounded-xl p-6 text-white relative overflow-hidden">
          <div className="absolute right-4 top-4 opacity-10">
            <span className="material-symbols-outlined text-[80px]">pregnant_woman</span>
          </div>
          <p className="font-label-sm text-xs uppercase tracking-widest opacity-70 mb-2">Current Pregnancy</p>
          <h3 className="font-headline-md text-2xl mb-1">Week {weeks} of 40</h3>
          <p className="font-body-md text-white/80 text-sm">
            {weeks <= 12 ? 'First' : weeks <= 27 ? 'Second' : 'Third'} Trimester · {riskTier}
          </p>
          <div className="mt-4 bg-white/10 rounded-full h-1.5">
            <div className="bg-white/80 h-1.5 rounded-full" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-between mt-2">
            <span className="font-label-sm text-[10px] opacity-60">Week 1</span>
            <span className="font-label-sm text-[10px] opacity-90">EDD: {edd}</span>
          </div>
        </section>

        {/* Personal Info */}
        <section className="bg-white rounded-xl card-shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-outline-variant/20">
            <p className="font-label-sm text-on-surface-variant text-xs uppercase tracking-widest">Personal Information</p>
          </div>
          <div className="px-6">
            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className="font-label-sm text-xs text-on-surface-variant">Full name</label>
                  <input className="w-full px-3 py-2 rounded-xl border mt-1" value={editForm.name} onChange={e => handleEditChange('name', e.target.value)} />
                </div>
                <div>
                  <label className="font-label-sm text-xs text-on-surface-variant">Age</label>
                  <input type="number" min={10} max={60} className="w-full px-3 py-2 rounded-xl border mt-1" value={editForm.age} onChange={e => handleEditChange('age', e.target.value)} />
                </div>
                <div>
                  <label className="font-label-sm text-xs text-on-surface-variant">Phone</label>
                  <input className="w-full px-3 py-2 rounded-xl border mt-1" value={patient?.phone_number || ''} disabled />
                </div>
                <div>
                  <label className="font-label-sm text-xs text-on-surface-variant">Address</label>
                  <input className="w-full px-3 py-2 rounded-xl border mt-1" value={editForm.address} onChange={e => handleEditChange('address', e.target.value)} />
                </div>
                <div>
                  <label className="font-label-sm text-xs text-on-surface-variant">Occupation</label>
                  <input className="w-full px-3 py-2 rounded-xl border mt-1" value={editForm.occupation} onChange={e => handleEditChange('occupation', e.target.value)} />
                </div>
              </div>
            ) : (
              <>
                <InfoRow label="Full Name"    value={patient?.name || '—'}                             icon="person" />
                <InfoRow label="Age"           value={patient?.age ? `${patient.age} years` : '—'}      icon="today" />
                <InfoRow label="Phone"         value={patient?.phone_number || '—'}                     icon="phone" />
                <InfoRow label="Language"      value={lang}                                              icon="translate" />
                <InfoRow label="Address"       value={patient?.address || '—'}                          icon="location_on" />
                <InfoRow label="Occupation"    value={patient?.occupation || '—'}                       icon="work" />
              </>
            )}
          </div>
        </section>

        {/* Account Security */}
        <section className="bg-white rounded-xl card-shadow overflow-hidden border border-amber-500/20">
          <div className="px-6 py-4 border-b border-outline-variant/20">
            <p className="font-label-sm text-on-surface-variant text-xs uppercase tracking-widest">Account Security</p>
          </div>
          <div className="px-6 py-4 flex flex-col gap-4">
            <div className="flex items-start gap-4">
              <span className="material-symbols-outlined text-amber-600 mt-1">security</span>
              <div>
                <p className="font-body-md font-bold text-on-surface">Password</p>
                <p className="font-body-md text-on-surface-variant text-sm mt-0.5">
                  {needsPassword ? 'No password set. Login via OTP only.' : 'Password is set.'}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setPasswordError('');
                setPasswordSuccess('');
                setShowPasswordModal(true);
              }}
              className={`w-full py-3 rounded-xl font-label-sm text-sm border-2 transition-colors ${needsPassword ? 'bg-amber-100 border-amber-300 text-amber-800 hover:bg-amber-200' : 'bg-surface-container border-outline text-on-surface hover:bg-surface-container-high'}`}
            >
              {needsPassword ? 'Set Password' : 'Change Password'}
            </button>
          </div>
        </section>

        {/* Health Info */}
        <section className="bg-white rounded-xl card-shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-outline-variant/20">
            <p className="font-label-sm text-on-surface-variant text-xs uppercase tracking-widest">Health Profile</p>
          </div>
          <div className="px-6">
            <InfoRow label="Blood Group"   value={pregnancy?.blood_group || patient?.blood_group || '—'}  icon="bloodtype" />
            <InfoRow label="Rhesus"        value={pregnancy?.rhesus || patient?.rhesus || '—'}            icon="bloodtype" />
            <InfoRow label="Genotype"      value={pregnancy?.genotype || patient?.genotype || '—'}         icon="genetics" />
            <InfoRow label="PCV"           value={pregnancy?.pcv ? `${pregnancy.pcv}%` : patient?.pcv || '—'} icon="science" />
            <InfoRow label="Malaria Parasite (MP)" value={pregnancy?.mp || patient?.mp || '—'}             icon="bug_report" />
            <InfoRow label="Risk Level"    value={riskTier}                                                icon="analytics" />
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
              <p className="font-body-md text-on-surface-variant text-sm">Partner Hospitals</p>
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

          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 p-4 bg-white rounded-xl card-shadow border border-outline-variant/30 hover:border-secondary/20 transition-all group text-secondary"
          >
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
      {/* Set/Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-outline-variant/30 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">security</span>
                <h3 className="font-headline-md text-lg text-on-surface">
                  {needsPassword ? 'Set Account Password' : 'Change Password'}
                </h3>
              </div>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <p className="font-body-md text-xs text-on-surface-variant">
              {needsPassword
                ? 'Set an email and password to log in easily from any device without waiting for SMS OTP.'
                : 'Update your account login email and password.'}
            </p>

            {passwordError && (
              <div className="p-3 bg-error/10 border border-error/20 rounded-xl text-error text-xs font-body-md flex items-center gap-2">
                <span className="material-symbols-outlined text-base">error</span>
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl text-primary text-xs font-body-md flex items-center gap-2">
                <span className="material-symbols-outlined text-base">check_circle</span>
                <span>{passwordSuccess}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-3 pt-1">
              <div>
                <label className="block font-label-sm text-xs text-on-surface-variant mb-1">
                  Login Email <span className="text-error">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. mama@example.com"
                  value={passwordForm.email}
                  onChange={e => setPasswordForm({ ...passwordForm, email: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-outline-variant text-sm focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <div>
                <label className="block font-label-sm text-xs text-on-surface-variant mb-1">
                  New Password <span className="text-error">*</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="Min 6 characters"
                  value={passwordForm.password}
                  onChange={e => setPasswordForm({ ...passwordForm, password: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-outline-variant text-sm focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <div>
                <label className="block font-label-sm text-xs text-on-surface-variant mb-1">
                  Confirm Password <span className="text-error">*</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="Re-enter password"
                  value={passwordForm.confirmPassword}
                  onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-outline-variant text-sm focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-label-sm text-on-surface-variant hover:bg-surface-container transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-label-sm hover:bg-primary/90 disabled:opacity-50 transition-all shadow-sm"
                >
                  {passwordLoading ? 'Saving...' : 'Save Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientProfile;
