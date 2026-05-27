import { z } from 'zod';

export const symptomInputSchema = z.object({
  symptoms: z.array(
    z.object({
      symptom_key: z.string().min(1),
      severity: z.enum(['mild', 'moderate', 'severe']),
      notes: z.string().optional(),
    })
  ).min(1, 'At least one symptom is required'),
});

export const symptomTimelineQuerySchema = z.object({
  range: z.string().regex(/^\d+d$/, 'Range must be in format Nd (e.g. 30d)').default('30d'),
});

export const patientIdParamSchema = z.object({
  id: z.string().uuid('Invalid patient ID'),
});

export const alertIdParamSchema = z.object({
  id: z.string().uuid('Invalid alert ID'),
});
