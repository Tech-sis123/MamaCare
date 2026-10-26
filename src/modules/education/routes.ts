import { Router } from 'express';
import { educationController } from './controller';
import { authenticate } from '../../middleware/auth';
import { commentRateLimiter } from '../../middleware/rateLimiter';
import { educationCommentsController } from './comments';
import { rbac } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import {
  educationModulesQuerySchema,
  moduleIdParamSchema,
  markProgressSchema,
  educationContentSchema,
  educationStatusSchema,
  commentBodySchema,
  moduleCommentParamsSchema,
  commentIdParamSchema,
  doctorCommentsQuerySchema,
  commentHiddenSchema,
} from './schemas';

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

// ── Doctor content management (Education tab in the doctor dashboard) ──

const doctorOnly = [authenticate, rbac('doctor', 'department_head')];

router.get('/manage/modules', ...doctorOnly, educationController.listAllModules);

router.post(
  '/manage/modules',
  ...doctorOnly,
  validate(educationContentSchema),
  educationController.createModule
);

router.put(
  '/manage/modules/:id',
  ...doctorOnly,
  validate(moduleIdParamSchema, 'params'),
  validate(educationContentSchema),
  educationController.updateModule
);

router.patch(
  '/manage/modules/:id/status',
  ...doctorOnly,
  validate(moduleIdParamSchema, 'params'),
  validate(educationStatusSchema),
  educationController.setModuleStatus
);

router.delete(
  '/manage/modules/:id',
  ...doctorOnly,
  validate(moduleIdParamSchema, 'params'),
  educationController.deleteModule
);

// ── Lesson comments: patients comment, doctors reply ──

router.get(
  '/modules/:id/comments',
  authenticate,
  rbac('patient'),
  validate(moduleIdParamSchema, 'params'),
  educationCommentsController.listForPatient
);

router.post(
  '/modules/:id/comments',
  authenticate,
  rbac('patient'),
  commentRateLimiter,
  validate(moduleIdParamSchema, 'params'),
  validate(commentBodySchema),
  educationCommentsController.createByPatient
);

router.delete(
  '/modules/:id/comments/:commentId',
  authenticate,
  rbac('patient'),
  validate(moduleCommentParamsSchema, 'params'),
  educationCommentsController.deleteByPatient
);

router.get(
  '/manage/comments',
  ...doctorOnly,
  validate(doctorCommentsQuerySchema, 'query'),
  educationCommentsController.listForDoctor
);

router.post(
  '/manage/comments/:id/replies',
  ...doctorOnly,
  validate(commentIdParamSchema, 'params'),
  validate(commentBodySchema),
  educationCommentsController.replyByDoctor
);

router.patch(
  '/manage/comments/:id',
  ...doctorOnly,
  validate(commentIdParamSchema, 'params'),
  validate(commentHiddenSchema),
  educationCommentsController.setHiddenByDoctor
);

export default router;
