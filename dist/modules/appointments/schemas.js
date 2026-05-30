"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appointmentIdParamSchema = exports.rescheduleSchema = exports.createAppointmentSchema = exports.availableSlotsQuerySchema = void 0;
const zod_1 = require("zod");
exports.availableSlotsQuerySchema = zod_1.z.object({
    date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
    doctor_id: zod_1.z.string().uuid('Invalid doctor ID'),
});
exports.createAppointmentSchema = zod_1.z.object({
    doctor_id: zod_1.z.string().uuid(),
    slot_start: zod_1.z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid datetime'),
});
exports.rescheduleSchema = zod_1.z.object({
    slot_start: zod_1.z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid datetime'),
});
exports.appointmentIdParamSchema = zod_1.z.object({
    id: zod_1.z.string().uuid('Invalid appointment ID'),
});
