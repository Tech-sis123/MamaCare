"use strict";
/**
 * Appointment Reminder Scheduler
 *
 * Sends reminders at 48 hours and 2 hours before appointments.
 * Run via: npx tsx src/jobs/appointmentReminder.ts
 * In production, use a cron scheduler (node-cron) or external scheduler.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const termii_1 = require("../services/termii");
const logger_1 = require("../utils/logger");
const prisma = new client_1.PrismaClient();
async function sendReminders(hoursAhead, label) {
    const now = new Date();
    const windowStart = new Date(now.getTime() + (hoursAhead - 0.5) * 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + (hoursAhead + 0.5) * 60 * 60 * 1000);
    const upcoming = await prisma.appointment.findMany({
        where: {
            status: 'booked',
            slot_start: {
                gte: windowStart,
                lte: windowEnd,
            },
        },
        include: {
            patient: true,
            doctor: true,
        },
    });
    logger_1.logger.info({ count: upcoming.length, label }, `Found ${upcoming.length} appointments for ${label} reminder`);
    for (const apt of upcoming) {
        try {
            const timeStr = apt.slot_start.toLocaleTimeString('en-NG', {
                hour: '2-digit',
                minute: '2-digit',
            });
            await termii_1.termiiService.sendSMS({
                to: apt.patient.phone_number,
                sms: `Mama Care Reminder: You have an appointment with ${apt.doctor.name} at ${timeStr}. Please arrive 15 minutes early.`,
            });
            logger_1.logger.info({ appointmentId: apt.id, patient: apt.patient.phone_number }, `${label} reminder sent`);
        }
        catch (err) {
            logger_1.logger.error({ err, appointmentId: apt.id }, `Failed to send ${label} reminder`);
        }
    }
}
async function run() {
    logger_1.logger.info('🔔 Running appointment reminder job...');
    await sendReminders(48, '48-hour');
    await sendReminders(2, '2-hour');
    logger_1.logger.info('✅ Reminder job complete');
}
run()
    .catch((err) => {
    logger_1.logger.error({ err }, 'Reminder job failed');
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
