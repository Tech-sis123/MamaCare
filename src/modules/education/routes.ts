import { Router } from 'express';
import { educationController } from './controller';
import { authenticate } from '../../middleware/auth';
import { rbac } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { educationModulesQuerySchema, moduleIdParamSchema, markProgressSchema } from './schemas';

const router = Router();

router.get(
  '/modules',
  authenticate,
  rbac('patient', 'doctor', 'department_head'),
  validate(educationModulesQuerySchema, 'query'),
  educationController.listModules
);

router.get(
  '/modules/:id',
  authenticate,
  rbac('patient', 'doctor', 'department_head'),
  validate(moduleIdParamSchema, 'params'),
  educationController.getModule
);

router.patch(
  '/progress',
  authenticate,
  rbac('patient'),
  validate(markProgressSchema),
  educationController.markProgress
);

export default router;
