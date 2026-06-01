import { Router } from 'express';
import { patientsController } from './controller';
import { authenticate } from '../../middleware/auth';
import { rbac } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { createProfileSchema, createPregnancySchema } from './schemas';

const router = Router();

router.post(
  '/profile',
  authenticate,
  rbac('patient'),
  validate(createProfileSchema),
  patientsController.upsertProfile
);

router.post(
  '/pregnancy',
  authenticate,
  rbac('patient'),
  validate(createPregnancySchema),
  patientsController.createPregnancy
);

router.get(
  '/me',
  authenticate,
  rbac('patient'),
  patientsController.getMe
);

router.get(
  '/me/dashboard',
  authenticate,
  rbac('patient'),
  patientsController.getDashboard
);

export default router;
