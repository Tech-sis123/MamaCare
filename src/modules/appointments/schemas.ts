import { z } from 'zod';

export const availableSlotsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  doctor_id: z.string().uuid('Invalid doctor ID'),
});

export const createAppointmentSchema = z.object({
  doctor_id: z.string().uuid(),
  slot_start: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid datetime'),
});

export const rescheduleSchema = z.object({
  slot_start: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid datetime'),
});

export const appointmentIdParamSchema = z.object({
  id: z.string().uuid('Invalid appointment ID'),
});
