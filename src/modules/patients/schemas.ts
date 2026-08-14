import { z } from 'zod';

export const createProfileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  age: z.coerce.number().int().min(10).max(60).optional(),
  education_level: z.string().optional(),
  occupation: z.string().optional(),
  marital_status: z.string().optional(),
  address: z.string().optional(),
  religion: z.string().optional(),
  ethnicity: z.string().optional(),
  language_preference: z.enum(['en', 'pidgin']).optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_relationship: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
});

export const createPregnancySchema = z.object({
  // Optional so blood group / genotype can save even if LMP is filled later
  lmp_date: z
    .string()
    .refine((val) => !val || !isNaN(Date.parse(val)), 'Invalid date format')
    .optional(),
  booking_weight: z.number().positive().optional(),
  booking_height: z.number().positive().optional(),
  booking_bp_systolic: z.number().int().positive().optional(),
  booking_bp_diastolic: z.number().int().positive().optional(),
  blood_group: z.string().optional(),
  genotype: z.string().optional(),
  rhesus: z.string().optional(),
  rvd_status: z.string().optional(),
  vdrl: z.string().optional(),
  pcv: z.number().optional(),
  hep_b: z.string().optional(),
  malaria_parasite: z.string().optional(),
  urinalysis: z.string().optional(),
  tetanus_history: z.string().optional(),
  ipt_history: z.string().optional(),
  uss_date: z
    .string()
    .refine((val) => !val || !isNaN(Date.parse(val)), 'Invalid USS date')
    .optional(),
  uss_ega_weeks: z.number().int().min(0).max(45).optional(),
  uss_notes: z.string().optional(),
  booked_anc: z.boolean().optional(),
  booked_anc_facility: z.string().optional(),
  booking_ga_weeks: z.number().int().min(0).max(45).optional(),
  gravidity: z.number().int().min(0).optional(),
  parity: z.number().int().min(0).optional(),
});

export const askQuestionSchema = z.object({
  question: z.string().min(5, "Question must be at least 5 characters long").max(500, "Question is too long"),
});
