import { Router } from 'express';
import { symptomsController } from './controller';
import { authenticate } from '../../middleware/auth';
import { rbac } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { symptomInputSchema, patientIdParamSchema, symptomTimelineQuerySchema } from './schemas';

const router = Router();

// POST /symptoms — log symptoms, fires danger detection
router.post(
  '/',
  authenticate,
  rbac('patient'),
  validate(symptomInputSchema),
  symptomsController.logSymptoms
);

// GET /patients/:id/symptoms?range=30d — symptom timeline
// Note: This route is mounted separately on the patients router
export const symptomTimelineRouter = Router();
symptomTimelineRouter.get(
  '/:id/symptoms',
  authenticate,
  rbac('patient', 'doctor', 'department_head'),
  validate(patientIdParamSchema, 'params'),
  validate(symptomTimelineQuerySchema, 'query'),
  symptomsController.getSymptomTimeline
);

export default router;
