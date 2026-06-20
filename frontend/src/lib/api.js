import axios from 'axios';
import { getPatientToken, getDoctorToken, clearPatientAuth, clearDoctorAuth } from './auth';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const patientApi = axios.create({ baseURL: BASE });
export const doctorApi = axios.create({ baseURL: BASE });

patientApi.interceptors.request.use(cfg => {
  const token = getPatientToken();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

doctorApi.interceptors.request.use(cfg => {
  const token = getDoctorToken();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Auto-logout on 401 — stale or wrong-env token
patientApi.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      clearPatientAuth();
      window.location.href = '/register';
    }
    return Promise.reject(err);
  }
);

doctorApi.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      clearDoctorAuth();
      window.location.href = '/provider';
    }
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────

export const requestOtp = phone_number =>
  axios.post(`${BASE}/auth/patient/otp/request`, { phone_number });

export const verifyOtp = (pin_id, code) =>
  axios.post(`${BASE}/auth/patient/otp/verify`, { pin_id, code });

export const doctorLogin = (email, password) =>
  axios.post(`${BASE}/auth/doctor/login`, { email, password });

// ── Patient ───────────────────────────────────────────────────────────────────

export const getPatientMe = () => patientApi.get('/patients/me');
export const getPatientDashboard = () => patientApi.get('/patients/me/dashboard');
export const upsertProfile = data => patientApi.post('/patients/profile', data);
export const addPregnancy = data => patientApi.post('/patients/pregnancy', data);

// ── Intake ────────────────────────────────────────────────────────────────────

export const saveIntake = (patientId, domain, responses) =>
  patientApi.patch(`/intake/${patientId}`, { domain, responses });

export const submitIntake = patientId =>
  patientApi.post(`/intake/${patientId}/submit`);

// ── Symptoms ──────────────────────────────────────────────────────────────────

export const logSymptoms = symptoms =>
  patientApi.post(
    '/symptoms',
    { symptoms },
    { headers: { 'Idempotency-Key': crypto.randomUUID() } }
  );

// ── Providers ─────────────────────────────────────────────────────────────────

export const getProviders = () => patientApi.get('/providers');

// ── Doctor ────────────────────────────────────────────────────────────────────

export const getDoctorQueue = (date) =>
  doctorApi.get('/providers/queue', date ? { params: { date } } : {});

export const getPatientSummary = (patientId) =>
  doctorApi.get(`/providers/patients/${patientId}/summary`);

export const saveVisitNotes = (appointmentId, doctor_notes) =>
  doctorApi.post(`/visits/${appointmentId}/notes`, { doctor_notes });

export const searchPatients = (q = '') =>
  doctorApi.get('/providers/patients', { params: { q } });

export const getPatientSymptoms = (patientId, range = '30d') =>
  doctorApi.get(`/patients/${patientId}/symptoms`, { params: { range } });

export const acknowledgeAlert = alertId =>
  doctorApi.post(`/alerts/${alertId}/acknowledge`);

// ── Appointments ──────────────────────────────────────────────────────────────

export const getAvailableSlots = (date, doctor_id) =>
  patientApi.get('/appointments/available', { params: { date, doctor_id } });

export const bookAppointment = (doctor_id, slot_start) =>
  patientApi.post(
    '/appointments',
    { doctor_id, slot_start },
    { headers: { 'Idempotency-Key': crypto.randomUUID() } }
  );

// ── Education ─────────────────────────────────────────────────────────────────

export const getEducationModules = () => patientApi.get('/education/modules');

export const markModuleComplete = module_id =>
  patientApi.patch('/education/progress', { module_id });
