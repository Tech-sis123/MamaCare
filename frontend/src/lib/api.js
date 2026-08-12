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
  async err => {
    if (err.response?.status === 401) {
      const refresh = localStorage.getItem('mc_patient_refresh');
      if (refresh) {
        try {
          // Attempt token refresh
          const { data } = await axios.post(`${BASE}/auth/refresh`, { refresh_token: refresh });
          if (data?.access_token) {
            localStorage.setItem('mc_patient_token', data.access_token);
            if (data.refresh_token) localStorage.setItem('mc_patient_refresh', data.refresh_token);
            // Retry original request with new token
            err.config.headers.Authorization = `Bearer ${data.access_token}`;
            return axios(err.config);
          }
        } catch (e) {
          // fallthrough to logout
        }
      }
      clearPatientAuth();
      window.location.href = '/register';
    }
    return Promise.reject(err);
  }
);

doctorApi.interceptors.response.use(
  res => res,
  async err => {
    if (err.response?.status === 401) {
      const refresh = localStorage.getItem('mc_doctor_refresh');
      if (refresh) {
        try {
          const { data } = await axios.post(`${BASE}/auth/refresh`, { refresh_token: refresh });
          if (data?.access_token) {
            localStorage.setItem('mc_doctor_token', data.access_token);
            if (data.refresh_token) localStorage.setItem('mc_doctor_refresh', data.refresh_token);
            err.config.headers.Authorization = `Bearer ${data.access_token}`;
            return axios(err.config);
          }
        } catch (e) {
          // fallthrough to logout
        }
      }
      clearDoctorAuth();
      window.location.href = '/provider';
    }
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────

export const requestOtp = (phone_number, channel = 'sms') =>
  axios.post(`${BASE}/auth/patient/otp/request`, { phone_number, channel });

export const verifyOtp = (pin_id, code) =>
  axios.post(`${BASE}/auth/patient/otp/verify`, { pin_id, code });

/** After OTP sign-up: set email + password for future logins (no OTP). */
export const setPatientCredentials = (data) =>
  patientApi.post('/auth/patient/credentials', data);

/** Returning patients: email + password login (no OTP). */
export const patientLogin = (email, password) =>
  axios.post(`${BASE}/auth/patient/login`, { email, password });

/** Direct email + password signup (no OTP). */
export const registerPatientEmail = (email, password, name) =>
  axios.post(`${BASE}/auth/patient/register-email`, { email, password, name });

export const doctorLogin = (email, password) =>
  axios.post(`${BASE}/auth/doctor/login`, { email, password });

export const registerDoctor = (data) =>
  axios.post(`${BASE}/auth/doctor/register`, data);

export const recoverDoctorPassword = (email) =>
  axios.post(`${BASE}/auth/doctor/forgot-password`, { email });

export const resetDoctorPassword = (token, new_password) =>
  axios.post(`${BASE}/auth/doctor/reset-password`, { token, new_password });

// ── Patient ───────────────────────────────────────────────────────────────────

export const getPatientMe = () => patientApi.get('/patients/me');
export const getPatientDashboard = () => patientApi.get('/patients/me/dashboard');
export const upsertProfile = data => patientApi.post('/patients/profile', data);
export const addPregnancy = data => patientApi.post('/patients/pregnancy', data);

// ── Intake ────────────────────────────────────────────────────────────────────

export const getIntake = patientId =>
  patientApi.get(`/intake/${patientId}`);

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

export const getDoctorPatientDetail = (patientId) =>
  doctorApi.get(`/providers/patients/${patientId}`);

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

// ── AI Assistant ──────────────────────────────────────────────────────────────

export const askPatientAI = (question) =>
  patientApi.post('/patients/me/ask', { question });

export const askDoctorAI = (question, patient_id) =>
  doctorApi.post('/providers/ask', patient_id ? { question, patient_id } : { question });
