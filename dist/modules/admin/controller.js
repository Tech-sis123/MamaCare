"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminController = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const logger_1 = require("../../utils/logger");
const termii_1 = require("../../services/termii");
const errors_1 = require("../../utils/errors");
const retentionSms_1 = require("../../jobs/retentionSms");
const contact_1 = require("../../utils/contact");
exports.adminController = {
    /**
     * GET /admin/risk-overview
     * Risk distribution counts, total active patients, alert counts this week.
     */
    async riskOverview(req, res, next) {
        try {
            // Count patients by latest risk tier
            const allAssessments = await prisma_1.default.riskAssessment.findMany({
                select: { patient_id: true, tier: true, created_at: true },
                orderBy: { created_at: 'desc' },
            });
            // Get the latest tier per patient
            const latestTierByPatient = new Map();
            for (const a of allAssessments) {
                if (!latestTierByPatient.has(a.patient_id)) {
                    latestTierByPatient.set(a.patient_id, a.tier);
                }
            }
            const distribution = { HIGH: 0, MEDIUM: 0, LOW: 0 };
            for (const tier of latestTierByPatient.values()) {
                if (tier in distribution) {
                    distribution[tier]++;
                }
            }
            // Total active patients (those with at least one pregnancy)
            const totalActive = await prisma_1.default.patient.count({
                where: {
                    pregnancies: { some: {} },
                },
            });
            // Alert counts this week
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            const alertsThisWeek = await prisma_1.default.dangerAlert.count({
                where: {
                    created_at: { gte: weekAgo },
                },
            });
            const openAlerts = await prisma_1.default.dangerAlert.count({
                where: { status: 'open' },
            });
            const weekStart = new Date();
            weekStart.setDate(weekStart.getDate() - 7);
            const [patientsSeenLast7Days, totalSiteVisits] = await Promise.all([
                prisma_1.default.patient.count({ where: { last_seen_at: { gte: weekStart } } }),
                prisma_1.default.patient.aggregate({ _sum: { site_visit_count: true } }),
            ]);
            res.status(200).json({
                risk_distribution: distribution,
                total_active_patients: totalActive,
                alerts_this_week: alertsThisWeek,
                open_alerts: openAlerts,
                site_visits: {
                    patients_seen_last_7_days: patientsSeenLast7Days,
                    total_recorded_visits: totalSiteVisits._sum.site_visit_count || 0,
                },
            });
        }
        catch (err) {
            next(err);
        }
    },
    /**
     * GET /admin/risk-overview/export
     * PDF download of risk overview.
     * NOTE: In production, use a PDF library like puppeteer, pdfkit, or jsPDF.
     * For now, returns a CSV-like text report.
     */
    async exportRiskOverview(req, res, next) {
        try {
            const allAssessments = await prisma_1.default.riskAssessment.findMany({
                include: { patient: true },
                orderBy: { created_at: 'desc' },
            });
            // Deduplicate by patient
            const seen = new Set();
            const latestPerPatient = [];
            for (const a of allAssessments) {
                if (!seen.has(a.patient_id)) {
                    seen.add(a.patient_id);
                    latestPerPatient.push(a);
                }
            }
            // Build CSV content
            const lines = ['Patient Name,Phone,Risk Tier,Reasons,Assessed At'];
            for (const a of latestPerPatient) {
                const reasons = Array.isArray(a.reasons) ? a.reasons.join('; ') : '';
                lines.push(`"${a.patient.name || 'N/A'}","${a.patient.phone_number}","${a.tier}","${reasons}","${a.created_at.toISOString()}"`);
            }
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=risk-overview.csv');
            res.status(200).send(lines.join('\n'));
        }
        catch (err) {
            next(err);
        }
    },
    /**
     * POST /admin/patients/:id/assign-doctor
     * Assigns a doctor to a patient and notifies the patient via Termii SMS
     */
    async assignDoctor(req, res, next) {
        try {
            const patientId = req.params.id;
            const { doctor_id } = req.body;
            // Verify doctor exists
            const doctor = await prisma_1.default.doctor.findUnique({ where: { id: doctor_id } });
            if (!doctor) {
                throw new errors_1.NotFoundError('Doctor not found');
            }
            // Update patient
            const patient = await prisma_1.default.patient.update({
                where: { id: patientId },
                data: { primary_doctor_id: doctor_id },
            });
            // Send SMS notification
            await termii_1.termiiService.sendSMS({
                to: patient.phone_number,
                sms: `Hello Mama! Dr. ${doctor.name} has been assigned to you on 9Care. They will be reviewing your updates. Have a safe delivery!`,
            });
            logger_1.logger.info({ patientId, doctor_id }, 'Assigned doctor to patient');
            res.status(200).json({ message: 'Doctor assigned successfully', patient });
        }
        catch (err) {
            next(err);
        }
    },
    /**
     * POST /admin/sms/retention
     * Manually trigger the weekly retention SMS job.
     */
    async triggerRetentionSms(req, res, next) {
        try {
            const result = await (0, retentionSms_1.processRetentionSms)();
            res.status(200).json({ message: 'Retention SMS job finished', ...result });
        }
        catch (err) {
            next(err);
        }
    },
    /**
     * POST /admin/sms/test
     * Send a single test SMS so the team can confirm Termii is live.
     */
    async sendTestSms(req, res, next) {
        try {
            const { phone_number, message } = req.body;
            if (!(0, contact_1.isSmsPhone)(phone_number)) {
                throw new errors_1.ValidationError('A valid phone number is required');
            }
            const sms = message ||
                '9Care test: SMS is working. You can ignore this message.';
            const result = await termii_1.termiiService.sendSMS({ to: phone_number, sms });
            res.status(200).json({ message: 'Test SMS sent', ...result });
        }
        catch (err) {
            next(err);
        }
    },
};
