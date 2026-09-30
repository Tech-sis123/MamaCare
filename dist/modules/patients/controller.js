"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.patientsController = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const errors_1 = require("../../utils/errors");
const ega_calculator_1 = require("../../services/ega-calculator");
const ai_1 = require("../../services/ai");
const site_visits_1 = require("../../services/site-visits");
const contact_1 = require("../../utils/contact");
const env_1 = require("../../config/env");
exports.patientsController = {
    /**
     * POST /patients/profile — create or update biodata
     */
    async upsertProfile(req, res, next) {
        try {
            const patientId = req.user.id;
            const data = req.body;
            const before = await prisma_1.default.patient.findUnique({ where: { id: patientId } });
            if (!before)
                throw new errors_1.NotFoundError('Patient not found');
            // Only set defined fields so partial updates never wipe columns with undefined
            const dataUpdate = {};
            if (data.name != null)
                dataUpdate.name = data.name;
            if (data.age != null)
                dataUpdate.age = data.age;
            if (data.education_level !== undefined)
                dataUpdate.education_level = data.education_level;
            if (data.occupation !== undefined)
                dataUpdate.occupation = data.occupation;
            if (data.marital_status !== undefined)
                dataUpdate.marital_status = data.marital_status;
            if (data.address !== undefined)
                dataUpdate.address = data.address;
            if (data.religion !== undefined)
                dataUpdate.religion = data.religion;
            if (data.ethnicity !== undefined)
                dataUpdate.ethnicity = data.ethnicity;
            if (data.language_preference !== undefined)
                dataUpdate.language_preference = data.language_preference;
            if (data.emergency_contact_name !== undefined) {
                dataUpdate.emergency_contact_name = data.emergency_contact_name;
            }
            if (data.emergency_contact_relationship !== undefined) {
                dataUpdate.emergency_contact_relationship = data.emergency_contact_relationship;
            }
            if (data.emergency_contact_phone !== undefined) {
                dataUpdate.emergency_contact_phone = data.emergency_contact_phone;
            }
            const patient = await prisma_1.default.patient.update({
                where: { id: patientId },
                data: dataUpdate,
            });
            // Audit log
            await prisma_1.default.auditLog.create({
                data: {
                    actor_type: 'patient',
                    actor_id: patientId,
                    action: 'profile_updated',
                    resource_type: 'patient',
                    resource_id: patientId,
                    before: before,
                    after: patient,
                },
            });
            res.status(200).json({ patient });
        }
        catch (err) {
            next(err);
        }
    },
    /**
     * POST /patients/pregnancy — create or update the latest pregnancy record
     */
    async createPregnancy(req, res, next) {
        try {
            const patientId = req.user.id;
            const data = req.body;
            const hasLmp = data.lmp_date && !isNaN(Date.parse(data.lmp_date));
            const lmpDate = hasLmp ? new Date(data.lmp_date) : null;
            const eddComputed = lmpDate ? (0, ega_calculator_1.calculateEDD)(lmpDate) : undefined;
            const currentEgaWeeks = lmpDate ? (0, ega_calculator_1.calculateEGAWeeks)(lmpDate) : undefined;
            const ussDate = data.uss_date && !isNaN(Date.parse(data.uss_date)) ? new Date(data.uss_date) : undefined;
            const payload = {
                ...(lmpDate ? { lmp_date: lmpDate, edd_computed: eddComputed, current_ega_weeks: currentEgaWeeks } : {}),
                ...(data.booking_weight != null ? { booking_weight: data.booking_weight } : {}),
                ...(data.booking_height != null ? { booking_height: data.booking_height } : {}),
                ...(data.booking_bp_systolic != null ? { booking_bp_systolic: data.booking_bp_systolic } : {}),
                ...(data.booking_bp_diastolic != null ? { booking_bp_diastolic: data.booking_bp_diastolic } : {}),
                ...(data.blood_group != null ? { blood_group: data.blood_group } : {}),
                ...(data.genotype != null ? { genotype: data.genotype } : {}),
                ...(data.rhesus != null ? { rhesus: data.rhesus } : {}),
                ...(data.rvd_status != null ? { rvd_status: data.rvd_status } : {}),
                ...(data.vdrl != null ? { vdrl: data.vdrl } : {}),
                ...(data.pcv != null ? { pcv: data.pcv } : {}),
                ...(data.hep_b != null ? { hep_b: data.hep_b } : {}),
                ...(data.malaria_parasite != null ? { malaria_parasite: data.malaria_parasite } : {}),
                ...(data.urinalysis != null ? { urinalysis: data.urinalysis } : {}),
                ...(data.tetanus_history != null ? { tetanus_history: data.tetanus_history } : {}),
                ...(data.ipt_history != null ? { ipt_history: data.ipt_history } : {}),
                ...(ussDate ? { uss_date: ussDate } : {}),
                ...(data.uss_ega_weeks != null ? { uss_ega_weeks: data.uss_ega_weeks } : {}),
                ...(data.uss_notes != null ? { uss_notes: data.uss_notes } : {}),
                ...(data.booked_anc != null ? { booked_anc: data.booked_anc } : {}),
                ...(data.booked_anc_facility != null ? { booked_anc_facility: data.booked_anc_facility } : {}),
                ...(data.booking_ga_weeks != null ? { booking_ga_weeks: data.booking_ga_weeks } : {}),
                ...(data.gravidity != null ? { gravidity: data.gravidity } : {}),
                ...(data.parity != null ? { parity: data.parity } : {}),
            };
            const existing = await prisma_1.default.pregnancy.findFirst({
                where: { patient_id: patientId },
                orderBy: { id: 'desc' },
            });
            let pregnancy;
            if (existing) {
                pregnancy = await prisma_1.default.pregnancy.update({
                    where: { id: existing.id },
                    data: payload,
                });
            }
            else {
                pregnancy = await prisma_1.default.pregnancy.create({
                    data: {
                        patient_id: patientId,
                        ...payload,
                    },
                });
            }
            await prisma_1.default.auditLog.create({
                data: {
                    actor_type: 'patient',
                    actor_id: patientId,
                    action: existing ? 'pregnancy_updated' : 'pregnancy_created',
                    resource_type: 'pregnancy',
                    resource_id: pregnancy.id,
                    before: existing,
                    after: pregnancy,
                },
            });
            res.status(existing ? 200 : 201).json({ pregnancy });
        }
        catch (err) {
            next(err);
        }
    },
    /**
     * GET /patients/me — full profile + pregnancy
     */
    async getMe(req, res, next) {
        try {
            const patientId = req.user.id;
            const patient = await prisma_1.default.patient.findUnique({
                where: { id: patientId },
                include: {
                    pregnancies: { orderBy: { id: 'desc' }, take: 1 },
                },
            });
            if (!patient) {
                throw new errors_1.NotFoundError('Patient not found');
            }
            // Recompute current EGA dynamically
            const pregnancy = patient.pregnancies[0];
            let ega = null;
            if (pregnancy?.lmp_date) {
                ega = (0, ega_calculator_1.calculateEGADetailed)(new Date(pregnancy.lmp_date));
            }
            const { password_hash: _pw, ...safePatient } = patient;
            void (0, site_visits_1.recordPatientSiteVisit)(patientId, '/profile');
            const email = safePatient.email ?? null;
            res.status(200).json({
                ...safePatient,
                has_password: !!_pw,
                email_verified: !!patient.email_verified_at,
                needs_email: !(0, contact_1.isUsableEmail)(email),
                current_ega: ega,
            });
        }
        catch (err) {
            next(err);
        }
    },
    /**
     * GET /patients/me/dashboard
     * Returns: current EGA, next appointment, this week's education module
     */
    async getDashboard(req, res, next) {
        try {
            const patientId = req.user.id;
            // Fetch patient + pregnancy
            const patient = await prisma_1.default.patient.findUnique({
                where: { id: patientId },
                include: {
                    pregnancies: { orderBy: { id: 'desc' }, take: 1 },
                    risk_assessments: { orderBy: { created_at: 'desc' }, take: 1 },
                },
            });
            if (!patient) {
                throw new errors_1.NotFoundError('Patient not found');
            }
            const pregnancy = patient.pregnancies[0] || null;
            let currentEga = null;
            let egaWeeks = 0;
            if (pregnancy?.lmp_date) {
                currentEga = (0, ega_calculator_1.calculateEGADetailed)(new Date(pregnancy.lmp_date));
                egaWeeks = currentEga.weeks;
            }
            // Next appointment
            const nextAppointment = await prisma_1.default.appointment.findFirst({
                where: {
                    patient_id: patientId,
                    status: 'booked',
                    slot_start: { gte: new Date() },
                },
                orderBy: { slot_start: 'asc' },
                include: { doctor: { select: { name: true } } },
            });
            // This week's education module
            const educationModule = await prisma_1.default.educationModule.findFirst({
                where: {
                    week_number: egaWeeks > 0 ? egaWeeks : 6,
                    status: 'published',
                },
            });
            void (0, site_visits_1.recordPatientSiteVisit)(patientId, '/dashboard');
            const latestRisk = patient.risk_assessments[0] || null;
            res.status(200).json({
                current_ega: currentEga,
                edd: pregnancy?.edd_computed,
                next_appointment: nextAppointment
                    ? {
                        id: nextAppointment.id,
                        slot_start: nextAppointment.slot_start,
                        slot_end: nextAppointment.slot_end,
                        doctor_id: nextAppointment.doctor_id,
                        doctor: { name: nextAppointment.doctor?.name },
                    }
                    : null,
                education_module: educationModule,
                risk: latestRisk
                    ? { tier: latestRisk.tier, assessed_at: latestRisk.created_at }
                    : null,
                email: patient.email ?? null,
                email_verified: !!patient.email_verified_at,
                needs_email: !(0, contact_1.isUsableEmail)(patient.email),
                support_whatsapp: env_1.env.SUPPORT_WHATSAPP_NUMBER,
                last_seen_at: patient.last_seen_at,
                site_visit_count: patient.site_visit_count,
            });
        }
        catch (err) {
            next(err);
        }
    },
    /**
     * POST /patients/me/ask
     * Patient asking the AI a question
     */
    async askAI(req, res, next) {
        try {
            const patientId = req.user.id;
            const { question } = req.body;
            const patient = await prisma_1.default.patient.findUnique({
                where: { id: patientId },
                include: {
                    pregnancies: { orderBy: { id: 'desc' }, take: 1 },
                    symptoms: { orderBy: { reported_at: 'desc' }, take: 5 },
                },
            });
            if (!patient) {
                throw new errors_1.NotFoundError('Patient not found');
            }
            const responseText = await ai_1.aiService.answerPatientQuestion(patient, question);
            res.status(200).json({ answer: responseText });
        }
        catch (err) {
            next(err);
        }
    },
};
