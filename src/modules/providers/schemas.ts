import { z } from 'zod';

export const queueQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().default(new Date().toISOString().split('T')[0]),
});

export const visitNotesSchema = z.object({
  doctor_notes: z.string().min(1, 'Notes cannot be empty'),
  /** When true, mark appointment completed. Autosave should leave this false. */
  complete: z.boolean().optional().default(false),
});

export const visitIdParamSchema = z.object({
  id: z.string().uuid('Invalid visit/appointment ID'),
});

export const askQuestionSchema = z.object({
  question: z.string().min(5, 'Question must be at least 5 characters long').max(1000, 'Question is too long'),
  patient_id: z.string().uuid('Invalid patient ID').optional(),
});

/** Doctor updates index pregnancy / booking investigations for a patient */
export const doctorPregnancyUpdateSchema = z.object({
  lmp_date: z
    .string()
    .refine((val) => !val || !isNaN(Date.parse(val)), 'Invalid LMP date')
    .optional()
    .nullable(),
  booking_weight: z.coerce.number().positive().optional().nullable(),
  booking_height: z.coerce.number().positive().optional().nullable(),
  booking_bp_systolic: z.coerce.number().int().positive().optional().nullable(),
  booking_bp_diastolic: z.coerce.number().int().positive().optional().nullable(),
  blood_group: z.string().optional().nullable(),
  genotype: z.string().optional().nullable(),
  rhesus: z.string().optional().nullable(),
  rvd_status: z.string().optional().nullable(),
  vdrl: z.string().optional().nullable(),
  pcv: z.coerce.number().optional().nullable(),
  hep_b: z.string().optional().nullable(),
  malaria_parasite: z.string().optional().nullable(),
  urinalysis: z.string().optional().nullable(),
  tetanus_history: z.string().optional().nullable(),
  ipt_history: z.string().optional().nullable(),
  uss_date: z
    .string()
    .refine((val) => !val || !isNaN(Date.parse(val)), 'Invalid USS date')
    .optional()
    .nullable(),
  uss_ega_weeks: z.coerce.number().int().min(0).max(45).optional().nullable(),
  uss_notes: z.string().optional().nullable(),
  booked_anc: z.boolean().optional().nullable(),
  booked_anc_facility: z.string().optional().nullable(),
  booking_ga_weeks: z.coerce.number().int().min(0).max(45).optional().nullable(),
  booking_history: z.string().max(10000).optional().nullable(),
  hep_c: z.string().optional().nullable(),
  rbg: z.string().optional().nullable(),
  ogtt: z.string().optional().nullable(),
  extra_labs: z
    .object({
      protein: z.string().optional().nullable(),
      glucose: z.string().optional().nullable(),
      additional_test: z.string().optional().nullable(),
      additional_result: z.string().optional().nullable(),
      request_investigation: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    })
    .partial()
    .optional()
    .nullable(),
  vitals_log: z
    .array(
      z.object({
        id: z.string().optional(),
        date: z.string().optional().nullable(),
        bp_systolic: z.union([z.string(), z.number()]).optional().nullable(),
        bp_diastolic: z.union([z.string(), z.number()]).optional().nullable(),
        pr: z.union([z.string(), z.number()]).optional().nullable(),
        weight_kg: z.union([z.string(), z.number()]).optional().nullable(),
        height_cm: z.union([z.string(), z.number()]).optional().nullable(),
        rr: z.union([z.string(), z.number()]).optional().nullable(),
        temp_c: z.union([z.string(), z.number()]).optional().nullable(),
        protein: z.string().optional().nullable(),
        glucose: z.string().optional().nullable(),
      })
    )
    .optional()
    .nullable(),
  drugs_vaccines: z
    .object({
      medications: z.string().optional().nullable(),
      ipt: z
        .array(
          z.object({
            dose: z.string().optional().nullable(),
            ga_weeks: z.union([z.string(), z.number()]).optional().nullable(),
          })
        )
        .optional()
        .nullable(),
      tt: z
        .array(
          z.object({
            dose: z.string().optional().nullable(),
            ga_weeks: z.union([z.string(), z.number()]).optional().nullable(),
          })
        )
        .optional()
        .nullable(),
    })
    .partial()
    .optional()
    .nullable(),
  scans_log: z
    .array(
      z.object({
        id: z.string().optional(),
        date: z.string().optional().nullable(),
        ga_weeks: z.union([z.string(), z.number()]).optional().nullable(),
        notes: z.string().optional().nullable(),
      })
    )
    .optional()
    .nullable(),
  examination: z
    .object({
      lie: z.string().optional().nullable(),
      presentation: z.string().optional().nullable(),
      sfh: z.string().optional().nullable(),
      fetal_heart: z.string().optional().nullable(),
    })
    .partial()
    .optional()
    .nullable(),
  important_remarks: z.string().max(20000).optional().nullable(),
  gravidity: z.coerce.number().int().min(0).optional().nullable(),
  parity: z.coerce.number().int().min(0).optional().nullable(),
});
