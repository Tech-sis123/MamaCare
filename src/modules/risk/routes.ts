import { Router } from 'express';
import { riskController } from './controller';
import { authenticate } from '../../middleware/auth';
import { rbac } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { runRiskSchema, latestRiskParamsSchema } from './schemas';

const router = Router();

router.post(
  '/:patientId/run',
  authenticate,
  rbac('doctor', 'department_head'),
  validate(runRiskSchema, 'params'),
  riskController.runRisk
);

router.get(
  '/:patientId/latest',
  authenticate,
  rbac('patient', 'doctor', 'department_head'),
  validate(latestRiskParamsSchema, 'params'),
  riskController.getLatest
);

export default router;
