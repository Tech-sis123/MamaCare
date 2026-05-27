import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/prisma';
import { runRiskEngine } from './engine';
import { RiskInput } from '../../utils/types';
import { NotFoundError } from '../../utils/errors';
import { logger } from '../../utils/logger';

export const riskController = {
  /**
   * POST /risk/:patientId/run
   * Runs the pure-function risk engine, persists result, writes audit log.
   */
  async runRisk(req: Request, res: Response, next: NextFunction) {
    try {
      const { patientId } = req.params;

      // Fetch patient and pregnancy data
      const patient = await prisma.patient.findUnique({
        where: { id: patientId },
        include: {
          pregnancies: { orderBy: { id: 'desc' }, take: 1 },
          intake_responses: true,
        },
      });

      if (!patient) {
        throw new NotFoundError('Patient not found');
      }

      const pregnancy = patient.pregnancies[0] || null;

      // Extract medical history from intake responses
      const intakeMap = new Map<string, any>();
      for (const ir of patient.intake_responses) {
        intakeMap.set(ir.question_key, ir.answer);
      }

      // Build the risk input snapshot
      const riskInput: RiskInput = {
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
        hiv_positive: pregnancy?.rvd_status === 'positive' ? true :
                      pregnancy?.rvd_status === 'negative' ? false : null,
      };

      // Run the PURE FUNCTION engine
      const result = runRiskEngine(riskInput);

      // Persist the assessment
      const assessment = await prisma.riskAssessment.create({
        data: {
          patient_id: patientId,
          tier: result.tier,
          reasons: result.reasons,
          engine_version: result.engine_version,
          input_snapshot: riskInput as any,
        },
      });

      // Write audit log
      await prisma.auditLog.create({
        data: {
          actor_type: 'system',
          actor_id: 'risk_engine',
          action: 'risk_assessment_run',
          resource_type: 'risk_assessment',
          resource_id: assessment.id,
          before: null,
          after: {
            tier: result.tier,
            reasons: result.reasons,
            engine_version: result.engine_version,
            input_snapshot: riskInput,
          },
        },
      });

      logger.info(
        { patientId, tier: result.tier, engine_version: result.engine_version },
        'Risk assessment completed'
      );

      res.status(200).json({
        id: assessment.id,
        tier: result.tier,
        reasons: result.reasons,
        engine_version: result.engine_version,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /risk/:patientId/latest
   * Returns the most recent risk assessment for a patient.
   */
  async getLatest(req: Request, res: Response, next: NextFunction) {
    try {
      const { patientId } = req.params;

      const assessment = await prisma.riskAssessment.findFirst({
        where: { patient_id: patientId },
        orderBy: { created_at: 'desc' },
      });

      if (!assessment) {
        throw new NotFoundError('No risk assessment found for this patient');
      }

      res.status(200).json({
        id: assessment.id,
        tier: assessment.tier,
        reasons: assessment.reasons,
        engine_version: assessment.engine_version,
        created_at: assessment.created_at,
      });
    } catch (err) {
      next(err);
    }
  },
};
