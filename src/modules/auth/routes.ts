import { Router } from 'express';
import { authController } from './controller';
import { validate } from '../../middleware/validate';
import { authRateLimiter } from '../../middleware/rateLimiter';
import {
  otpRequestSchema,
  otpVerifySchema,
  doctorLoginSchema,
  refreshTokenSchema,
  doctorRegisterSchema,
  doctorForgotPasswordSchema,
  resetPasswordSchema,
} from './schemas';

const router = Router();

// Patient OTP flow
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
