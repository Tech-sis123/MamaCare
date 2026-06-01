import { Router } from 'express';
import { appointmentsController } from './controller';
import { authenticate } from '../../middleware/auth';
import { rbac } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import {
  availableSlotsQuerySchema,
  createAppointmentSchema,
  rescheduleSchema,
  appointmentIdParamSchema,
} from './schemas';

const router = Router();

router.get(
  '/available',
  authenticate,
  rbac('patient', 'doctor', 'department_head'),
  validate(availableSlotsQuerySchema, 'query'),
  appointmentsController.getAvailableSlots
);

router.post(
  '/',
  authenticate,
  rbac('patient'),
  validate(createAppointmentSchema),
  appointmentsController.createAppointment
);

router.patch(
  '/:id/reschedule',
  authenticate,
  rbac('patient', 'doctor', 'department_head'),
  validate(appointmentIdParamSchema, 'params'),
  validate(rescheduleSchema),
  appointmentsController.reschedule
);

router.delete(
  '/:id',
  authenticate,
  rbac('patient', 'doctor', 'department_head'),
  validate(appointmentIdParamSchema, 'params'),
  appointmentsController.cancel
);

export default router;
