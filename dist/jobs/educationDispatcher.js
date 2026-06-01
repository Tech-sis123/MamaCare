"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatchWeeklyEducation = dispatchWeeklyEducation;
const prisma_1 = __importDefault(require("../config/prisma"));
const ai_1 = require("../services/ai");
const termii_1 = require("../services/termii");
const whatsapp_1 = require("../services/whatsapp");
const logger_1 = require("../utils/logger");
async function dispatchWeeklyEducation() {
    logger_1.logger.info('Starting weekly education dispatch job...');
    try {
        const pregnancies = await prisma_1.default.pregnancy.findMany({
            include: {
                patient: true,
            },
            where: {
                current_ega_weeks: { not: null },
            }
        });
        for (const pregnancy of pregnancies) {
            const { patient, current_ega_weeks } = pregnancy;
            if (!current_ega_weeks || !patient)
                continue;
            let doctorRole = 'midwife';
            // Get assigned doctor info if it exists
            if (patient.primary_doctor_id) {
                const doctor = await prisma_1.default.doctor.findUnique({
                    where: { id: patient.primary_doctor_id }
                });
                if (doctor) {
                    doctorRole = doctor.role;
                }
            }
            // Get latest risk assessment to pass to AI
            const latestRisk = await prisma_1.default.riskAssessment.findFirst({
                where: { patient_id: patient.id },
                orderBy: { created_at: 'desc' }
            });
            const riskTier = latestRisk?.tier || 'LOW';
            // Generate lesson via OpenAI
            const lesson = await ai_1.aiService.generatePersonalizedLesson({
                patientName: patient.name || 'Mama',
                age: patient.age || 25,
                weekNumber: current_ega_weeks,
                riskTier,
                doctorRole,
                languagePreference: patient.language_preference
            });
            if (!lesson) {
                logger_1.logger.warn({ patientId: patient.id }, 'Skipping education dispatch: AI returned null');
                continue;
            }
            const fullMessage = lesson.summary;
            // Dispatch via WhatsApp (if setup and phone number format allows)
            try {
                await whatsapp_1.whatsappService.sendMessage({
                    to: patient.phone_number,
                    message: fullMessage
                });
                logger_1.logger.info({ patientId: patient.id }, 'Sent AI lesson via WhatsApp');
            }
            catch (err) {
                logger_1.logger.warn({ err, patientId: patient.id }, 'Could not send WhatsApp lesson');
            }
            // Dispatch via Termii SMS
            try {
                // SMS might need truncation if too long, but we'll send it
                await termii_1.termiiService.sendSMS({
                    to: patient.phone_number,
                    sms: fullMessage.substring(0, 800) // Termii max length limit buffer
                });
                logger_1.logger.info({ patientId: patient.id }, 'Sent AI lesson via Termii SMS');
            }
            catch (err) {
                logger_1.logger.warn({ err, patientId: patient.id }, 'Could not send Termii lesson');
            }
        }
        logger_1.logger.info('Completed weekly education dispatch job.');
    }
    catch (error) {
        logger_1.logger.error({ error }, 'Fatal error in education dispatcher');
    }
}
