import { Router } from 'express';
import { authController } from './controller';
import { validate } from '../../middleware/validate';
import { authRateLimiter } from '../../middleware/rateLimiter';
import { authenticate } from '../../middleware/auth';
import { rbac } from '../../middleware/rbac';
import {
  otpRequestSchema,
  otpVerifySchema,
  patientLoginSchema,
  patientSetCredentialsSchema,
  patientRegisterEmailSchema,
  doctorLoginSchema,
  refreshTokenSchema,
  doctorRegisterSchema,
  doctorForgotPasswordSchema,
  resetPasswordSchema,
} from './schemas';

const router = Router();

// Patient OTP — sign-up / first phone verification only
router.post(
  '/patient/otp/request',
  authRateLimiter,
  validate(otpRequestSchema),
  authController.patientOtpRequest
);

router.post(
  '/patient/otp/verify',
  authRateLimiter,
  validate(otpVerifySchema),
  authController.patientOtpVerify
);

// Set email + password after OTP sign-up
router.post(
  '/patient/credentials',
  authenticate,
  rbac('patient'),
  authRateLimiter,
  validate(patientSetCredentialsSchema),
  authController.patientSetCredentials
);

// Returning patient login (email + password, no OTP)
router.post(
  '/patient/login',
  authRateLimiter,
  validate(patientLoginSchema),
  authController.patientLogin
);

// Direct patient signup with email + password (no OTP)
router.post(
  '/patient/register-email',
  authRateLimiter,
  validate(patientRegisterEmailSchema),
  authController.patientRegisterEmail
);

// Doctor login
router.post(
  '/doctor/login',
  authRateLimiter,
  validate(doctorLoginSchema),
  authController.doctorLogin
);

// Doctor register
router.post(
  '/doctor/register',
  authRateLimiter,
  validate(doctorRegisterSchema),
  authController.doctorRegister
);

// Doctor forgot password
router.post(
  '/doctor/forgot-password',
  authRateLimiter,
  validate(doctorForgotPasswordSchema),
  authController.doctorForgotPassword
);

// Doctor reset password
router.post(
  '/doctor/reset-password',
  authRateLimiter,
  validate(resetPasswordSchema),
  authController.doctorResetPassword
);

// Token refresh
router.post('/refresh', validate(refreshTokenSchema), authController.refreshToken);

export default router;
