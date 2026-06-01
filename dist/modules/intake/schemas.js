"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.intakeParamsSchema = exports.patchIntakeSchema = void 0;
const zod_1 = require("zod");
const intakeDomainEnum = zod_1.z.enum([
    'biodata',
    'obstetric',
    'gynae',
    'medical',
    'surgical',
    'allergies',
    'family_social',
]);
exports.patchIntakeSchema = zod_1.z.object({
    domain: intakeDomainEnum,
    responses: zod_1.z.array(zod_1.z.object({
        question_key: zod_1.z.string().min(1),
        answer: zod_1.z.any(),
    })).min(1),
});
exports.intakeParamsSchema = zod_1.z.object({
    patientId: zod_1.z.string().uuid('Invalid patient ID'),
});
