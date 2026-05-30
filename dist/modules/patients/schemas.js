"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPregnancySchema = exports.createProfileSchema = void 0;
const zod_1 = require("zod");
exports.createProfileSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    age: zod_1.z.number().int().min(10).max(60).optional(),
    education_level: zod_1.z.string().optional(),
    occupation: zod_1.z.string().optional(),
    marital_status: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    religion: zod_1.z.string().optional(),
    ethnicity: zod_1.z.string().optional(),
    language_preference: zod_1.z.enum(['en', 'pidgin']).optional(),
});
exports.createPregnancySchema = zod_1.z.object({
    lmp_date: zod_1.z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date format'),
    booking_weight: zod_1.z.number().positive().optional(),
    booking_height: zod_1.z.number().positive().optional(),
    booking_bp_systolic: zod_1.z.number().int().positive().optional(),
    booking_bp_diastolic: zod_1.z.number().int().positive().optional(),
    blood_group: zod_1.z.string().optional(),
    genotype: zod_1.z.string().optional(),
    rvd_status: zod_1.z.string().optional(),
    vdrl: zod_1.z.string().optional(),
    pcv: zod_1.z.number().optional(),
    hep_b: zod_1.z.string().optional(),
    tetanus_history: zod_1.z.string().optional(),
    gravidity: zod_1.z.number().int().min(0).optional(),
    parity: zod_1.z.number().int().min(0).optional(),
});
