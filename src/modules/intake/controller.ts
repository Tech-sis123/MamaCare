import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/prisma';
import { NotFoundError } from '../../utils/errors';
import { logger } from '../../utils/logger';

export const intakeController = {
  /**
   * PATCH /intake/:patientId
   * Partial save — one question or one domain at a time.
   * Upserts each response by patient_id + domain + question_key.
   */
  async patchIntake(req: Request, res: Response, next: NextFunction) {
    try {
      const { patientId } = req.params;
      const { domain, responses } = req.body;

      // Verify patient exists
      const patient = await prisma.patient.findUnique({ where: { id: patientId } });
      if (!patient) {
        throw new NotFoundError('Patient not found');
      }

      const upserted = [];
      for (const resp of responses) {
        const existing = await prisma.intakeResponse.findFirst({
          where: {
            patient_id: patientId,
            domain,
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
              domain,
              question_key: resp.question_key,
              answer: resp.answer,
            },
          });
          upserted.push(created);
        }
      }

      // Audit log
      await prisma.auditLog.create({
        data: {
          actor_type: 'patient',
          actor_id: patientId,
          action: 'intake_partial_save',
          resource_type: 'intake_response',
          resource_id: patientId,
          before: null,
          after: { domain, question_count: responses.length },
        },
      });

      res.status(200).json({ saved: upserted.length, domain });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /intake/:patientId
   * Return everything captured so far, grouped by domain.
   */
  async getIntake(req: Request, res: Response, next: NextFunction) {
    try {
      const { patientId } = req.params;

      const responses = await prisma.intakeResponse.findMany({
        where: { patient_id: patientId },
        orderBy: [{ domain: 'asc' }, { question_key: 'asc' }],
      });

      // Group by domain
      const grouped: Record<string, any[]> = {};
      for (const r of responses) {
        if (!grouped[r.domain]) grouped[r.domain] = [];
        grouped[r.domain].push({
          question_key: r.question_key,
          answer: r.answer,
          updated_at: r.updated_at,
        });
      }

      res.status(200).json({ patient_id: patientId, domains: grouped });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /intake/:patientId/submit
   * Marks intake as complete, triggers risk engine internally.
   */
  async submitIntake(req: Request, res: Response, next: NextFunction) {
    try {
      const { patientId } = req.params;

      // Verify patient exists
      const patient = await prisma.patient.findUnique({ where: { id: patientId } });
      if (!patient) {
        throw new NotFoundError('Patient not found');
      }

      // Internally trigger risk engine (import the controller)
      // We do a direct import to call the risk run logic
      const { riskController } = await import('../risk/controller');

      // Create a mock request/response to call the risk controller
      // Instead, let's directly call the engine and persist
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

      // Audit
      await prisma.auditLog.create({
        data: {
          actor_type: 'patient',
          actor_id: patientId,
          action: 'intake_submitted',
          resource_type: 'intake_response',
          resource_id: patientId,
          before: null,
          after: { risk_tier: result.tier, assessment_id: assessment.id },
        },
      });

      logger.info({ patientId, tier: result.tier }, 'Intake submitted, risk assessed');

      res.status(200).json({
        message: 'Intake submitted successfully',
        risk: {
          id: assessment.id,
          tier: result.tier,
          reasons: result.reasons,
          engine_version: result.engine_version,
        },
      });
    } catch (err) {
      next(err);
    }
  },
};
