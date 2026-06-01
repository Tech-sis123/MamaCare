import { Router } from 'express';
import { providersController } from './controller';
import { authenticate } from '../../middleware/auth';
import { rbac } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { queueQuerySchema, visitNotesSchema, visitIdParamSchema } from './schemas';
import { patientIdParamSchema } from '../symptoms/schemas';

const router = Router();

// Doctor queue
router.get(
  '/queue',
  authenticate,
  rbac('doctor', 'department_head'),
  validate(queueQuerySchema, 'query'),
  providersController.getQueue
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
