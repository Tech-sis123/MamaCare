"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processRetentionSms = processRetentionSms;
const prisma_1 = __importDefault(require("../config/prisma"));
const redis_1 = require("../config/redis");
const termii_1 = require("../services/termii");
const logger_1 = require("../utils/logger");
const contact_1 = require("../utils/contact");
const THROTTLE_SECONDS = 7 * 24 * 60 * 60;
const INACTIVE_DAYS = 7;
/**
 * Retention SMS for mothers who have not opened the app recently.
 * At most once per patient per 7 days (Redis throttle).
 */
async function processRetentionSms() {
    logger_1.logger.info('Running retention SMS job...');
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - INACTIVE_DAYS);
    const patients = await prisma_1.default.patient.findMany({
        where: {
            intake_status: 'submitted',
            OR: [{ last_seen_at: null }, { last_seen_at: { lt: cutoff } }],
        },
        select: {
            id: true,
            name: true,
            phone_number: true,
            last_seen_at: true,
            created_at: true,
        },
    });
    let sent = 0;
    let skipped = 0;
    for (const patient of patients) {
        if (!(0, contact_1.isSmsPhone)(patient.phone_number)) {
            skipped += 1;
            continue;
        }
        // Don't SMS brand-new accounts that have never opened the app yet
        const accountAgeMs = Date.now() - patient.created_at.getTime();
        if (!patient.last_seen_at && accountAgeMs < INACTIVE_DAYS * 24 * 60 * 60 * 1000) {
            skipped += 1;
            continue;
        }
        const throttleKey = `retention_sms:${patient.id}`;
        const already = await redis_1.redis.get(throttleKey);
        if (already) {
            skipped += 1;
            continue;
        }
        const firstName = (patient.name || 'Mama').split(' ')[0];
        const sms = `Hi ${firstName}, this is 9Care. Open the app this week for your pregnancy tips and to stay on track with your visits. We're here if you need us.`;
        try {
            await termii_1.termiiService.sendSMS({ to: patient.phone_number, sms });
            await redis_1.redis.set(throttleKey, '1', 'EX', THROTTLE_SECONDS);
            sent += 1;
            logger_1.logger.info({ patientId: patient.id }, 'Retention SMS sent');
        }
        catch (err) {
            skipped += 1;
            logger_1.logger.warn({ err, patientId: patient.id }, 'Retention SMS failed');
        }
    }
    logger_1.logger.info({ sent, skipped }, 'Retention SMS job complete');
    return { sent, skipped };
}
