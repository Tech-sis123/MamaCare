"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.visitIdParamSchema = exports.visitNotesSchema = exports.queueQuerySchema = void 0;
const zod_1 = require("zod");
exports.queueQuerySchema = zod_1.z.object({
    date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().default(new Date().toISOString().split('T')[0]),
});
exports.visitNotesSchema = zod_1.z.object({
    doctor_notes: zod_1.z.string().min(1, 'Notes cannot be empty'),
});
exports.visitIdParamSchema = zod_1.z.object({
    id: zod_1.z.string().uuid('Invalid visit/appointment ID'),
});
