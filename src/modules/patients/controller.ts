import { Response, NextFunction } from 'express';
import prisma from '../../config/prisma';
import { AuthRequest } from '../../utils/types';
import { NotFoundError } from '../../utils/errors';
import { calculateEDD, calculateEGAWeeks, calculateEGADetailed } from '../../services/ega-calculator';
import { logger } from '../../utils/logger';
import { aiService } from '../../services/ai';

export const patientsController = {
  /**
   * POST /patients/profile — create or update biodata
   */
  async upsertProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const patientId = req.user!.id;
      const data = req.body;

      const before = await prisma.patient.findUnique({ where: { id: patientId } });

      const patient = await prisma.patient.update({
        where: { id: patientId },
        data: {
          name: data.name,
          age: data.age,
          education_level: data.education_level,
          occupation: data.occupation,
          marital_status: data.marital_status,
          address: data.address,
          religion: data.religion,
          ethnicity: data.ethnicity,
          language_preference: data.language_preference,
        },
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          actor_type: 'patient',
          actor_id: patientId,
          action: 'profile_updated',
          resource_type: 'patient',
          resource_id: patientId,
          before: before as any,
          after: patient as any,
        },
      });

      res.status(200).json({ patient });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /patients/pregnancy — create pregnancy record, compute EDD and EGA
   */
  async createPregnancy(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const patientId = req.user!.id;
      const data = req.body;

      const lmpDate = new Date(data.lmp_date);
      const eddComputed = calculateEDD(lmpDate);
      const currentEgaWeeks = calculateEGAWeeks(lmpDate);

      const pregnancy = await prisma.pregnancy.create({
        data: {
          patient_id: patientId,
          lmp_date: lmpDate,
          edd_computed: eddComputed,
          current_ega_weeks: currentEgaWeeks,
          booking_weight: data.booking_weight,
          booking_height: data.booking_height,
          booking_bp_systolic: data.booking_bp_systolic,
          booking_bp_diastolic: data.booking_bp_diastolic,
          blood_group: data.blood_group,
          genotype: data.genotype,
          rvd_status: data.rvd_status,
          vdrl: data.vdrl,
          pcv: data.pcv,
          hep_b: data.hep_b,
          tetanus_history: data.tetanus_history,
          gravidity: data.gravidity,
          parity: data.parity,
        },
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          actor_type: 'patient',
          actor_id: patientId,
          action: 'pregnancy_created',
          resource_type: 'pregnancy',
          resource_id: pregnancy.id,
          before: null,
          after: pregnancy as any,
        },
      });

      res.status(201).json({ pregnancy });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /patients/me — full profile + pregnancy
   */
  async getMe(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const patientId = req.user!.id;

      const patient = await prisma.patient.findUnique({
        where: { id: patientId },
        include: {
          pregnancies: { orderBy: { id: 'desc' }, take: 1 },
          risk_assessments: { orderBy: { created_at: 'desc' }, take: 1 },
        },
      });

      if (!patient) {
        throw new NotFoundError('Patient not found');
      }

      // Recompute current EGA dynamically
      const pregnancy = patient.pregnancies[0];
      let ega = null;
      if (pregnancy?.lmp_date) {
        ega = calculateEGADetailed(new Date(pregnancy.lmp_date));
      }

      const { password_hash: _pw, ...safePatient } = patient as typeof patient & {
        password_hash?: string | null;
      };

      res.status(200).json({
        ...safePatient,
        has_password: !!_pw,
        current_ega: ega,
        risk_tier: patient.risk_assessments?.[0]?.tier || 'Low Risk',
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /patients/me/dashboard
   * Returns: current EGA, next appointment, latest risk tier, this week's education module
   */
  async getDashboard(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const patientId = req.user!.id;

      // Fetch patient + pregnancy
      const patient = await prisma.patient.findUnique({
        where: { id: patientId },
        include: {
          pregnancies: { orderBy: { id: 'desc' }, take: 1 },
        },
      });

      if (!patient) {
        throw new NotFoundError('Patient not found');
      }

      const pregnancy = patient.pregnancies[0] || null;
      let currentEga = null;
      let egaWeeks = 0;
      if (pregnancy?.lmp_date) {
        currentEga = calculateEGADetailed(new Date(pregnancy.lmp_date));
        egaWeeks = currentEga.weeks;
      }

      // Next appointment
      const nextAppointment = await prisma.appointment.findFirst({
        where: {
          patient_id: patientId,
          status: 'booked',
          slot_start: { gte: new Date() },
        },
        orderBy: { slot_start: 'asc' },
      });

      // Latest risk tier
      const latestRisk = await prisma.riskAssessment.findFirst({
        where: { patient_id: patientId },
        orderBy: { created_at: 'desc' },
      });

      // This week's education module
      const educationModule = await prisma.educationModule.findFirst({
        where: {
          week_number: egaWeeks > 0 ? egaWeeks : 6,
          status: 'published',
        },
      });

      res.status(200).json({
        current_ega: currentEga,
        edd: pregnancy?.edd_computed,
        next_appointment: nextAppointment
          ? {
              id: nextAppointment.id,
              slot_start: nextAppointment.slot_start,
              slot_end: nextAppointment.slot_end,
              doctor_id: nextAppointment.doctor_id,
            }
          : null,
        risk: latestRisk
          ? {
              tier: latestRisk.tier,
              reasons: latestRisk.reasons,
              assessed_at: latestRisk.created_at,
            }
          : null,
        education_module: educationModule,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /patients/me/ask
   * Patient asking the AI a question
   */
  async askAI(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const patientId = req.user!.id;
      const { question } = req.body;

      const patient = await prisma.patient.findUnique({
        where: { id: patientId },
        include: {
          pregnancies: { orderBy: { id: 'desc' }, take: 1 },
          risk_assessments: { orderBy: { created_at: 'desc' }, take: 1 },
          symptoms: { orderBy: { reported_at: 'desc' }, take: 5 },
        },
      });

      if (!patient) {
        throw new NotFoundError('Patient not found');
      }

      const responseText = await aiService.answerPatientQuestion(patient, question);

      res.status(200).json({ answer: responseText });
    } catch (err) {
      next(err);
    }
  },
};
