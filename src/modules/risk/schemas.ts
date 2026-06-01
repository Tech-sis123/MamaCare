import { z } from 'zod';

export const runRiskSchema = z.object({
  patientId: z.string().uuid('Invalid patient ID'),
});

export const latestRiskParamsSchema = z.object({
  patientId: z.string().uuid('Invalid patient ID'),
});
