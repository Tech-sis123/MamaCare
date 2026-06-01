"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.appointmentsController = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const redis_1 = require("../../config/redis");
const errors_1 = require("../../utils/errors");
// Clinic hours: 8:00 to 16:00 (30-minute slots)
const CLINIC_START_HOUR = 8;
const CLINIC_END_HOUR = 16;
const SLOT_DURATION_MIN = 30;
exports.appointmentsController = {
    /**
     * GET /appointments/available?date=YYYY-MM-DD&doctor_id=...
     * Returns 30-minute slots not yet booked.
     */
    async getAvailableSlots(req, res, next) {
        try {
            const { date, doctor_id } = req.query;
            const dayStart = new Date(`${date}T00:00:00`);
            const dayEnd = new Date(`${date}T23:59:59`);
            // Get existing bookings for this doctor on this date
            const existing = await prisma_1.default.appointment.findMany({
                where: {
                    doctor_id,
                    slot_start: { gte: dayStart, lte: dayEnd },
                    status: { in: ['booked', 'completed'] },
                },
                select: { slot_start: true },
            });
            const bookedStarts = new Set(existing.map((a) => a.slot_start.toISOString()));
            // Generate all possible slots
            const slots = [];
            for (let hour = CLINIC_START_HOUR; hour < CLINIC_END_HOUR; hour++) {
                for (let min = 0; min < 60; min += SLOT_DURATION_MIN) {
                    const slotStart = new Date(`${date}T${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`);
                    const slotEnd = new Date(slotStart.getTime() + SLOT_DURATION_MIN * 60 * 1000);
                    if (!bookedStarts.has(slotStart.toISOString())) {
                        slots.push({
                            slot_start: slotStart.toISOString(),
                            slot_end: slotEnd.toISOString(),
                            available: true,
                        });
                    }
                }
            }
            res.status(200).json({ date, doctor_id, slots });
        }
        catch (err) {
            next(err);
        }
    },
    /**
     * POST /appointments — book an appointment.
     * Requires Idempotency-Key header.
     */
    async createAppointment(req, res, next) {
        try {
            const patientId = req.user.id;
            const { doctor_id, slot_start } = req.body;
            // Idempotency check
            const idempotencyKey = req.headers['idempotency-key'];
            if (!idempotencyKey) {
                res.status(400).json({ error: 'Idempotency-Key header is required' });
                return;
            }
            const cacheKey = `idempotency:appointment:${idempotencyKey}`;
            const cached = await redis_1.redis.get(cacheKey);
            if (cached) {
                res.status(200).json(JSON.parse(cached));
                return;
            }
            const slotStartDate = new Date(slot_start);
            const slotEndDate = new Date(slotStartDate.getTime() + SLOT_DURATION_MIN * 60 * 1000);
            // Check for conflicts
            const conflict = await prisma_1.default.appointment.findFirst({
                where: {
                    doctor_id,
                    slot_start: slotStartDate,
                    status: { in: ['booked', 'completed'] },
                },
            });
            if (conflict) {
                throw new errors_1.ConflictError('This time slot is already booked');
            }
            const appointment = await prisma_1.default.appointment.create({
                data: {
                    patient_id: patientId,
                    doctor_id,
                    slot_start: slotStartDate,
                    slot_end: slotEndDate,
                    status: 'booked',
                    idempotency_key: idempotencyKey,
                },
            });
            // Audit log
            await prisma_1.default.auditLog.create({
                data: {
                    actor_type: 'patient',
                    actor_id: patientId,
                    action: 'appointment_booked',
                    resource_type: 'appointment',
                    resource_id: appointment.id,
                    before: null,
                    after: appointment,
                },
            });
            const responsePayload = { appointment };
            await redis_1.redis.set(cacheKey, JSON.stringify(responsePayload), 'EX', 86400);
            res.status(201).json(responsePayload);
        }
        catch (err) {
            next(err);
        }
    },
    /**
     * PATCH /appointments/:id/reschedule
     */
    async reschedule(req, res, next) {
        try {
            const { id } = req.params;
            const { slot_start } = req.body;
            const existing = await prisma_1.default.appointment.findUnique({ where: { id } });
            if (!existing) {
                throw new errors_1.NotFoundError('Appointment not found');
            }
            const newSlotStart = new Date(slot_start);
            const newSlotEnd = new Date(newSlotStart.getTime() + SLOT_DURATION_MIN * 60 * 1000);
            // Check for conflicts at new time
            const conflict = await prisma_1.default.appointment.findFirst({
                where: {
                    doctor_id: existing.doctor_id,
                    slot_start: newSlotStart,
                    status: { in: ['booked', 'completed'] },
                    id: { not: id },
                },
            });
            if (conflict) {
                throw new errors_1.ConflictError('The new time slot is already booked');
            }
            const updated = await prisma_1.default.appointment.update({
                where: { id },
                data: {
                    slot_start: newSlotStart,
                    slot_end: newSlotEnd,
                },
            });
            // Audit log
            await prisma_1.default.auditLog.create({
                data: {
                    actor_type: req.user.type,
                    actor_id: req.user.id,
                    action: 'appointment_rescheduled',
                    resource_type: 'appointment',
                    resource_id: id,
                    before: { slot_start: existing.slot_start, slot_end: existing.slot_end },
                    after: { slot_start: newSlotStart, slot_end: newSlotEnd },
                },
            });
            res.status(200).json({ appointment: updated });
        }
        catch (err) {
            next(err);
        }
    },
    /**
     * DELETE /appointments/:id — cancel
     */
    async cancel(req, res, next) {
        try {
            const { id } = req.params;
            const existing = await prisma_1.default.appointment.findUnique({ where: { id } });
            if (!existing) {
                throw new errors_1.NotFoundError('Appointment not found');
            }
            const updated = await prisma_1.default.appointment.update({
                where: { id },
                data: { status: 'cancelled' },
            });
            // Audit log
            await prisma_1.default.auditLog.create({
                data: {
                    actor_type: req.user.type,
                    actor_id: req.user.id,
                    action: 'appointment_cancelled',
                    resource_type: 'appointment',
                    resource_id: id,
                    before: { status: existing.status },
                    after: { status: 'cancelled' },
                },
            });
            res.status(200).json({ appointment: updated });
        }
        catch (err) {
            next(err);
        }
    },
};
