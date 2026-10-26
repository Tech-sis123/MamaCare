import { z } from 'zod';

export const runRiskSchema = z.object({
  patientId: z.string().uuid('Invalid patient ID'),
});

export const latestRiskParamsSchema = z.object({
  patientId: z.string().uuid('Invalid patient ID'),
});

export const riskConditionsBodySchema = z.object({
  condition_ids: z.array(z.string().min(1).max(80)).max(100),
});
