import { z } from 'zod';
import { COMPLICATION_KEYS } from '../../utils/delivery';

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

export const deliverySchema = z
  .object({
    delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose the date of delivery'),
    had_complications: z.boolean({ error: 'Tell us if you had any complications' }),
    complications: z.array(z.enum(COMPLICATION_KEYS)).default([]),
    other_complication: z.string().trim().max(500).optional().nullable(),
    outcome: z.enum(['alive_well', 'alive_with_complications', 'stillbirth'], { error: 'Choose how the baby is' }),
    mode: z.enum(['vaginal', 'caesarean'], { error: 'Choose the mode of delivery' }),
  })
  .superRefine((data, ctx) => {
    if (isNaN(Date.parse(data.delivery_date))) {
      ctx.addIssue({ code: 'custom', path: ['delivery_date'], message: 'Choose a valid date' });
    }
    if (data.had_complications && data.complications.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['complications'], message: 'Tick at least one complication' });
    }
    if (data.had_complications && data.complications.includes('other') && !data.other_complication) {
      ctx.addIssue({ code: 'custom', path: ['other_complication'], message: 'Type the other complication' });
    }
  });
