import { z } from 'zod';

export const assignDoctorSchema = z.object({
  doctor_id: z.string().uuid(),
});
