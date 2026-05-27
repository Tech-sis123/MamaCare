import { Router } from 'express';
import { intakeController } from './controller';
import { authenticate } from '../../middleware/auth';
import { rbac } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { patchIntakeSchema, intakeParamsSchema } from './schemas';

const router = Router();

router.patch(
  '/:patientId',
  authenticate,
  rbac('patient', 'doctor', 'department_head'),
  validate(intakeParamsSchema, 'params'),
  validate(patchIntakeSchema),
  intakeController.patchIntake
);

router.get(
  '/:patientId',
  authenticate,
  rbac('patient', 'doctor', 'department_head'),
  validate(intakeParamsSchema, 'params'),
  intakeController.getIntake
);

router.post(
  '/:patientId/submit',
  authenticate,
  rbac('patient', 'doctor', 'department_head'),
  validate(intakeParamsSchema, 'params'),
  intakeController.submitIntake
);

export default router;
