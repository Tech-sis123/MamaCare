"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const controller_1 = require("./controller");
const validate_1 = require("../../middleware/validate");
const rateLimiter_1 = require("../../middleware/rateLimiter");
const auth_1 = require("../../middleware/auth");
const rbac_1 = require("../../middleware/rbac");
const schemas_1 = require("./schemas");
const router = (0, express_1.Router)();
// Patient OTP — sign-up / first phone verification only
router.post('/patient/otp/request', rateLimiter_1.authRateLimiter, (0, validate_1.validate)(schemas_1.otpRequestSchema), controller_1.authController.patientOtpRequest);
router.post('/patient/otp/verify', rateLimiter_1.authRateLimiter, (0, validate_1.validate)(schemas_1.otpVerifySchema), controller_1.authController.patientOtpVerify);
// Set email + password after OTP sign-up
router.post('/patient/credentials', auth_1.authenticate, (0, rbac_1.rbac)('patient'), rateLimiter_1.authRateLimiter, (0, validate_1.validate)(schemas_1.patientSetCredentialsSchema), controller_1.authController.patientSetCredentials);
// Returning patient login (email + password, no OTP)
router.post('/patient/login', rateLimiter_1.authRateLimiter, (0, validate_1.validate)(schemas_1.patientLoginSchema), controller_1.authController.patientLogin);
// Direct patient signup with email + password (no OTP)
router.post('/patient/register-email', rateLimiter_1.authRateLimiter, (0, validate_1.validate)(schemas_1.patientRegisterEmailSchema), controller_1.authController.patientRegisterEmail);
// Doctor login
router.post('/doctor/login', rateLimiter_1.authRateLimiter, (0, validate_1.validate)(schemas_1.doctorLoginSchema), controller_1.authController.doctorLogin);
// Doctor register
router.post('/doctor/register', rateLimiter_1.authRateLimiter, (0, validate_1.validate)(schemas_1.doctorRegisterSchema), controller_1.authController.doctorRegister);
// Doctor forgot password
router.post('/doctor/forgot-password', rateLimiter_1.authRateLimiter, (0, validate_1.validate)(schemas_1.doctorForgotPasswordSchema), controller_1.authController.doctorForgotPassword);
// Doctor reset password
router.post('/doctor/reset-password', rateLimiter_1.authRateLimiter, (0, validate_1.validate)(schemas_1.resetPasswordSchema), controller_1.authController.doctorResetPassword);
// Token refresh
router.post('/refresh', (0, validate_1.validate)(schemas_1.refreshTokenSchema), controller_1.authController.refreshToken);
// Patient email add / change + verification (complements OTP sign-up)
router.post('/patient/email/request-verification', auth_1.authenticate, (0, rbac_1.rbac)('patient'), rateLimiter_1.authRateLimiter, (0, validate_1.validate)(schemas_1.patientEmailRequestSchema), controller_1.authController.patientRequestEmailVerification);
router.post('/patient/email/verify', rateLimiter_1.authRateLimiter, (0, validate_1.validate)(schemas_1.patientEmailVerifySchema), controller_1.authController.patientVerifyEmail);
router.get('/patient/email/verify', controller_1.authController.patientVerifyEmail);
exports.default = router;
