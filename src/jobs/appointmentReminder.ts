/**
 * Appointment Reminder Scheduler
 * 
 * Sends reminders at 48 hours and 2 hours before appointments.
 * Run via: npx tsx src/jobs/appointmentReminder.ts
 * In production, use a cron scheduler (node-cron) or external scheduler.
 */

import { PrismaClient } from '@prisma/client';
import { termiiService } from '../services/termii';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

async function sendReminders(hoursAhead: number, label: string) {
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

  logger.info({ count: upcoming.length, label }, `Found ${upcoming.length} appointments for ${label} reminder`);

  for (const apt of upcoming) {
    try {
      const timeStr = apt.slot_start.toLocaleTimeString('en-NG', {
        hour: '2-digit',
        minute: '2-digit',
      });

      await termiiService.sendSMS({
        to: apt.patient.phone_number,
        sms: `Mama Care Reminder: You have an appointment with ${apt.doctor.name} at ${timeStr}. Please arrive 15 minutes early.`,
      });

      logger.info(
        { appointmentId: apt.id, patient: apt.patient.phone_number },
        `${label} reminder sent`
      );
    } catch (err) {
      logger.error({ err, appointmentId: apt.id }, `Failed to send ${label} reminder`);
    }
  }
}

export async function processAppointmentReminders() {
  logger.info('🔔 Running appointment reminder job...');

  await sendReminders(48, '48-hour');
  await sendReminders(2, '2-hour');

  logger.info('✅ Reminder job complete');
}

// If run directly from the command line (e.g., npx tsx src/jobs/appointmentReminder.ts)
if (require.main === module) {
  processAppointmentReminders()
    .catch((err) => {
      logger.error({ err }, 'Reminder job failed');
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
