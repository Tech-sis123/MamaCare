import { Response, NextFunction } from 'express';
import prisma from '../../config/prisma';
import { AuthRequest } from '../../utils/types';
import { NotFoundError } from '../../utils/errors';
import { generatePreConsultSummary } from '../../services/summary-generator';
import { calculateEGAWeeks } from '../../services/ega-calculator';
import { logger } from '../../utils/logger';

export const providersController = {
  /**
   * GET /providers/queue?date=today
   * Today's patients for the logged-in doctor.
   * Red-tier patients pinned top, then medium, then low.
   */
  async getQueue(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const doctorId = req.user!.id;
      const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];

      const dayStart = new Date(`${dateStr}T00:00:00`);
      const dayEnd = new Date(`${dateStr}T23:59:59`);

      const appointments = await prisma.appointment.findMany({
        where: {
          doctor_id: doctorId,
          slot_start: { gte: dayStart, lte: dayEnd },
          status: { in: ['booked', 'completed'] },
        },
        include: {
          patient: {
            include: {
              risk_assessments: { orderBy: { created_at: 'desc' }, take: 1 },
              pregnancies: { orderBy: { id: 'desc' }, take: 1 },
            },
          },
        },
        orderBy: { slot_start: 'asc' },
      });

      // Sort by risk tier: HIGH first, then MEDIUM, then LOW, then unassessed
      const tierOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

      const sorted = appointments.sort((a, b) => {
        const tierA = a.patient.risk_assessments[0]?.tier || 'UNKNOWN';
        const tierB = b.patient.risk_assessments[0]?.tier || 'UNKNOWN';
        const orderA = tierOrder[tierA] ?? 3;
        const orderB = tierOrder[tierB] ?? 3;
        if (orderA !== orderB) return orderA - orderB;
        return a.slot_start.getTime() - b.slot_start.getTime();
      });

      const queue = sorted.map((apt) => ({
        appointment_id: apt.id,
        slot_start: apt.slot_start,
        slot_end: apt.slot_end,
        status: apt.status,
        patient: {
          id: apt.patient.id,
          name: apt.patient.name,
          phone_number: apt.patient.phone_number,
          age: apt.patient.age,
          risk_tier: apt.patient.risk_assessments[0]?.tier || null,
          ega_weeks: apt.patient.pregnancies[0]?.lmp_date
            ? calculateEGAWeeks(new Date(apt.patient.pregnancies[0].lmp_date))
            : null,
        },
      }));

      res.status(200).json({ date: dateStr, queue });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /patients/:id/summary
   * Template-generated pre-consult summary.
   */
  async getPatientSummary(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const patient = await prisma.patient.findUnique({
        where: { id },
        include: {
          pregnancies: { orderBy: { id: 'desc' }, take: 1 },
          risk_assessments: { orderBy: { created_at: 'desc' }, take: 1 },
          symptoms: { orderBy: { reported_at: 'desc' }, take: 5 },
          intake_responses: {
            where: { domain: 'medical' },
          },
        },
      });

      if (!patient) {
        throw new NotFoundError('Patient not found');
      }

      const pregnancy = patient.pregnancies[0] || null;
      const egaWeeks = pregnancy?.lmp_date
        ? calculateEGAWeeks(new Date(pregnancy.lmp_date))
        : null;

      // Extract chronic conditions from medical intake
      const chronicConditions = patient.intake_responses
        .filter((ir) => ir.question_key.startsWith('chronic_'))
        .map((ir) => String(ir.answer));

      const summary = generatePreConsultSummary({
        name: patient.name || 'Unknown',
        age: patient.age,
        gravidity: pregnancy?.gravidity ?? null,
        parity: pregnancy?.parity ?? null,
        ega_weeks: egaWeeks,
        recent_symptoms: patient.symptoms.map((s) => s.symptom_key),
        chronic_conditions: chronicConditions,
        risk_tier: patient.risk_assessments[0]?.tier || null,
        bp_systolic: pregnancy?.booking_bp_systolic ?? null,
        bp_diastolic: pregnancy?.booking_bp_diastolic ?? null,
      });

      res.status(200).json({ patient_id: id, summary });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /visits/:id/notes
   * Create visit notes for an appointment.
   */
  async createVisitNotes(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { doctor_notes } = req.body;
      const doctorId = req.user!.id;

      // Verify appointment exists
      const appointment = await prisma.appointment.findUnique({ where: { id } });
      if (!appointment) {
        throw new NotFoundError('Appointment not found');
      }

      const visit = await prisma.visit.create({
        data: {
          appointment_id: id,
          doctor_notes,
        },
      });

      // Mark appointment as completed
      await prisma.appointment.update({
        where: { id },
        data: { status: 'completed' },
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          actor_type: 'doctor',
          actor_id: doctorId,
          action: 'visit_notes_created',
          resource_type: 'visit',
          resource_id: visit.id,
          before: null,
          after: { doctor_notes },
        },
      });

      res.status(201).json({ visit });
    } catch (err) {
      next(err);
    }
  },
};
