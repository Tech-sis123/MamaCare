"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const controller_1 = require("./controller");
const validate_1 = require("../../middleware/validate");
const rateLimiter_1 = require("../../middleware/rateLimiter");
const schemas_1 = require("./schemas");
const router = (0, express_1.Router)();
// Patient OTP flow
router.post('/patient/otp/request', rateLimiter_1.authRateLimiter, (0, validate_1.validate)(schemas_1.otpRequestSchema), controller_1.authController.patientOtpRequest);
router.post('/patient/otp/verify', rateLimiter_1.authRateLimiter, (0, validate_1.validate)(schemas_1.otpVerifySchema), controller_1.authController.patientOtpVerify);
// Doctor login
router.post('/doctor/login', rateLimiter_1.authRateLimiter, (0, validate_1.validate)(schemas_1.doctorLoginSchema), controller_1.authController.doctorLogin);
// Token refresh
router.post('/refresh', (0, validate_1.validate)(schemas_1.refreshTokenSchema), controller_1.authController.refreshToken);
exports.default = router;
