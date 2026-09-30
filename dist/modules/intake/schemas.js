"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.intakeParamsSchema = exports.patchIntakeSchema = void 0;
exports.normalizeIntakeDomain = normalizeIntakeDomain;
const zod_1 = require("zod");
const intakeDomainEnum = zod_1.z.enum([
    'biodata',
    'index',
    'obstetric',
    'gynae',
    'medical',
    'surgical',
    'allergies',
    'family_social',
    'social',
    'systems',
    'symptoms',
]);
function normalizeIntakeDomain(domain) {
    switch (domain) {
        case 'social':
            return 'family_social';
        case 'symptoms':
            return 'systems';
        default:
            return domain;
    }
}
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
