"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.askQuestionSchema = exports.createPregnancySchema = exports.createProfileSchema = void 0;
const zod_1 = require("zod");
exports.createProfileSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required'),
    age: zod_1.z.coerce.number().int().min(10).max(60).optional(),
    education_level: zod_1.z.string().optional(),
    occupation: zod_1.z.string().optional(),
    marital_status: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    religion: zod_1.z.string().optional(),
    ethnicity: zod_1.z.string().optional(),
    language_preference: zod_1.z.enum(['en', 'pidgin']).optional(),
    emergency_contact_name: zod_1.z.string().optional(),
    emergency_contact_relationship: zod_1.z.string().optional(),
    emergency_contact_phone: zod_1.z.string().optional(),
});
exports.createPregnancySchema = zod_1.z.object({
    // Optional so blood group / genotype can save even if LMP is filled later
    lmp_date: zod_1.z
        .string()
        .refine((val) => !val || !isNaN(Date.parse(val)), 'Invalid date format')
        .optional(),
    booking_weight: zod_1.z.number().positive().optional(),
    booking_height: zod_1.z.number().positive().optional(),
    booking_bp_systolic: zod_1.z.number().int().positive().optional(),
    booking_bp_diastolic: zod_1.z.number().int().positive().optional(),
    blood_group: zod_1.z.string().optional(),
    genotype: zod_1.z.string().optional(),
    rhesus: zod_1.z.string().optional(),
    rvd_status: zod_1.z.string().optional(),
    vdrl: zod_1.z.string().optional(),
    pcv: zod_1.z.number().optional(),
    hep_b: zod_1.z.string().optional(),
    malaria_parasite: zod_1.z.string().optional(),
    urinalysis: zod_1.z.string().optional(),
    tetanus_history: zod_1.z.string().optional(),
    ipt_history: zod_1.z.string().optional(),
    uss_date: zod_1.z
        .string()
        .refine((val) => !val || !isNaN(Date.parse(val)), 'Invalid USS date')
        .optional(),
    uss_ega_weeks: zod_1.z.number().int().min(0).max(45).optional(),
    uss_notes: zod_1.z.string().optional(),
    booked_anc: zod_1.z.boolean().optional(),
    booked_anc_facility: zod_1.z.string().optional(),
    booking_ga_weeks: zod_1.z.number().int().min(0).max(45).optional(),
    gravidity: zod_1.z.number().int().min(0).optional(),
    parity: zod_1.z.number().int().min(0).optional(),
});
exports.askQuestionSchema = zod_1.z.object({
    question: zod_1.z.string().min(5, "Question must be at least 5 characters long").max(500, "Question is too long"),
});
