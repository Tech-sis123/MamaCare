import { z } from 'zod';

export const createProfileSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().min(10).max(60).optional(),
  education_level: z.string().optional(),
  occupation: z.string().optional(),
  marital_status: z.string().optional(),
  address: z.string().optional(),
  religion: z.string().optional(),
  ethnicity: z.string().optional(),
  language_preference: z.enum(['en', 'pidgin']).optional(),
});

export const createPregnancySchema = z.object({
  lmp_date: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date format'),
  booking_weight: z.number().positive().optional(),
  booking_height: z.number().positive().optional(),
  booking_bp_systolic: z.number().int().positive().optional(),
  booking_bp_diastolic: z.number().int().positive().optional(),
  blood_group: z.string().optional(),
  genotype: z.string().optional(),
  rvd_status: z.string().optional(),
  vdrl: z.string().optional(),
  pcv: z.number().optional(),
  hep_b: z.string().optional(),
  tetanus_history: z.string().optional(),
  gravidity: z.number().int().min(0).optional(),
  parity: z.number().int().min(0).optional(),
});
