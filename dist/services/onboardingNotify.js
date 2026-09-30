"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyDoctorOnboardingComplete = notifyDoctorOnboardingComplete;
const prisma_1 = __importDefault(require("../config/prisma"));
const redis_1 = require("../config/redis");
const logger_1 = require("../utils/logger");
const env_1 = require("../config/env");
const brevo_1 = require("./brevo");
const termii_1 = require("./termii");
const whatsapp_1 = require("./whatsapp");
const contact_1 = require("../utils/contact");
/**
 * Alert the assigned (or on-call) doctor that a patient finished onboarding.
 *
 * Feasibility:
 * - In-app SSE: always, if a doctor id is known
 * - Email: always, doctors already have email
 * - SMS / WhatsApp: only when doctors.phone_number is set
 */
async function notifyDoctorOnboardingComplete(params) {
    const { patientId, patientName, patientPhone, riskTier, reasons } = params;
    const displayName = patientName || 'A patient';
    const reasonList = (0, contact_1.toReasonList)(reasons);
    const reasonLine = reasonList.length ? reasonList.slice(0, 4).join('; ') : 'no specific flags';
    try {
        const patient = await prisma_1.default.patient.findUnique({
            where: { id: patientId },
            select: { primary_doctor_id: true },
        });
        let doctorId = patient?.primary_doctor_id || null;
        if (!doctorId) {
            const config = await prisma_1.default.systemConfig.findFirst();
            doctorId = config?.on_call_doctor_id || null;
        }
        if (!doctorId) {
            const fallback = await prisma_1.default.doctor.findFirst({
                orderBy: { created_at: 'asc' },
                select: { id: true },
            });
            doctorId = fallback?.id || null;
        }
        if (!doctorId) {
            logger_1.logger.warn({ patientId }, 'Onboarding complete but no doctor to notify');
            return;
        }
        const doctor = await prisma_1.default.doctor.findUnique({ where: { id: doctorId } });
        if (!doctor) {
            logger_1.logger.warn({ patientId, doctorId }, 'Onboarding notify: doctor not found');
            return;
        }
        const payload = JSON.stringify({
            type: 'onboarding',
            id: `onboard-${patientId}-${Date.now()}`,
            patient_id: patientId,
            patient_name: displayName,
            patient_phone: patientPhone,
            risk_tier: riskTier,
            message: `${displayName} completed onboarding (${riskTier} risk)`,
            created_at: new Date().toISOString(),
        });
        await redis_1.redis.lpush(`doctor:${doctorId}:active_alerts`, payload);
        await redis_1.redis.ltrim(`doctor:${doctorId}:active_alerts`, 0, 19);
        await redis_1.redis.publish(`doctor:${doctorId}:alerts`, payload);
        const html = `
      <p>Hello ${doctor.name},</p>
      <p><strong>${displayName}</strong> has completed onboarding on 9Care.</p>
      <ul>
        <li>Risk: <strong>${riskTier}</strong></li>
        <li>Phone: ${patientPhone}</li>
        <li>Reasons: ${reasonLine}</li>
      </ul>
      <p>Open the provider portal to review this record.</p>
    `;
        try {
            await brevo_1.brevoService.sendEmail({
                to: doctor.email,
                subject: `9Care: ${displayName} completed onboarding (${riskTier})`,
                htmlContent: html,
            });
        }
        catch (err) {
            logger_1.logger.warn({ err, doctorId }, 'Onboarding email to doctor failed');
        }
        const doctorPhone = doctor.phone_number;
        if ((0, contact_1.isSmsPhone)(doctorPhone)) {
            const sms = `9Care: ${displayName} completed onboarding. Risk ${riskTier}. ${reasonLine}`.slice(0, 300);
            try {
                await termii_1.termiiService.sendSMS({ to: doctorPhone, sms });
            }
            catch (err) {
                logger_1.logger.warn({ err, doctorId }, 'Onboarding SMS to doctor failed');
            }
            try {
                await whatsapp_1.whatsappService.sendMessage({ to: doctorPhone, message: sms });
            }
            catch (err) {
                logger_1.logger.warn({ err, doctorId }, 'Onboarding WhatsApp to doctor failed');
            }
        }
        else {
            logger_1.logger.info({ doctorId, hasEmail: !!doctor.email }, 'Onboarding SMS/WhatsApp skipped: doctor has no phone_number (email + in-app sent)');
        }
        logger_1.logger.info({ patientId, doctorId, riskTier, frontend: env_1.env.CORS_ORIGIN }, 'Doctor notified of onboarding completion');
    }
    catch (err) {
        logger_1.logger.error({ err, patientId }, 'Failed to notify doctor of onboarding');
    }
}
