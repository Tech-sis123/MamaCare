"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.patientEmailVerifySchema = exports.patientEmailRequestSchema = exports.resetPasswordSchema = exports.doctorForgotPasswordSchema = exports.doctorRegisterSchema = exports.refreshTokenSchema = exports.doctorLoginSchema = exports.patientRegisterEmailSchema = exports.patientLoginSchema = exports.patientSetCredentialsSchema = exports.otpVerifySchema = exports.otpRequestSchema = void 0;
const zod_1 = require("zod");
exports.otpRequestSchema = zod_1.z.object({
    phone_number: zod_1.z
        .string()
        .min(10, 'Phone number must be at least 10 digits')
        .max(15, 'Phone number too long')
        .regex(/^\+?[0-9]+$/, 'Invalid phone number format'),
    channel: zod_1.z.enum(['sms', 'whatsapp']).optional(),
});
exports.otpVerifySchema = zod_1.z.object({
    pin_id: zod_1.z.string().min(1, 'pin_id is required'),
    code: zod_1.z
        .string()
        .length(6, 'OTP code must be 6 digits')
        .regex(/^[0-9]+$/, 'OTP code must be numeric'),
});
/** After OTP signup — set email + password for future password logins (no OTP). */
exports.patientSetCredentialsSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email'),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
    name: zod_1.z.string().min(2, 'Name is required').optional(),
    age: zod_1.z.number().int().min(10).max(60).optional(),
});
/** Returning patients log in with email + password (no OTP). */
exports.patientLoginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email'),
    password: zod_1.z.string().min(1, 'Password is required'),
});
/** Direct email+password signup — no OTP required. */
exports.patientRegisterEmailSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email'),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
    name: zod_1.z.string().min(2, 'Name is required').optional(),
    phone_number: zod_1.z.string().optional(),
});
exports.doctorLoginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email'),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
});
exports.refreshTokenSchema = zod_1.z.object({
    refresh_token: zod_1.z.string().min(1, 'refresh_token is required'),
});
exports.doctorRegisterSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email'),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
    name: zod_1.z.string().min(2, 'Name is required'),
    hospital: zod_1.z.string().optional(),
    phone_number: zod_1.z.string().trim().optional().nullable().transform(val => val === '' ? null : val),
});
exports.doctorForgotPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email'),
});
exports.resetPasswordSchema = zod_1.z.object({
    token: zod_1.z.string().min(1, 'Token is required'),
    new_password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
});
/** Patient adds or updates email (OTP accounts, or email change). */
exports.patientEmailRequestSchema = zod_1.z.object({
    email: zod_1.z.string().email('Enter a valid email address, not a phone number or username'),
});
exports.patientEmailVerifySchema = zod_1.z.object({
    token: zod_1.z.string().min(1, 'Token is required'),
});
