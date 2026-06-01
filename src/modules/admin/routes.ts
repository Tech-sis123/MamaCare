import { Router } from 'express';
import { adminController } from './controller';
import { authenticate } from '../../middleware/auth';
import { rbac } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { assignDoctorSchema } from './schemas';

const router = Router();

router.get(
  '/risk-overview',
  authenticate,
  rbac('department_head'),
  adminController.riskOverview
);

router.get(
  '/risk-overview/export',
  authenticate,
  rbac('department_head'),
  adminController.exportRiskOverview
);

router.post(
  '/patients/:id/assign-doctor',
  authenticate,
  rbac('department_head', 'admin'),
  validate(assignDoctorSchema),
  adminController.assignDoctor
);

export default router;
