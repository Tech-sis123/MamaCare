import prisma from '../../config/prisma';
import { NotFoundError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { runRiskEngine } from './engine';
import { buildRiskInput } from './inputs';

/**
 * Loads a patient's latest data, runs the risk engine and saves the assessment
 * with an audit log entry. Returns the engine result plus the saved assessment id.
 */
export async function assessPatientRisk(patientId: string, actor: { type: string; id: string }) {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      pregnancies: { orderBy: { id: 'desc' }, take: 1 },
      intake_responses: true,
    },
  });
  if (!patient) throw new NotFoundError('Patient not found');

  const riskInput = buildRiskInput(patient, patient.pregnancies[0] || null, patient.intake_responses);
  const result = runRiskEngine(riskInput);

  const assessment = await prisma.riskAssessment.create({
    data: {
      patient_id: patientId,
      tier: result.tier,
      reasons: result.reasons as any,
      engine_version: result.engine_version,
      input_snapshot: riskInput as any,
    },
  });

  await prisma.auditLog.create({
    data: {
      actor_type: actor.type,
      actor_id: actor.id,
      action: 'risk_assessment_run',
      resource_type: 'risk_assessment',
      resource_id: assessment.id,
      before: null,
      after: {
        tier: result.tier,
        reasons: result.reasons,
        engine_version: result.engine_version,
        input_snapshot: riskInput as any,
      },
    },
  });

  logger.info({ patientId, tier: result.tier, engine_version: result.engine_version }, 'Risk assessment completed');
  return { ...result, id: assessment.id, input: riskInput };
}
