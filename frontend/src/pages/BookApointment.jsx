import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { bookAppointment } from '../lib/api';

const buildSlotStart = (day, timeStr) => {
  const [timePart, period] = timeStr.split(' ');
  let [h, m] = timePart.split(':').map(Number);
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), day, h, m).toISOString();
};

const BookAppointment = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedDate, setSelectedDate] = useState(15);
  const [selectedTime, setSelectedTime] = useState('10:30 AM');
  const [showSuccess, setShowSuccess] = useState(false);
  const [reminderMethod, setReminderMethod] = useState('SMS');
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [bookingRef, setBookingRef] = useState('');

  const dates = [
    { day: 29, enabled: false, currentMonth: false },
    { day: 30, enabled: false, currentMonth: false },
    { day: 1, enabled: true, currentMonth: true },
    { day: 2, enabled: true, currentMonth: true },
    { day: 3, enabled: true, currentMonth: true },
    { day: 4, enabled: false, currentMonth: true, disabled: true },
    { day: 5, enabled: false, currentMonth: true, disabled: true },
    { day: 6, enabled: true, currentMonth: true },
    { day: 7, enabled: true, currentMonth: true },
    { day: 8, enabled: true, currentMonth: true },
    { day: 9, enabled: true, currentMonth: true },
    { day: 10, enabled: true, currentMonth: true },
    { day: 11, enabled: false, currentMonth: true, disabled: true },
    { day: 12, enabled: false, currentMonth: true, disabled: true },
    { day: 13, enabled: true, currentMonth: true },
    { day: 14, enabled: true, currentMonth: true },
    { day: 15, enabled: true, currentMonth: true, active: true },
    { day: 16, enabled: true, currentMonth: true },
    { day: 17, enabled: true, currentMonth: true },
    { day: 18, enabled: false, currentMonth: true, disabled: true },
    { day: 19, enabled: false, currentMonth: true, disabled: true },
  ];

  const timeSlots = [
    { time: '08:00 AM', available: false, full: true },
    { time: '09:15 AM', available: true, full: false },
    { time: '10:30 AM', available: true, full: false, active: true },
    { time: '11:45 AM', available: true, full: false },
    { time: '01:00 PM', available: true, full: false },
    { time: '02:15 PM', available: false, full: true },
    { time: '03:30 PM', available: true, full: false },
    { time: '04:00 PM', available: true, full: false },
  ];

  const handleConfirmAppointment = async () => {
    setLoading(true);
    setApiError('');
    try {
      const slot_start = buildSlotStart(selectedDate, selectedTime);
      const doctor_id = location.state?.doctor_id || undefined;
      const { data } = await bookAppointment(doctor_id, slot_start);
      setBookingRef(data?.id || data?.reference || '');
      setShowSuccess(true);
    } catch (err) {
      setApiError(err.response?.data?.message || 'Failed to book appointment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCalendar = () => {
    alert('Added to calendar');
  };

  const handleShare = () => {
    alert('Share appointment details');
  };

  const handleHome = () => {
    setShowSuccess(false);
    navigate('/dashboard');
  };

  const formatDate = (day) => {
    return `Wed, 15 May • ${selectedTime}`;
  };

  return (
    <div className="font-body-md text-on-background selection:bg-primary-fixed selection:text-on-primary-fixed">
      <div className="grain-overlay"></div>

      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-primary text-on-primary px-6 py-4 flex items-center gap-4 shadow-lg">
        <button onClick={() => navigate(-1)} className="hover:bg-primary-container/20 p-2 rounded-full transition-colors">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="font-headline-md text-headline-md tracking-tight">Book Appointment</h1>
      </header>

      {/* Main Content Canvas */}
      <main className="max-w-[600px] mx-auto px-6 py-12 space-y-12">
        {/* Step 1: Pick a Date */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">1</span>
            <h2 className="font-headline-md text-headline-md text-primary">Pick a Date</h2>
          </div>
          <div className="bg-surface-container-lowest p-6 rounded-xl shadow-[0_2px_16px_rgba(158,110,0,0.08)] border border-outline-variant/30">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-headline-md text-xl text-tertiary">May 2024</h3>
              <div className="flex gap-2">
                <button className="p-2 text-primary hover:bg-primary/5 rounded-lg">
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>
                <button className="p-2 text-primary hover:bg-primary/5 rounded-lg">
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-2 mb-2 text-center text-label-sm font-label-sm text-outline">
              <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span>
              <span className="text-error/40">S</span><span className="text-error/40">S</span>
            </div>
            <div className="grid grid-cols-7 gap-2 text-center">
              {dates.map((date, idx) => (
                <button
                  key={idx}
                  disabled={!date.enabled}
                  className={`p-3 font-medium transition-all ${
                    date.disabled
                      ? 'text-outline/30 font-label-sm italic cursor-not-allowed'
                      : date.active
                      ? 'font-bold bg-primary text-on-primary rounded-full shadow-lg transform scale-110'
                      : 'hover:bg-primary-fixed-dim rounded-full'
                  }`}
                >
                  {date.day}
                </button>
              ))}
            </div>
            <div className="mt-6 flex items-start gap-2 bg-primary/5 p-4 rounded-lg border border-primary/10">
              <span className="material-symbols-outlined text-primary text-sm mt-0.5">info</span>
              <p className="text-label-sm font-label-sm text-primary/80">
                Appointments available Monday–Friday at UBTH ANC Clinic
              </p>
            </div>
          </div>
        </section>

        {/* Step 2: Pick a Time */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">2</span>
            <h2 className="font-headline-md text-headline-md text-primary">Pick a Time</h2>
          </div>

          {/* Priority Alert */}
          <div className="bg-secondary text-on-secondary p-4 rounded-xl flex items-center gap-4 shadow-md">
            <div className="bg-white/20 p-2 rounded-full">
              <span className="material-symbols-outlined">priority_high</span>
            </div>
            <div>
              <p className="font-bold text-sm">Priority slots for HIGH RISK patients</p>
              <p className="text-xs opacity-90">Please call 08012345678 if urgent</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {timeSlots.map((slot, idx) => (
              <button
                key={idx}
                onClick={() => !slot.full && setSelectedTime(slot.time)}
                disabled={!slot.available}
                className={`py-4 px-2 rounded-lg border-2 transition-all flex flex-col items-center ${
                  slot.full
                    ? 'border-outline-variant bg-surface-container-high text-outline cursor-not-allowed line-through opacity-60'
                    : slot.active || (!slot.full && selectedTime === slot.time)
                    ? 'border-primary bg-primary text-on-primary shadow-md'
                    : 'border-primary/20 hover:border-primary hover:bg-primary/5'
                }`}
              >
                <span className={`text-xs font-bold ${slot.full ? '' : slot.active || selectedTime === slot.time ? 'text-on-primary' : 'text-primary'}`}>
                  {slot.time}
                </span>
                {slot.full && <span className="text-[10px] uppercase">Full</span>}
              </button>
            ))}
          </div>
        </section>

        {/* Step 3: Confirmation Review */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">3</span>
            <h2 className="font-headline-md text-headline-md text-primary">Review Details</h2>
          </div>
          <div className="bg-white p-8 rounded-2xl border border-primary/10 shadow-[0_4px_24px_rgba(158,110,0,0.06)] relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <span className="material-symbols-outlined text-6xl">verified_user</span>
            </div>
            <div className="space-y-6 relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined">event</span>
                </div>
                <div>
                  <p className="text-label-sm font-label-sm text-outline uppercase tracking-widest">Date &amp; Time</p>
                  <p className="font-headline-md text-xl text-tertiary">
                    Wed, 15 May • {selectedTime}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined">location_on</span>
                </div>
                <div>
                  <p className="text-label-sm font-label-sm text-outline uppercase tracking-widest">Clinic Location</p>
                  <p className="font-headline-md text-xl text-tertiary">ANC Clinic B, UBTH</p>
                </div>
              </div>
              <div className="pt-6 border-t border-dashed border-outline-variant">
                <p className="font-label-sm text-label-sm text-outline mb-3">Send reminders via:</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setReminderMethod('SMS')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold shadow-sm ${
                      reminderMethod === 'SMS'
                        ? 'bg-primary text-white'
                        : 'bg-surface-container-high text-primary'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">
                      {reminderMethod === 'SMS' ? 'check_circle' : 'add_circle'}
                    </span>
                    SMS
                  </button>
                  <button
                    onClick={() => setReminderMethod('WhatsApp')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${
                      reminderMethod === 'WhatsApp'
                        ? 'bg-primary text-white'
                        : 'bg-surface-container-high text-primary'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">
                      {reminderMethod === 'WhatsApp' ? 'check_circle' : 'add_circle'}
                    </span>
                    WhatsApp
                  </button>
                </div>
              </div>
            </div>
          </div>
          {apiError && (
            <p className="text-secondary font-label-sm text-sm text-center">{apiError}</p>
          )}
          <button
            onClick={handleConfirmAppointment}
            disabled={loading}
            className="w-full bg-primary text-on-primary font-headline-md text-xl py-6 rounded-xl shadow-xl hover:bg-primary/95 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-60"
          >
            {loading ? 'Booking…' : 'Confirm appointment'}
            {!loading && <span className="material-symbols-outlined">arrow_forward</span>}
          </button>
        </section>
      </main>

      {/* Success Modal Overlay */}
      {showSuccess && (
        <div className="fixed inset-0 bg-surface-container-low/95 backdrop-blur-xl z-[100] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white p-10 rounded-[40px] text-center shadow-2xl border border-primary/5 space-y-8">
            <div className="w-24 h-24 bg-primary text-on-primary rounded-full mx-auto flex items-center justify-center shadow-lg transform transition-transform animate-bounce">
              <span className="material-symbols-outlined text-5xl">check_circle</span>
            </div>
            <div className="space-y-2">
              <h2 className="font-headline-lg text-display-xl text-primary">You're booked!</h2>
              <p className="text-on-surface-variant font-body-lg">Check your SMS for confirmation details.</p>
            </div>
            <div className="bg-surface-container py-4 px-6 rounded-2xl border border-outline-variant/30">
              <p className="text-label-sm font-label-sm text-outline uppercase mb-1">Reference Number</p>
              <p className="font-mono text-lg font-bold text-tertiary tracking-widest">
                {bookingRef || 'MCA-' + Date.now().toString().slice(-8)}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <button
                onClick={handleAddToCalendar}
                className="w-full py-4 bg-primary text-on-primary rounded-xl font-bold flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined">calendar_add_on</span>
                Add to calendar
              </button>
              <div className="flex gap-4">
                <button
                  onClick={handleShare}
                  className="flex-1 py-4 bg-surface-container-high text-primary rounded-xl font-bold flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined">share</span>
                  Share
                </button>
                <button
                  onClick={handleHome}
                  className="flex-1 py-4 border-2 border-primary text-primary rounded-xl font-bold flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined">home</span>
                  Home
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-stone-50 border-t border-amber-900/10 w-full">
        <div className="flex flex-col md:flex-row justify-between items-center w-full px-8 py-16 max-w-7xl mx-auto gap-8">
          <div className="text-xl font-serif font-bold text-amber-900">Mama Care AI</div>
          <div className="flex flex-wrap justify-center gap-6">
            <a href="#" className="font-serif text-sm tracking-wide text-stone-500 hover:text-amber-700 underline underline-offset-4">
              How it works
            </a>
            <a href="#" className="font-serif text-sm tracking-wide text-stone-500 hover:text-amber-700 underline underline-offset-4">
              For Providers
            </a>
            <a href="#" className="font-serif text-sm tracking-wide text-stone-500 hover:text-amber-700 underline underline-offset-4">
              About
            </a>
            <a href="#" className="font-serif text-sm tracking-wide text-stone-500 hover:text-amber-700 underline underline-offset-4">
              Privacy Policy
            </a>
            <a href="#" className="font-serif text-sm tracking-wide text-stone-500 hover:text-amber-700 underline underline-offset-4">
              Terms
            </a>
          </div>
          <p className="font-serif text-sm tracking-wide text-amber-900 text-center md:text-right opacity-70">
            © 2024 Mama Care AI. Safe pregnancies, every time. Partnered with UBTH.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default BookAppointment;