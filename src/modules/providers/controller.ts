import { Response, NextFunction } from 'express';
import prisma from '../../config/prisma';
import { AuthRequest } from '../../utils/types';
import { NotFoundError } from '../../utils/errors';
import { generatePreConsultSummary } from '../../services/summary-generator';
import { calculateEGAWeeks, calculateEDD } from '../../services/ega-calculator';
import { logger } from '../../utils/logger';
import { aiService } from '../../services/ai';

export const providersController = {
  /**
   * GET /providers — list all doctors (patient-accessible)
   */
  async listDoctors(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const doctors = await prisma.doctor.findMany({
        select: { id: true, name: true, role: true },
        orderBy: { name: 'asc' },
      });
      res.status(200).json({ doctors });
    } catch (err) {
      next(err);
    }
  },

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

      const toCode = (id: string) =>
        `MC-${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;

      const queue = sorted.map((apt) => ({
        appointment_id: apt.id,
        slot_start: apt.slot_start,
        slot_end: apt.slot_end,
        status: apt.status,
        patient: {
          id: apt.patient.id,
          patient_code: toCode(apt.patient.id),
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
      const id = req.params.id as string;

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
      const egaWeeks =
        pregnancy?.current_ega_weeks ??
        (pregnancy?.lmp_date
          ? calculateEGAWeeks(new Date(pregnancy.lmp_date))
          : null);

      // Medical intake stores condition keys as question_key with answer "yes"
      // (e.g. hypertension, diabetes) — not chronic_* prefixes.
      const conditionLabels: Record<string, string> = {
        hypertension: 'Known hypertensive',
        epilepsy: 'Known epilepsy',
        asthma: 'Known asthmatic',
        diabetes: 'Known diabetic',
        peptic_ulcer_disease: 'Peptic ulcer disease',
      };
      const yesVal = (v: unknown) =>
        v === true || v === 'true' || v === 'yes' || v === 'Yes';

      const chronicConditions: string[] = [];
      for (const ir of patient.intake_responses) {
        const key = ir.question_key;
        if (conditionLabels[key] && yesVal(ir.answer)) {
          chronicConditions.push(conditionLabels[key]);
          continue;
        }
        // Legacy chronic_* keys
        if (key.startsWith('chronic_') && yesVal(ir.answer)) {
          const label = key.replace(/^chronic_/, '').replace(/_/g, ' ');
          chronicConditions.push(label.charAt(0).toUpperCase() + label.slice(1));
        }
      }

      // Children alive from obstetric child_*_state_now intake answers
      const allIntake = await prisma.intakeResponse.findMany({
        where: { patient_id: id },
        select: { question_key: true, answer: true },
      });
      let childrenAlive = 0;
      let childEntries = 0;
      for (const ir of allIntake) {
        const m = /^child_(\d+)_state_now$/.exec(ir.question_key);
        if (!m) continue;
        childEntries += 1;
        const state = String(ir.answer ?? '').toLowerCase();
        if (state.includes('alive') || state === 'well' || state === 'healthy' || state === 'living') {
          childrenAlive += 1;
        }
      }
      // Fallback: if no child cards, use parity as proxy for living children
      if (childEntries === 0 && pregnancy?.parity != null) {
        childrenAlive = Math.max(0, pregnancy.parity);
      }

      const summary = generatePreConsultSummary({
        name: patient.name || 'Unknown',
        age: patient.age,
        gravidity: pregnancy?.gravidity ?? null,
        parity: pregnancy?.parity ?? null,
        children_alive: childrenAlive,
        ega_weeks: egaWeeks,
        recent_symptoms: patient.symptoms.map((s) => s.symptom_key),
        chronic_conditions: chronicConditions,
        risk_tier: patient.risk_assessments[0]?.tier || null,
        bp_systolic: pregnancy?.booking_bp_systolic ?? null,
        bp_diastolic: pregnancy?.booking_bp_diastolic ?? null,
      });

      const risk = patient.risk_assessments[0] || null;
      const reasonsRaw = risk?.reasons;
      const flags = Array.isArray(reasonsRaw)
        ? reasonsRaw.map((r) => (typeof r === 'string' ? r : String(r)))
        : [];

      res.status(200).json({
        patient_id: id,
        summary,
        risk_tier: risk?.tier || null,
        flags,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /providers/patients?q=
   * Search or list all patients (doctor-accessible).
   * Supports name, phone, and unique patient code (MC-XXXXXX).
   */
  async searchPatients(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const q = ((req.query.q as string) || '').trim();
      const codeNeedle = q.replace(/^MC-?/i, '').replace(/[^a-fA-F0-9]/g, '').toLowerCase();
      const looksLikeCode = /^MC-?[a-fA-F0-9]{4,}/i.test(q) || (/^[a-fA-F0-9]{4,8}$/i.test(q) && q.length <= 8);

      // When searching by code, load a broader set and filter by derived code
      const patients = await prisma.patient.findMany({
        where: q && !looksLikeCode
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { phone_number: { contains: q } },
              ],
            }
          : {},
        include: {
          risk_assessments: {
            orderBy: { created_at: 'desc' },
            take: 1,
            select: { tier: true },
          },
          // Only lmp_date is needed for EGA — avoid selecting clinic columns
          // that may not exist yet (P2022 on search looks like an empty list).
          pregnancies: {
            orderBy: { id: 'desc' },
            take: 1,
            select: { lmp_date: true },
          },
        },
        orderBy: { name: 'asc' },
        take: looksLikeCode ? 200 : 50,
      });

      const toCode = (id: string) =>
        `MC-${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;

      let filtered = patients;
      if (q && looksLikeCode && codeNeedle) {
        filtered = patients.filter((p) => {
          const code = toCode(p.id).toLowerCase();
          const compactId = p.id.replace(/-/g, '').toLowerCase();
          return code.includes(codeNeedle) || compactId.startsWith(codeNeedle);
        });
      }

      const result = filtered.slice(0, 50).map((p) => ({
        id: p.id,
        patient_code: toCode(p.id),
        name: p.name,
        age: p.age,
        phone_number: p.phone_number,
        risk_tier: p.risk_assessments[0]?.tier || null,
        ega_weeks: p.pregnancies[0]?.lmp_date
          ? calculateEGAWeeks(new Date(p.pregnancies[0].lmp_date))
          : null,
      }));

      res.status(200).json({ patients: result });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /visits/:id/notes
   * Upsert visit notes for an appointment.
   * Autosave: complete=false (default) keeps appointment open.
   * Mark seen: complete=true marks appointment completed.
   */
  async createVisitNotes(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { doctor_notes, complete } = req.body as {
        doctor_notes: string;
        complete?: boolean;
      };
      const doctorId = req.user!.id;

      const appointment = await prisma.appointment.findUnique({ where: { id } });
      if (!appointment) {
        throw new NotFoundError('Appointment not found');
      }

      const existing = await prisma.visit.findFirst({
        where: { appointment_id: id },
        orderBy: { created_at: 'desc' },
      });

      let visit;
      if (existing) {
        visit = await prisma.visit.update({
          where: { id: existing.id },
          data: { doctor_notes },
        });
      } else {
        visit = await prisma.visit.create({
          data: {
            appointment_id: id,
            doctor_notes,
          },
        });
      }

      if (complete) {
        await prisma.appointment.update({
          where: { id },
          data: { status: 'completed' },
        });
      }

      await prisma.auditLog.create({
        data: {
          actor_type: 'doctor',
          actor_id: doctorId,
          action: existing ? 'visit_notes_updated' : 'visit_notes_created',
          resource_type: 'visit',
          resource_id: visit.id,
          before: existing ? { doctor_notes: existing.doctor_notes } : null,
          after: { doctor_notes, complete: !!complete },
        },
      });

      res.status(existing ? 200 : 201).json({ visit });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /providers/ask
   * Doctor asking the AI a question
   */
  async askAI(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { question, patient_id } = req.body;
      
      let patientData = null;
      if (patient_id) {
        patientData = await prisma.patient.findUnique({
          where: { id: patient_id },
          include: {
            pregnancies: { orderBy: { id: 'desc' }, take: 1 },
            risk_assessments: { orderBy: { created_at: 'desc' }, take: 1 },
            symptoms: { orderBy: { reported_at: 'desc' }, take: 5 },
          },
        });
        
        if (!patientData) {
          throw new NotFoundError('Patient not found');
        }
      }

      const responseText = await aiService.answerDoctorQuestion(question, patientData);

      res.status(200).json({ answer: responseText });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /providers/patients/:id
   * Full patient detail (biodata, pregnancies, intake responses, risk assessments) for doctor view.
   */
  async getPatientDetail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const patient = await prisma.patient.findUnique({
        where: { id },
        include: {
          pregnancies: { orderBy: { id: 'desc' }, take: 1 },
          risk_assessments: { orderBy: { created_at: 'desc' }, take: 5 },
          symptoms: { orderBy: { reported_at: 'desc' }, take: 10 },
          intake_responses: true,
          // Booking history for doctor pre-consult (newest first)
          appointments: {
            orderBy: { slot_start: 'desc' },
            take: 50,
            include: {
              doctor: { select: { id: true, name: true } },
              visits: {
                orderBy: { created_at: 'desc' },
                take: 1,
                select: { id: true, doctor_notes: true, created_at: true },
              },
            },
          },
        },
      });

      if (!patient) {
        throw new NotFoundError('Patient not found');
      }

      // Refresh EGA from LMP when stale/missing (avoids absurd stored values e.g. week 138)
      const pregnancies = patient.pregnancies.map((preg) => {
        if (!preg.lmp_date) return preg;
        const liveWeeks = calculateEGAWeeks(new Date(preg.lmp_date));
        return { ...preg, current_ega_weeks: liveWeeks };
      });

      const booking_history = (patient.appointments || []).map((apt) => ({
        id: apt.id,
        slot_start: apt.slot_start,
        slot_end: apt.slot_end,
        status: apt.status,
        created_at: apt.created_at,
        doctor: apt.doctor
          ? { id: apt.doctor.id, name: apt.doctor.name }
          : null,
        notes: apt.visits?.[0]?.doctor_notes ?? null,
      }));

      const patient_code = `MC-${patient.id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
      // Omit raw appointments relation; expose shaped booking_history instead
      const { appointments: _apts, ...patientRest } = patient as typeof patient & {
        appointments: unknown;
      };
      res.status(200).json({
        patient: { ...patientRest, pregnancies, patient_code, booking_history },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /providers/patients/:id/pregnancy
   * Doctor updates index pregnancy / booking investigations (TT, IPT, USS, labs, etc.).
   */
  async updatePatientPregnancy(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const patientId = req.params.id as string;
      const doctorId = req.user!.id;
      const data = req.body;

      const patient = await prisma.patient.findUnique({ where: { id: patientId } });
      if (!patient) throw new NotFoundError('Patient not found');

      const existing = await prisma.pregnancy.findFirst({
        where: { patient_id: patientId },
        orderBy: { id: 'desc' },
      });

      const hasLmp = data.lmp_date && !isNaN(Date.parse(data.lmp_date));
      const lmpDate = hasLmp ? new Date(data.lmp_date) : null;
      const eddComputed = lmpDate ? calculateEDD(lmpDate) : undefined;
      const currentEgaWeeks = lmpDate ? calculateEGAWeeks(lmpDate) : undefined;
      const ussDate =
        data.uss_date && !isNaN(Date.parse(data.uss_date)) ? new Date(data.uss_date) : undefined;
      const bookingDate =
        data.booking_date && !isNaN(Date.parse(data.booking_date))
          ? new Date(data.booking_date)
          : undefined;

      const setIf = <T,>(key: string, value: T | null | undefined, transform?: (v: T) => unknown) => {
        if (value === undefined) return {};
        if (value === null) return { [key]: null };
        return { [key]: transform ? transform(value) : value };
      };

      const payload: Record<string, unknown> = {
        ...setIf('lmp_date', lmpDate ?? (data.lmp_date === null ? null : undefined)),
        ...(lmpDate
          ? { edd_computed: eddComputed, current_ega_weeks: currentEgaWeeks }
          : {}),
        ...setIf('booking_weight', data.booking_weight),
        ...setIf('booking_height', data.booking_height),
        ...setIf('booking_bp_systolic', data.booking_bp_systolic),
        ...setIf('booking_bp_diastolic', data.booking_bp_diastolic),
        ...setIf('blood_group', data.blood_group),
        ...setIf('genotype', data.genotype),
        ...setIf('rhesus', data.rhesus),
        ...setIf('rvd_status', data.rvd_status),
        ...setIf('vdrl', data.vdrl),
        ...setIf('pcv', data.pcv),
        ...setIf('hep_b', data.hep_b),
        ...setIf('malaria_parasite', data.malaria_parasite),
        ...setIf('urinalysis', data.urinalysis),
        ...setIf('tetanus_history', data.tetanus_history),
        ...setIf('ipt_history', data.ipt_history),
        ...setIf('uss_date', ussDate ?? (data.uss_date === null ? null : undefined)),
        ...setIf('uss_ega_weeks', data.uss_ega_weeks),
        ...setIf('uss_notes', data.uss_notes),
        ...setIf('booked_anc', data.booked_anc),
        ...setIf('booked_anc_facility', data.booked_anc_facility),
        ...setIf('booking_ga_weeks', data.booking_ga_weeks),
        ...setIf(
          'booking_date',
          bookingDate ?? (data.booking_date === null ? null : undefined)
        ),
        ...setIf('booking_history', data.booking_history),
        ...setIf('hep_c', data.hep_c),
        ...setIf('rbg', data.rbg),
        ...setIf('ogtt', data.ogtt),
        ...setIf('extra_labs', data.extra_labs),
        ...setIf('vitals_log', data.vitals_log),
        ...setIf('drugs_vaccines', data.drugs_vaccines),
        ...setIf('scans_log', data.scans_log),
        ...setIf('examination', data.examination),
        ...setIf('important_remarks', data.important_remarks),
        ...setIf('gravidity', data.gravidity),
        ...setIf('parity', data.parity),
      };

      let pregnancy;
      if (existing) {
        pregnancy = await prisma.pregnancy.update({
          where: { id: existing.id },
          data: payload as any,
        });
      } else {
        pregnancy = await prisma.pregnancy.create({
          data: {
            patient_id: patientId,
            ...(payload as any),
          },
        });
      }

      await prisma.auditLog.create({
        data: {
          actor_type: 'doctor',
          actor_id: doctorId,
          action: existing ? 'pregnancy_updated_by_doctor' : 'pregnancy_created_by_doctor',
          resource_type: 'pregnancy',
          resource_id: pregnancy.id,
          before: existing as any,
          after: pregnancy as any,
        },
      });

      res.status(existing ? 200 : 201).json({ pregnancy });
    } catch (err) {
      next(err);
    }
  },
};
