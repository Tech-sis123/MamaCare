import { z } from 'zod';

export const otpRequestSchema = z.object({
  phone_number: z
    .string()
    .min(10, 'Phone number must be at least 10 digits')
    .max(15, 'Phone number too long')
    .regex(/^\+?[0-9]+$/, 'Invalid phone number format'),
  channel: z.enum(['sms', 'whatsapp']).optional(),
});

export const otpVerifySchema = z.object({
  pin_id: z.string().min(1, 'pin_id is required'),
  code: z
    .string()
    .length(6, 'OTP code must be 6 digits')
    .regex(/^[0-9]+$/, 'OTP code must be numeric'),
});

/** After OTP signup — set email + password for future password logins (no OTP). */
export const patientSetCredentialsSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(2, 'Name is required').optional(),
  age: z.number().int().min(10).max(60).optional(),
});

/** Returning patients log in with email + password (no OTP). */
export const patientLoginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

/** Direct email+password signup — no OTP required. */
export const patientRegisterEmailSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(2, 'Name is required').optional(),
  phone_number: z.string().optional(),
});

export const doctorLoginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const refreshTokenSchema = z.object({
  refresh_token: z.string().min(1, 'refresh_token is required'),
});

export const doctorRegisterSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(2, 'Name is required'),
  hospital: z.string().optional(),
});

export const doctorForgotPasswordSchema = z.object({
  email: z.string().email('Invalid email'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  new_password: z.string().min(6, 'Password must be at least 6 characters'),
});
