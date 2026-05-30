"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshTokenSchema = exports.doctorLoginSchema = exports.otpVerifySchema = exports.otpRequestSchema = void 0;
const zod_1 = require("zod");
exports.otpRequestSchema = zod_1.z.object({
    phone_number: zod_1.z
        .string()
        .min(10, 'Phone number must be at least 10 digits')
        .max(15, 'Phone number too long')
        .regex(/^\+?[0-9]+$/, 'Invalid phone number format'),
});
exports.otpVerifySchema = zod_1.z.object({
    pin_id: zod_1.z.string().min(1, 'pin_id is required'),
    code: zod_1.z
        .string()
        .length(6, 'OTP code must be 6 digits')
        .regex(/^[0-9]+$/, 'OTP code must be numeric'),
});
exports.doctorLoginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email'),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
});
exports.refreshTokenSchema = zod_1.z.object({
    refresh_token: zod_1.z.string().min(1, 'refresh_token is required'),
});
