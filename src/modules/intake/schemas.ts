import { z } from 'zod';

const intakeDomainEnum = z.enum([
  'biodata',
  'obstetric',
  'gynae',
  'medical',
  'surgical',
  'allergies',
  'family_social',
]);

export const patchIntakeSchema = z.object({
  domain: intakeDomainEnum,
  responses: z.array(
    z.object({
      question_key: z.string().min(1),
      answer: z.any(),
    })
  ).min(1),
});

export const intakeParamsSchema = z.object({
  patientId: z.string().uuid('Invalid patient ID'),
});
