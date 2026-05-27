import { z } from 'zod';

export const otpRequestSchema = z.object({
  phone_number: z
    .string()
    .min(10, 'Phone number must be at least 10 digits')
    .max(15, 'Phone number too long')
    .regex(/^\+?[0-9]+$/, 'Invalid phone number format'),
});

export const otpVerifySchema = z.object({
  pin_id: z.string().min(1, 'pin_id is required'),
  code: z
    .string()
    .length(6, 'OTP code must be 6 digits')
    .regex(/^[0-9]+$/, 'OTP code must be numeric'),
});

export const doctorLoginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const refreshTokenSchema = z.object({
  refresh_token: z.string().min(1, 'refresh_token is required'),
});
