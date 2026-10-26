import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/prisma';
import { runRiskEngine } from './engine';
import { buildRiskInput } from './inputs';
import { assessPatientRisk } from './assess';
import { RISK_CONDITIONS, RISK_CATEGORY_LABELS, CHECKLIST_CONDITION_IDS } from './conditions';
import { AuthRequest } from '../../utils/types';
import { NotFoundError } from '../../utils/errors';

/** Checklist + what the engine currently detects, for the doctor's high-risk panel. */
async function conditionsView(patientId: string) {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: { pregnancies: { orderBy: { id: 'desc' }, take: 1 }, intake_responses: true },
  });
  if (!patient) throw new NotFoundError('Patient not found');

  const input = buildRiskInput(patient, patient.pregnancies[0] || null, patient.intake_responses);
  const result = runRiskEngine(input);
  return {
    categories: RISK_CATEGORY_LABELS,
    conditions: RISK_CONDITIONS,
    selected: input.clinician_flags || [],
    detected: result.matches.filter((m) => m.source === 'detected').map((m) => ({ id: m.id, reason: m.reason, tier: m.tier })),
    tier: result.tier,
    reasons: result.reasons,
    engine_version: result.engine_version,
  };
}

export const riskController = {
  /**
   * POST /risk/:patientId/run
   * Runs the pure-function risk engine, persists result, writes audit log.
   */
  async runRisk(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const patientId = req.params.patientId as string;
      const result = await assessPatientRisk(patientId, { type: 'doctor', id: req.user?.id || 'risk_engine' });
      res.status(200).json({
        id: result.id,
        tier: result.tier,
        reasons: result.reasons,
        engine_version: result.engine_version,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /risk/:patientId/conditions
   * The high-risk checklist with the doctor's ticks and what was detected from records.
   */
  async getConditions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      res.status(200).json(await conditionsView(req.params.patientId as string));
    } catch (err) {
      next(err);
    }
  },

  /**
   * PUT /risk/:patientId/conditions
   * Saves the doctor's ticked conditions and re-runs the risk assessment.
   */
  async setConditions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const patientId = req.params.patientId as string;
      const doctorId = req.user!.id;
      const ids = Array.from(new Set((req.body.condition_ids as string[]).filter((id) => CHECKLIST_CONDITION_IDS.has(id))));

      const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { id: true } });
      if (!patient) throw new NotFoundError('Patient not found');

      const pregnancy = await prisma.pregnancy.findFirst({ where: { patient_id: patientId }, orderBy: { id: 'desc' } });
      const saved = pregnancy
        ? await prisma.pregnancy.update({ where: { id: pregnancy.id }, data: { risk_factors: ids } })
        : await prisma.pregnancy.create({ data: { patient_id: patientId, risk_factors: ids } });

      await prisma.auditLog.create({
        data: {
          actor_type: 'doctor',
          actor_id: doctorId,
          action: 'risk_checklist_updated',
          resource_type: 'pregnancy',
          resource_id: saved.id,
          before: { risk_factors: (pregnancy?.risk_factors as any) ?? [] },
          after: { risk_factors: ids },
        },
      });

      await assessPatientRisk(patientId, { type: 'doctor', id: doctorId });
      res.status(200).json(await conditionsView(patientId));
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
      const patientId = req.params.patientId as string;

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
