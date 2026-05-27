import { Router } from 'express';
import { alertsController } from './controller';
import { authenticate } from '../../middleware/auth';
import { rbac } from '../../middleware/rbac';

const router = Router();

// SSE subscribe — doctor-only
router.get(
  '/subscribe',
  authenticate,
  rbac('doctor', 'department_head'),
  alertsController.subscribe
);

// Acknowledge an alert
router.post(
  '/:id/acknowledge',
  authenticate,
  rbac('doctor', 'department_head'),
  alertsController.acknowledge
);

export default router;
