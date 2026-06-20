import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, ChevronLeft, ChevronRight,
  Info, AlertTriangle, ShieldCheck, Calendar, MapPin,
  CheckCircle2, PlusCircle, CheckCircle, Home,
} from 'lucide-react';
import { bookAppointment, getProviders, getPatientMe } from '../lib/api';

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const DAY_NAMES = ['M','T','W','T','F','S','S'];

const buildSlotStart = (year, month, day, timeStr) => {
  const [timePart, period] = timeStr.split(' ');
  let [h, m] = timePart.split(':').map(Number);
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return new Date(year, month, day, h, m).toISOString();
};

const generateCalendar = (year, month) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7;

  const cells = [];
  for (let i = startOffset - 1; i >= 0; i--) {
    cells.push({ day: prevMonthDays - i, currentMonth: false, enabled: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const dow = date.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const isPast = date < today;
    cells.push({ day: d, currentMonth: true, enabled: !isWeekend && !isPast });
  }
  const trailing = cells.length % 7 === 0 ? 0 : 7 - (cells.length % 7);
  for (let d = 1; d <= trailing; d++) {
    cells.push({ day: d, currentMonth: false, enabled: false });
  }
  return cells;
};

const formatSelectedDate = (year, month, day, time) => {
  if (!day) return '';
  const date = new Date(year, month, day);
  const dayName = date.toLocaleString('default', { weekday: 'short' });
  return `${dayName}, ${day} ${MONTH_NAMES[month]} • ${time}`;
};

const BookAppointment = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState('10:30 AM');
  const [showSuccess, setShowSuccess] = useState(false);
  const [reminderMethod, setReminderMethod] = useState('SMS');
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [bookingRef, setBookingRef] = useState('');
  const [defaultDoctorId, setDefaultDoctorId] = useState(null);

  useEffect(() => {
    if (location.state?.doctor_id) return;
    getProviders()
      .then(({ data }) => {
        if (data.doctors?.length > 0) setDefaultDoctorId(data.doctors[0].id);
      })
      .catch(() => {
        getPatientMe()
          .then(({ data }) => {
            if (data.primary_doctor_id) setDefaultDoctorId(data.primary_doctor_id);
          })
          .catch(() => {});
      });
  }, []);

  const dates = generateCalendar(calYear, calMonth);

  const goToPrevMonth = () => {
    setSelectedDate(null);
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  };
  const goToNextMonth = () => {
    setSelectedDate(null);
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  };

  const timeSlots = [
    { time: '08:00 AM', full: true },
    { time: '09:15 AM', full: false },
    { time: '10:30 AM', full: false },
    { time: '11:45 AM', full: false },
    { time: '01:00 PM', full: false },
    { time: '02:15 PM', full: true },
    { time: '03:30 PM', full: false },
    { time: '04:00 PM', full: false },
  ];

  const handleConfirmAppointment = async () => {
    if (!selectedDate) {
      setApiError('Please select a date first.');
      return;
    }
    setLoading(true);
    setApiError('');
    try {
      const slot_start = buildSlotStart(calYear, calMonth, selectedDate, selectedTime);
      const doctor_id = location.state?.doctor_id || defaultDoctorId;
      if (!doctor_id) {
        setApiError('No doctor available. Please try again later.');
        setLoading(false);
        return;
      }
      const { data } = await bookAppointment(doctor_id, slot_start);
      setBookingRef(data?.appointment?.id || data?.id || '');
      setShowSuccess(true);
    } catch (err) {
      setApiError(err.response?.data?.message || err.response?.data?.error || 'Failed to book appointment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleHome = () => {
    setShowSuccess(false);
    navigate('/dashboard');
  };

  return (
    <div className="font-body-md text-on-background selection:bg-primary-fixed selection:text-on-primary-fixed">

      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-primary text-on-primary px-6 py-4 flex items-center gap-4 shadow-lg">
        <button onClick={() => navigate(-1)} className="hover:bg-primary-container/20 p-2 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-headline-md text-headline-md tracking-tight">Book Appointment</h1>
      </header>

      <main className="max-w-[600px] mx-auto px-6 py-12 pb-28 space-y-12">
        {/* Step 1: Pick a Date */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">1</span>
            <h2 className="font-headline-md text-headline-md text-primary">Pick a Date</h2>
          </div>
          <div className="bg-surface-container-lowest p-6 rounded-xl shadow-[0_2px_16px_rgba(158,110,0,0.08)] border border-outline-variant/30">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-headline-md text-xl text-tertiary">
                {MONTH_NAMES[calMonth]} {calYear}
              </h3>
              <div className="flex gap-2">
                <button onClick={goToPrevMonth} className="p-2 text-primary hover:bg-primary/5 rounded-lg">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button onClick={goToNextMonth} className="p-2 text-primary hover:bg-primary/5 rounded-lg">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-2 mb-2 text-center text-label-sm font-label-sm text-outline">
              {DAY_NAMES.map((d, i) => (
                <span key={i} className={i >= 5 ? 'text-error/40' : ''}>{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2 text-center">
              {dates.map((date, idx) => (
                <button
                  key={idx}
                  disabled={!date.enabled}
                  onClick={() => date.enabled && setSelectedDate(date.day)}
                  className={`p-3 font-medium transition-all rounded-full ${
                    !date.currentMonth
                      ? 'text-outline/20 cursor-default'
                      : !date.enabled
                      ? 'text-outline/30 cursor-not-allowed'
                      : selectedDate === date.day
                      ? 'font-bold bg-primary text-on-primary shadow-lg scale-110'
                      : 'hover:bg-primary/10 cursor-pointer'
                  }`}
                >
                  {date.day}
                </button>
              ))}
            </div>
            <div className="mt-6 flex items-start gap-2 bg-primary/5 p-4 rounded-lg border border-primary/10">
              <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
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
          <div className="bg-secondary text-on-secondary p-4 rounded-xl flex items-center gap-4 shadow-md">
            <div className="bg-white/20 p-2 rounded-full">
              <AlertTriangle className="w-5 h-5" />
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
                disabled={slot.full}
                className={`py-4 px-2 rounded-lg border-2 transition-all flex flex-col items-center ${
                  slot.full
                    ? 'border-outline-variant bg-surface-container-high text-outline cursor-not-allowed line-through opacity-60'
                    : selectedTime === slot.time
                    ? 'border-primary bg-primary text-on-primary shadow-md'
                    : 'border-primary/20 hover:border-primary hover:bg-primary/5'
                }`}
              >
                <span className={`text-xs font-bold ${slot.full ? '' : selectedTime === slot.time ? 'text-on-primary' : 'text-primary'}`}>
                  {slot.time}
                </span>
                {slot.full && <span className="text-[10px] uppercase">Full</span>}
              </button>
            ))}
          </div>
        </section>

        {/* Step 3: Review */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">3</span>
            <h2 className="font-headline-md text-headline-md text-primary">Review Details</h2>
          </div>
          <div className="bg-white p-8 rounded-2xl border border-primary/10 shadow-[0_4px_24px_rgba(158,110,0,0.06)] relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <ShieldCheck className="w-16 h-16" />
            </div>
            <div className="space-y-6 relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-label-sm font-label-sm text-outline uppercase tracking-widest">Date &amp; Time</p>
                  <p className="font-headline-md text-xl text-tertiary">
                    {selectedDate
                      ? formatSelectedDate(calYear, calMonth, selectedDate, selectedTime)
                      : <span className="text-outline/60 text-base italic">Select a date above</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-label-sm font-label-sm text-outline uppercase tracking-widest">Clinic Location</p>
                  <p className="font-headline-md text-xl text-tertiary">ANC Clinic B, UBTH</p>
                </div>
              </div>
              <div className="pt-6 border-t border-dashed border-outline-variant">
                <p className="font-label-sm text-label-sm text-outline mb-3">Send reminders via:</p>
                <div className="flex gap-3">
                  {['SMS', 'WhatsApp'].map(method => (
                    <button
                      key={method}
                      onClick={() => setReminderMethod(method)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold shadow-sm ${
                        reminderMethod === method ? 'bg-primary text-white' : 'bg-surface-container-high text-primary'
                      }`}
                    >
                      {reminderMethod === method
                        ? <CheckCircle2 className="w-4 h-4" />
                        : <PlusCircle className="w-4 h-4" />}
                      {method}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {apiError && (
            <p className="text-secondary font-label-sm text-sm text-center">{apiError}</p>
          )}
          <button
            onClick={handleConfirmAppointment}
            disabled={loading || !selectedDate}
            className="w-full bg-primary text-on-primary font-headline-md text-xl py-6 rounded-xl shadow-xl hover:bg-primary/95 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-60"
          >
            {loading ? 'Booking…' : 'Confirm appointment'}
            {!loading && <ArrowRight className="w-5 h-5" />}
          </button>
        </section>
      </main>

      {/* Success Modal */}
      {showSuccess && (
        <div className="fixed inset-0 bg-surface-container-low/95 backdrop-blur-xl z-[100] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white p-10 rounded-[40px] text-center shadow-2xl border border-primary/5 space-y-8">
            <div className="w-24 h-24 bg-primary text-on-primary rounded-full mx-auto flex items-center justify-center shadow-lg">
              <CheckCircle className="w-12 h-12" />
            </div>
            <div className="space-y-2">
              <h2 className="font-headline-lg text-display-xl text-primary">You're booked!</h2>
              <p className="text-on-surface-variant font-body-lg">
                {formatSelectedDate(calYear, calMonth, selectedDate, selectedTime)}
              </p>
              <p className="text-on-surface-variant font-body-lg text-sm">Check your SMS for confirmation details.</p>
            </div>
            <div className="bg-surface-container py-4 px-6 rounded-2xl border border-outline-variant/30">
              <p className="text-label-sm font-label-sm text-outline uppercase mb-1">Reference Number</p>
              <p className="font-mono text-lg font-bold text-tertiary tracking-widest">
                {bookingRef ? bookingRef.slice(0, 8).toUpperCase() : 'MCA-' + Date.now().toString().slice(-8)}
              </p>
            </div>
            <button
              onClick={handleHome}
              className="w-full py-4 bg-primary text-on-primary rounded-xl font-bold flex items-center justify-center gap-2"
            >
              <Home className="w-5 h-5" />
              Go to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-surface-container z-50 px-6 py-3 pb-8">
        <div className="max-w-[640px] mx-auto flex justify-between items-center">
          <button onClick={() => navigate('/dashboard')} className="flex flex-col items-center gap-1 text-outline">
            <span className="material-symbols-outlined">home</span>
            <span className="text-[10px] font-label-sm">Home</span>
          </button>
          <button onClick={() => navigate('/appointments')} className="flex flex-col items-center gap-1 text-primary">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>calendar_month</span>
            <span className="text-[10px] font-label-sm font-bold">Appointments</span>
          </button>
          <button onClick={() => navigate('/education')} className="flex flex-col items-center gap-1 text-outline">
            <span className="material-symbols-outlined">auto_stories</span>
            <span className="text-[10px] font-label-sm">Learn</span>
          </button>
          <button onClick={() => navigate('/profile')} className="flex flex-col items-center gap-1 text-outline">
            <span className="material-symbols-outlined">person</span>
            <span className="text-[10px] font-label-sm">Profile</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default BookAppointment;
