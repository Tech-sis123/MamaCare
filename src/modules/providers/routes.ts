import { Router } from 'express';
import { providersController } from './controller';
import { authenticate } from '../../middleware/auth';
import { rbac } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { queueQuerySchema, visitNotesSchema, visitIdParamSchema } from './schemas';
import { patientIdParamSchema } from '../symptoms/schemas';

const router = Router();

// List all doctors (for patients selecting who to book with)
router.get(
  '/',
  authenticate,
  rbac('patient', 'doctor', 'department_head'),
  providersController.listDoctors
);

// Doctor queue
router.get(
  '/queue',
  authenticate,
  rbac('doctor', 'department_head'),
  validate(queueQuerySchema, 'query'),
  providersController.getQueue
);

// Search / list patients (doctor-accessible)
router.get(
  '/patients',
  authenticate,
  rbac('doctor', 'department_head'),
  providersController.searchPatients
);

// Patient summary (mounted here but uses patient ID)
router.get(
  '/patients/:id/summary',
  authenticate,
  rbac('doctor', 'department_head'),
  validate(patientIdParamSchema, 'params'),
  providersController.getPatientSummary
);

// Visit notes
router.post(
  '/visits/:id/notes',
  authenticate,
  rbac('doctor', 'department_head'),
  validate(visitIdParamSchema, 'params'),
  validate(visitNotesSchema),
  providersController.createVisitNotes
);

export default router;
