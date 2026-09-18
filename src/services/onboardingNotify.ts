import prisma from '../config/prisma';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { brevoService } from './brevo';
import { termiiService } from './termii';
import { whatsappService } from './whatsapp';
import { isSmsPhone, toReasonList } from '../utils/contact';

/**
 * Alert the assigned (or on-call) doctor that a patient finished onboarding.
 *
 * Feasibility:
 * - In-app SSE: always, if a doctor id is known
 * - Email: always, doctors already have email
 * - SMS / WhatsApp: only when doctors.phone_number is set
 */
export async function notifyDoctorOnboardingComplete(params: {
  patientId: string;
  patientName: string | null;
  patientPhone: string;
  riskTier: string;
  reasons: unknown;
}): Promise<void> {
  const { patientId, patientName, patientPhone, riskTier, reasons } = params;
  const displayName = patientName || 'A patient';
  const reasonList = toReasonList(reasons);
  const reasonLine = reasonList.length ? reasonList.slice(0, 4).join('; ') : 'no specific flags';

  try {
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { primary_doctor_id: true },
    });

    let doctorId = patient?.primary_doctor_id || null;
    if (!doctorId) {
      const config = await prisma.systemConfig.findFirst();
      doctorId = config?.on_call_doctor_id || null;
    }

    if (!doctorId) {
      const fallback = await prisma.doctor.findFirst({
        orderBy: { created_at: 'asc' },
        select: { id: true },
      });
      doctorId = fallback?.id || null;
    }

    if (!doctorId) {
      logger.warn({ patientId }, 'Onboarding complete but no doctor to notify');
      return;
    }

    const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
    if (!doctor) {
      logger.warn({ patientId, doctorId }, 'Onboarding notify: doctor not found');
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

    await redis.lpush(`doctor:${doctorId}:active_alerts`, payload);
    await redis.ltrim(`doctor:${doctorId}:active_alerts`, 0, 19);
    await redis.publish(`doctor:${doctorId}:alerts`, payload);

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
      await brevoService.sendEmail({
        to: doctor.email,
        subject: `9Care: ${displayName} completed onboarding (${riskTier})`,
        htmlContent: html,
      });
    } catch (err) {
      logger.warn({ err, doctorId }, 'Onboarding email to doctor failed');
    }

    const doctorPhone = doctor.phone_number;
    if (isSmsPhone(doctorPhone)) {
      const sms = `9Care: ${displayName} completed onboarding. Risk ${riskTier}. ${reasonLine}`.slice(
        0,
        300
      );
      try {
        await termiiService.sendSMS({ to: doctorPhone as string, sms });
      } catch (err) {
        logger.warn({ err, doctorId }, 'Onboarding SMS to doctor failed');
      }
      try {
        await whatsappService.sendMessage({ to: doctorPhone as string, message: sms });
      } catch (err) {
        logger.warn({ err, doctorId }, 'Onboarding WhatsApp to doctor failed');
      }
    } else {
      logger.info(
        { doctorId, hasEmail: !!doctor.email },
        'Onboarding SMS/WhatsApp skipped: doctor has no phone_number (email + in-app sent)'
      );
    }

    logger.info(
      { patientId, doctorId, riskTier, frontend: env.CORS_ORIGIN },
      'Doctor notified of onboarding completion'
    );
  } catch (err) {
    logger.error({ err, patientId }, 'Failed to notify doctor of onboarding');
  }
}
