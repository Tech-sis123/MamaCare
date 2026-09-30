"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateDoctorProfileSchema = exports.doctorPregnancyUpdateSchema = exports.askQuestionSchema = exports.visitIdParamSchema = exports.visitNotesSchema = exports.queueQuerySchema = void 0;
const zod_1 = require("zod");
exports.queueQuerySchema = zod_1.z.object({
    date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().default(new Date().toISOString().split('T')[0]),
});
exports.visitNotesSchema = zod_1.z.object({
    doctor_notes: zod_1.z.string().min(1, 'Notes cannot be empty'),
    /** When true, mark appointment completed. Autosave should leave this false. */
    complete: zod_1.z.boolean().optional().default(false),
});
exports.visitIdParamSchema = zod_1.z.object({
    id: zod_1.z.string().uuid('Invalid visit/appointment ID'),
});
exports.askQuestionSchema = zod_1.z.object({
    question: zod_1.z.string().min(5, 'Question must be at least 5 characters long').max(1000, 'Question is too long'),
    patient_id: zod_1.z.string().uuid('Invalid patient ID').optional(),
});
/** Doctor updates index pregnancy / booking investigations for a patient */
exports.doctorPregnancyUpdateSchema = zod_1.z.object({
    lmp_date: zod_1.z
        .string()
        .refine((val) => !val || !isNaN(Date.parse(val)), 'Invalid LMP date')
        .optional()
        .nullable(),
    booking_weight: zod_1.z.coerce.number().positive().optional().nullable(),
    booking_height: zod_1.z.coerce.number().positive().optional().nullable(),
    booking_bp_systolic: zod_1.z.coerce.number().int().positive().optional().nullable(),
    booking_bp_diastolic: zod_1.z.coerce.number().int().positive().optional().nullable(),
    blood_group: zod_1.z.string().optional().nullable(),
    genotype: zod_1.z.string().optional().nullable(),
    rhesus: zod_1.z.string().optional().nullable(),
    rvd_status: zod_1.z.string().optional().nullable(),
    vdrl: zod_1.z.string().optional().nullable(),
    pcv: zod_1.z.coerce.number().optional().nullable(),
    hep_b: zod_1.z.string().optional().nullable(),
    malaria_parasite: zod_1.z.string().optional().nullable(),
    urinalysis: zod_1.z.string().optional().nullable(),
    tetanus_history: zod_1.z.string().optional().nullable(),
    ipt_history: zod_1.z.string().optional().nullable(),
    uss_date: zod_1.z
        .string()
        .refine((val) => !val || !isNaN(Date.parse(val)), 'Invalid USS date')
        .optional()
        .nullable(),
    uss_ega_weeks: zod_1.z.coerce.number().int().min(0).max(45).optional().nullable(),
    uss_notes: zod_1.z.string().optional().nullable(),
    booked_anc: zod_1.z.boolean().optional().nullable(),
    booked_anc_facility: zod_1.z.string().optional().nullable(),
    booking_ga_weeks: zod_1.z.coerce.number().int().min(0).max(45).optional().nullable(),
    booking_date: zod_1.z
        .string()
        .refine((val) => !val || !isNaN(Date.parse(val)), 'Invalid booking date')
        .optional()
        .nullable(),
    booking_history: zod_1.z.string().max(10000).optional().nullable(),
    hep_c: zod_1.z.string().optional().nullable(),
    rbg: zod_1.z.string().optional().nullable(),
    ogtt: zod_1.z.string().optional().nullable(),
    extra_labs: zod_1.z
        .object({
        protein: zod_1.z.string().optional().nullable(),
        glucose: zod_1.z.string().optional().nullable(),
        additional_test: zod_1.z.string().optional().nullable(),
        additional_result: zod_1.z.string().optional().nullable(),
        additional: zod_1.z
            .array(zod_1.z.object({
            test: zod_1.z.string().optional().nullable(),
            result: zod_1.z.string().optional().nullable(),
        }))
            .optional()
            .nullable(),
        request_investigation: zod_1.z.string().optional().nullable(),
        notes: zod_1.z.string().optional().nullable(),
    })
        .partial()
        .optional()
        .nullable(),
    vitals_log: zod_1.z
        .array(zod_1.z.object({
        id: zod_1.z.string().optional(),
        date: zod_1.z.string().optional().nullable(),
        bp_systolic: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional().nullable(),
        bp_diastolic: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional().nullable(),
        pr: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional().nullable(),
        weight_kg: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional().nullable(),
        height_cm: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional().nullable(),
        rr: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional().nullable(),
        temp_c: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional().nullable(),
        protein: zod_1.z.string().optional().nullable(),
        glucose: zod_1.z.string().optional().nullable(),
    }))
        .optional()
        .nullable(),
    drugs_vaccines: zod_1.z
        .object({
        medications: zod_1.z.string().optional().nullable(),
        ipt: zod_1.z
            .array(zod_1.z.object({
            dose: zod_1.z.string().optional().nullable(),
            ga_weeks: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional().nullable(),
        }))
            .optional()
            .nullable(),
        tt: zod_1.z
            .array(zod_1.z.object({
            dose: zod_1.z.string().optional().nullable(),
            ga_weeks: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional().nullable(),
        }))
            .optional()
            .nullable(),
    })
        .partial()
        .optional()
        .nullable(),
    scans_log: zod_1.z
        .array(zod_1.z.object({
        id: zod_1.z.string().optional(),
        date: zod_1.z.string().optional().nullable(),
        ga_weeks: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional().nullable(),
        notes: zod_1.z.string().optional().nullable(),
    }))
        .optional()
        .nullable(),
    examination: zod_1.z
        .object({
        lie: zod_1.z.string().optional().nullable(),
        presentation: zod_1.z.string().optional().nullable(),
        sfh: zod_1.z.string().optional().nullable(),
        fetal_heart: zod_1.z.string().optional().nullable(),
    })
        .partial()
        .optional()
        .nullable(),
    important_remarks: zod_1.z.string().max(20000).optional().nullable(),
    gravidity: zod_1.z.coerce.number().int().min(0).optional().nullable(),
    parity: zod_1.z.coerce.number().int().min(0).optional().nullable(),
});
exports.updateDoctorProfileSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).optional(),
    phone_number: zod_1.z.string().trim().optional().nullable().transform(val => val === '' ? null : val),
});
