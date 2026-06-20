import { z } from 'zod';

export const queueQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().default(new Date().toISOString().split('T')[0]),
});

export const visitNotesSchema = z.object({
  doctor_notes: z.string().min(1, 'Notes cannot be empty'),
});

export const visitIdParamSchema = z.object({
  id: z.string().uuid('Invalid visit/appointment ID'),
});

export const askQuestionSchema = z.object({
  question: z.string().min(5, 'Question must be at least 5 characters long').max(1000, 'Question is too long'),
  patient_id: z.string().uuid('Invalid patient ID').optional(),
});
