import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/prisma';
import { ForbiddenError, NotFoundError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { normalizeIntakeDomain } from './schemas';
import { getIntakeEditMeta } from './editWindow';

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

      await assertPatientCanEditIntake(patientId);

      const upserted = [];
      for (const resp of responses) {
        const existing = await prisma.intakeResponse.findFirst({
          where: {
            patient_id: patientId,
            domain: normalizedDomain,
            question_key: resp.question_key,
          },
        });

        if (existing) {
          const updated = await prisma.intakeResponse.update({
            where: { id: existing.id },
            data: { answer: resp.answer },
          });
          upserted.push(updated);
        } else {
          const created = await prisma.intakeResponse.create({
            data: {
              patient_id: patientId,
              domain: normalizedDomain,
              question_key: resp.question_key,
              answer: resp.answer,
            },
          });
          upserted.push(created);
        }
      }

      // Mark progress; keep "submitted" if already submitted within the edit window
      const current = await prisma.patient.findUnique({ where: { id: patientId } });
      const nextStatus =
        current?.intake_status === 'submitted' ? 'submitted' : 'in_progress';
      await prisma.patient.update({
        where: { id: patientId },
        data: {
          intake_status: nextStatus,
          intake_last_saved_at: new Date(),
        },
      });

      await prisma.auditLog.create({
        data: {
          actor_type: 'patient',
          actor_id: patientId,
          action: 'intake_partial_save',
          resource_type: 'intake_response',
          resource_id: patientId,
          before: null,
          after: { domain: normalizedDomain, question_count: responses.length },
        },
      });

      const meta = getIntakeEditMeta(
        (await prisma.patient.findUnique({ where: { id: patientId } }))!
      );

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

      const { runRiskEngine } = await import('../risk/engine');

      const pregnancy = await prisma.pregnancy.findFirst({
        where: { patient_id: patientId },
        orderBy: { id: 'desc' },
      });

      const intakeResponses = await prisma.intakeResponse.findMany({
        where: { patient_id: patientId },
      });
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

      const result = runRiskEngine(riskInput);

      const assessment = await prisma.riskAssessment.create({
        data: {
          patient_id: patientId,
          tier: result.tier,
          reasons: result.reasons,
          engine_version: result.engine_version,
          input_snapshot: riskInput as any,
        },
      });

      const firstSubmitted = patient.intake_first_submitted_at ?? new Date();
      await prisma.patient.update({
        where: { id: patientId },
        data: {
          intake_status: 'submitted',
          intake_first_submitted_at: firstSubmitted,
          intake_last_saved_at: new Date(),
        },
      });

      await prisma.auditLog.create({
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
      });

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
