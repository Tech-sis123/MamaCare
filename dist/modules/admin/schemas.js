"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testSmsSchema = exports.assignDoctorSchema = void 0;
const zod_1 = require("zod");
exports.assignDoctorSchema = zod_1.z.object({
    doctor_id: zod_1.z.string().uuid(),
});
exports.testSmsSchema = zod_1.z.object({
    phone_number: zod_1.z
        .string()
        .min(10, 'Phone number must be at least 10 digits')
        .regex(/^\+?[0-9]+$/, 'Invalid phone number format'),
    message: zod_1.z.string().min(1).max(400).optional(),
});
