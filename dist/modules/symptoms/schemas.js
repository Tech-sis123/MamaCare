"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.alertIdParamSchema = exports.patientIdParamSchema = exports.symptomTimelineQuerySchema = exports.symptomInputSchema = void 0;
const zod_1 = require("zod");
exports.symptomInputSchema = zod_1.z.object({
    symptoms: zod_1.z.array(zod_1.z.object({
        symptom_key: zod_1.z.string().min(1),
        severity: zod_1.z.enum(['mild', 'moderate', 'severe']),
        notes: zod_1.z.string().optional(),
    })).min(1, 'At least one symptom is required'),
});
exports.symptomTimelineQuerySchema = zod_1.z.object({
    range: zod_1.z.string().regex(/^\d+d$/, 'Range must be in format Nd (e.g. 30d)').default('30d'),
});
exports.patientIdParamSchema = zod_1.z.object({
    id: zod_1.z.string().uuid('Invalid patient ID'),
});
exports.alertIdParamSchema = zod_1.z.object({
    id: zod_1.z.string().uuid('Invalid alert ID'),
});
