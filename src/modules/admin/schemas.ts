import { z } from 'zod';

export const assignDoctorSchema = z.object({
  doctor_id: z.string().uuid(),
});

export const testSmsSchema = z.object({
  phone_number: z
    .string()
    .min(10, 'Phone number must be at least 10 digits')
    .regex(/^\+?[0-9]+$/, 'Invalid phone number format'),
  message: z.string().min(1).max(400).optional(),
});
