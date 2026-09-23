import prisma from '../config/prisma';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { brevoService } from './brevo';
import { termiiService } from './termii';
import { whatsappService } from './whatsapp';
import { isSmsPhone } from '../utils/contact';
import { calculateEGAWeeks } from './ega-calculator';

export interface NotifyAppointmentParams {
  appointmentId: string;
  patientId: string;
  doctorId: string;
  slotStart: Date;
  isReschedule?: boolean;
}

/**
 * Notifies the assigned doctor via WhatsApp, SMS, and Email when a patient books or reschedules an appointment.
 * Includes a direct link to the patient's chart in the provider portal.
 */
export async function notifyDoctorOfAppointment(params: NotifyAppointmentParams): Promise<void> {
  const { appointmentId, patientId, doctorId, slotStart, isReschedule } = params;

  try {
    const [doctor, patient] = await Promise.all([
      prisma.doctor.findUnique({
        where: { id: doctorId },
        select: { id: true, name: true, email: true, phone_number: true },
      }),
      prisma.patient.findUnique({
        where: { id: patientId },
        include: {
          pregnancies: { orderBy: { id: 'desc' }, take: 1, select: { lmp_date: true, current_ega_weeks: true } },
          risk_assessments: { orderBy: { created_at: 'desc' }, take: 1, select: { tier: true } },
        },
      }),
    ]);

    if (!doctor) {
      logger.warn({ appointmentId, doctorId }, 'Appointment notify skipped: doctor not found');
      return;
    }

    const patientName = patient?.name || 'A patient';
    const preg = patient?.pregnancies?.[0];
    const ega = preg?.current_ega_weeks ?? (preg?.lmp_date ? calculateEGAWeeks(preg.lmp_date) : null);
    const riskTier = patient?.risk_assessments?.[0]?.tier || 'UNASSESSED';

    // Format human-friendly date & time (e.g. "Monday, 28 Sep 2026 at 10:30 AM")
    const dateFormatted = slotStart.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const timeFormatted = slotStart.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const directLink = `${env.CORS_ORIGIN}/provider/patient?id=${patientId}`;
    const headerTitle = isReschedule ? '🔄 *9Care AI: Appointment Rescheduled*' : '📅 *9Care AI: New Appointment Booked*';
    const egaStr = ega != null ? `${ega} weeks` : 'N/A';

    // WhatsApp formatted message
    const whatsappMsg = `${headerTitle}

*Doctor:* Dr. ${doctor.name}
*Patient:* ${patientName}
*EGA:* ${egaStr} | *Risk:* ${riskTier}
*Date:* ${dateFormatted}
*Time:* ${timeFormatted}

🔗 *View Patient Chart & ANC Record:*
${directLink}`;

    // Plain SMS version
    const sms = `9Care: ${isReschedule ? 'Rescheduled' : 'New'} appointment for ${patientName} on ${dateFormatted} at ${timeFormatted}. View: ${directLink}`.slice(
      0,
      300
    );

    // 1. Send WhatsApp message if doctor has phone number
    const doctorPhone = doctor.phone_number;
    if (isSmsPhone(doctorPhone)) {
      try {
        await whatsappService.sendMessage({ to: doctorPhone as string, message: whatsappMsg });
        logger.info({ doctorId, doctorPhone }, 'Appointment WhatsApp alert sent to doctor');
      } catch (err) {
        logger.warn({ err, doctorId }, 'Appointment WhatsApp alert to doctor failed');
      }

      // Also dispatch SMS as high-reliability fallback if Termii is configured
      if (env.TERMII_API_KEY) {
        try {
          await termiiService.sendSMS({ to: doctorPhone as string, sms });
        } catch (err) {
          logger.warn({ err, doctorId }, 'Appointment SMS alert to doctor failed');
        }
      }
    } else {
      logger.info(
        { doctorId, hasEmail: !!doctor.email },
        'Doctor has no phone_number configured for WhatsApp/SMS appointment alert'
      );
    }

    // 2. Email notification (if Brevo is active)
    if (doctor.email && env.BREVO_API_KEY) {
      const emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1c1917;">
          <h2 style="color: #92400e;">${isReschedule ? 'Appointment Rescheduled' : 'New Appointment Booked'}</h2>
          <p>Hello Dr. ${doctor.name},</p>
          <p>A patient has ${isReschedule ? 'rescheduled their' : 'booked a new'} antenatal appointment with you on <strong>9Care AI</strong>.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 8px 0; color: #78716c;">Patient:</td><td style="padding: 8px 0; font-weight: bold;">${patientName}</td></tr>
            <tr><td style="padding: 8px 0; color: #78716c;">EGA:</td><td style="padding: 8px 0;">${egaStr}</td></tr>
            <tr><td style="padding: 8px 0; color: #78716c;">Risk Tier:</td><td style="padding: 8px 0; font-weight: bold;">${riskTier}</td></tr>
            <tr><td style="padding: 8px 0; color: #78716c;">Date & Time:</td><td style="padding: 8px 0; font-weight: bold; color: #92400e;">${dateFormatted} at ${timeFormatted}</td></tr>
          </table>
          <p style="margin: 25px 0;">
            <a href="${directLink}" style="background-color: #92400e; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
              View Patient Chart
            </a>
          </p>
        </div>
      `;

      try {
        await brevoService.sendEmail({
          to: doctor.email,
          subject: `9Care AI: ${isReschedule ? 'Appointment Rescheduled' : 'New Booking'} - ${patientName}`,
          htmlContent: emailHtml,
        });
      } catch (err) {
        logger.warn({ err, doctorId }, 'Appointment email to doctor failed');
      }
    }
  } catch (err) {
    logger.error({ err, appointmentId, doctorId }, 'Failed to process appointment notifications to doctor');
  }
}
