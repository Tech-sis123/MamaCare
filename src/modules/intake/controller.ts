import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/prisma';
import { ForbiddenError, NotFoundError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { normalizeIntakeDomain } from './schemas';
import { getIntakeEditMeta } from './editWindow';
import { runRiskEngine } from '../risk/engine';

async function assertPatientCanEditIntake(patientId: string) {
  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) throw new NotFoundError('Patient not found');
  const meta = getIntakeEditMeta(patient);
  if (!meta.can_edit) {
    throw new ForbiddenError(
      'Your questionnaire can no longer be edited. The 7-day edit window after your first submission has ended.'
    );
  }
  return { patient, meta };
}

export const intakeController = {
  /**
   * PATCH /intake/:patientId
   * Partial save — one question or one domain at a time.
   * Upserts each response by patient_id + domain + question_key.
   * Blocked after first submit + 7 days.
   */
  async patchIntake(req: Request, res: Response, next: NextFunction) {
    try {
      const patientId = req.params.patientId as string;
      const { domain, responses } = req.body;
      const normalizedDomain = normalizeIntakeDomain(domain);

      const { patient } = await assertPatientCanEditIntake(patientId);

      const keys = responses.map((r: { question_key: string }) => r.question_key);
      // One query for existing rows instead of N findFirst calls
      const existingRows = await prisma.intakeResponse.findMany({
        where: {
          patient_id: patientId,
          domain: normalizedDomain,
          question_key: { in: keys },
        },
      });
      const byKey = new Map(existingRows.map((r) => [r.question_key, r]));

      // Parallel upserts within the domain
      const upserted = await Promise.all(
        responses.map(async (resp: { question_key: string; answer: unknown }) => {
          const existing = byKey.get(resp.question_key);
          if (existing) {
            return prisma.intakeResponse.update({
              where: { id: existing.id },
              data: { answer: resp.answer as any },
            });
          }
          return prisma.intakeResponse.create({
            data: {
              patient_id: patientId,
              domain: normalizedDomain,
              question_key: resp.question_key,
              answer: resp.answer as any,
            },
          });
        })
      );

      // Single patient update (reuse edit-window patient; avoid extra findUnique)
      const nextStatus =
        patient.intake_status === 'submitted' ? 'submitted' : 'in_progress';
      const updatedPatient = await prisma.patient.update({
        where: { id: patientId },
        data: {
          intake_status: nextStatus,
          intake_last_saved_at: new Date(),
        },
      });

      // Fire-and-forget audit — do not block the response on logging
      prisma.auditLog
        .create({
          data: {
            actor_type: 'patient',
            actor_id: patientId,
            action: 'intake_partial_save',
            resource_type: 'intake_response',
            resource_id: patientId,
            before: null,
            after: { domain: normalizedDomain, question_count: responses.length },
          },
        })
        .catch((err) => logger.warn({ err, patientId }, 'intake audit log failed'));

      const meta = getIntakeEditMeta(updatedPatient);

      res.status(200).json({ saved: upserted.length, domain: normalizedDomain, meta });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /intake/:patientId
   * Return everything captured so far, grouped by domain, plus edit-window meta.
   */
  async getIntake(req: Request, res: Response, next: NextFunction) {
    try {
      const patientId = req.params.patientId as string;

      const patient = await prisma.patient.findUnique({ where: { id: patientId } });
      if (!patient) throw new NotFoundError('Patient not found');

      const responses = await prisma.intakeResponse.findMany({
        where: { patient_id: patientId },
        orderBy: [{ domain: 'asc' }, { question_key: 'asc' }],
      });

      const grouped: Record<string, any[]> = {};
      for (const r of responses) {
        if (!grouped[r.domain]) grouped[r.domain] = [];
        grouped[r.domain].push({
          question_key: r.question_key,
          answer: r.answer,
          updated_at: r.updated_at,
        });
      }

      // Infer in_progress if answers exist but status never updated
      let status = patient.intake_status || 'not_started';
      if (status === 'not_started' && responses.length > 0) {
        status = 'in_progress';
      }

      const meta = getIntakeEditMeta({ ...patient, intake_status: status });

      res.status(200).json({
        patient_id: patientId,
        domains: grouped,
        meta,
        status,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /intake/:patientId/submit
   * Marks intake as complete, triggers risk engine.
   * First submit starts the 7-day edit window; re-submit allowed only within that window.
   */
  async submitIntake(req: Request, res: Response, next: NextFunction) {
    try {
      const patientId = req.params.patientId as string;

      const { patient } = await assertPatientCanEditIntake(patientId);

      const [pregnancy, intakeResponses] = await Promise.all([
        prisma.pregnancy.findFirst({
          where: { patient_id: patientId },
          orderBy: { id: 'desc' },
        }),
        prisma.intakeResponse.findMany({
          where: { patient_id: patientId },
        }),
      ]);

      const intakeMap = new Map<string, any>();
      for (const ir of intakeResponses) {
        intakeMap.set(ir.question_key, ir.answer);
      }

      const riskInput = {
        age: patient.age,
        bp_systolic: pregnancy?.booking_bp_systolic ?? null,
        bp_diastolic: pregnancy?.booking_bp_diastolic ?? null,
        hemoglobin: pregnancy?.pcv ?? null,
        genotype: pregnancy?.genotype ?? null,
        previous_csection: intakeMap.get('previous_csection') ?? null,
        previous_stillbirth: intakeMap.get('previous_stillbirth') ?? null,
        previous_eclampsia: intakeMap.get('previous_eclampsia') ?? null,
        parity: pregnancy?.parity ?? null,
        is_twin_pregnancy: intakeMap.get('is_twin_pregnancy') ?? null,
        hiv_positive:
          pregnancy?.rvd_status === 'positive'
            ? true
            : pregnancy?.rvd_status === 'negative'
              ? false
              : null,
      };

      // Pure sync rules engine — milliseconds
      const result = runRiskEngine(riskInput);

      const firstSubmitted = patient.intake_first_submitted_at ?? new Date();

      // Persist assessment + patient status in parallel
      const [assessment] = await Promise.all([
        prisma.riskAssessment.create({
          data: {
            patient_id: patientId,
            tier: result.tier,
            reasons: result.reasons,
            engine_version: result.engine_version,
            input_snapshot: riskInput as any,
          },
        }),
        prisma.patient.update({
          where: { id: patientId },
          data: {
            intake_status: 'submitted',
            intake_first_submitted_at: firstSubmitted,
            intake_last_saved_at: new Date(),
          },
        }),
      ]);

      prisma.auditLog
        .create({
          data: {
            actor_type: 'patient',
            actor_id: patientId,
            action: 'intake_submitted',
            resource_type: 'intake_response',
            resource_id: patientId,
            before: null,
            after: {
              risk_tier: result.tier,
              assessment_id: assessment.id,
              first_submit: !patient.intake_first_submitted_at,
            },
          },
        })
        .catch((err) => logger.warn({ err, patientId }, 'intake submit audit failed'));

      logger.info({ patientId, tier: result.tier }, 'Intake submitted, risk assessed');

      const meta = getIntakeEditMeta({
        intake_status: 'submitted',
        intake_first_submitted_at: firstSubmitted,
      });

      res.status(200).json({
        message: 'Intake submitted successfully',
        risk: {
          id: assessment.id,
          tier: result.tier,
          reasons: result.reasons,
          engine_version: result.engine_version,
        },
        meta,
      });
    } catch (err) {
      next(err);
    }
  },
};
