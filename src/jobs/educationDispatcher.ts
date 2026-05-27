import prisma from '../config/prisma';
import { aiService } from '../services/ai';
import { termiiService } from '../services/termii';
import { whatsappService } from '../services/whatsapp';
import { logger } from '../utils/logger';

export async function dispatchWeeklyEducation() {
  logger.info('Starting weekly education dispatch job...');

  try {
    const pregnancies = await prisma.pregnancy.findMany({
      include: {
        patient: true,
      },
      where: {
        current_ega_weeks: { not: null },
      }
    });

    for (const pregnancy of pregnancies) {
      const { patient, current_ega_weeks } = pregnancy;
      if (!current_ega_weeks || !patient) continue;

      let doctorRole = 'midwife';
      
      // Get assigned doctor info if it exists
      if (patient.primary_doctor_id) {
        const doctor = await prisma.doctor.findUnique({
          where: { id: patient.primary_doctor_id }
        });
        if (doctor) {
          doctorRole = doctor.role;
        }
      }

      // Get latest risk assessment to pass to AI
      const latestRisk = await prisma.riskAssessment.findFirst({
        where: { patient_id: patient.id },
        orderBy: { created_at: 'desc' }
      });
      const riskTier = latestRisk?.tier || 'LOW';

      // Generate lesson via OpenAI
      const lesson = await aiService.generatePersonalizedLesson({
        patientName: patient.name || 'Mama',
        age: patient.age || 25,
        weekNumber: current_ega_weeks,
        riskTier,
        doctorRole,
        languagePreference: patient.language_preference
      });

      if (!lesson) {
        logger.warn({ patientId: patient.id }, 'Skipping education dispatch: AI returned null');
        continue;
      }

      const fullMessage = lesson.summary;

      // Dispatch via WhatsApp (if setup and phone number format allows)
      try {
        await whatsappService.sendMessage({
          to: patient.phone_number,
          message: fullMessage
        });
        logger.info({ patientId: patient.id }, 'Sent AI lesson via WhatsApp');
      } catch (err) {
        logger.warn({ err, patientId: patient.id }, 'Could not send WhatsApp lesson');
      }

      // Dispatch via Termii SMS
      try {
        // SMS might need truncation if too long, but we'll send it
        await termiiService.sendSMS({
          to: patient.phone_number,
          sms: fullMessage.substring(0, 800) // Termii max length limit buffer
        });
        logger.info({ patientId: patient.id }, 'Sent AI lesson via Termii SMS');
      } catch (err) {
        logger.warn({ err, patientId: patient.id }, 'Could not send Termii lesson');
      }
    }

    logger.info('Completed weekly education dispatch job.');
  } catch (error) {
    logger.error({ error }, 'Fatal error in education dispatcher');
  }
}
