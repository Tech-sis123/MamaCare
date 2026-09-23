import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import prisma from '../../config/prisma';
import { env } from '../../config/env';
import { termiiService } from '../../services/termii';
import { redis } from '../../config/redis';
import { AppError, ConflictError, NotFoundError, UnauthorizedError, ValidationError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { whatsappService } from '../../services/whatsapp';
import crypto from 'crypto';
import { brevoService } from '../../services/brevo';
import { AuthRequest } from '../../utils/types';
import { isUsableEmail } from '../../utils/contact';

function generateTokens(payload: { id: string; role: string; type: string }) {
  const access_token = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRY as any,
  });
  const refresh_token = jwt.sign({ ...payload, tokenType: 'refresh' }, env.JWT_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRY as any,
  });
  return { access_token, refresh_token };
}

function patientPublic(patient: {
  id: string;
  phone_number: string;
  email?: string | null;
  email_verified_at?: Date | null;
  name?: string | null;
  age?: number | null;
  intake_status?: string | null;
  intake_first_submitted_at?: Date | null;
  password_hash?: string | null;
}) {
  const email = patient.email ?? null;
  return {
    id: patient.id,
    phone_number: patient.phone_number,
    email,
    email_verified: !!patient.email_verified_at,
    needs_email: !isUsableEmail(email),
    name: patient.name ?? null,
    age: patient.age ?? null,
    has_password: !!patient.password_hash,
    intake_status: patient.intake_status ?? 'not_started',
    intake_first_submitted_at: patient.intake_first_submitted_at ?? null,
  };
}

async function sendPatientEmailVerification(patientId: string, email: string, name?: string | null) {
  const token = crypto.randomBytes(32).toString('hex');
  await redis.set(
    `email_verify:${token}`,
    JSON.stringify({ patientId, email }),
    'EX',
    60 * 60 * 24
  );

  const verifyLink = `${env.CORS_ORIGIN}/verify-email?token=${token}`;
  const htmlContent = `
    <p>Hello ${name || 'Mama'},</p>
    <p>Please confirm this email for your 9Care account so we can send you visit reminders and health updates.</p>
    <p><a href="${verifyLink}">Verify my email</a></p>
    <p>This link expires in 24 hours. If you did not request this, you can ignore this message.</p>
  `;

  if (!env.BREVO_API_KEY) {
    logger.info({ email, verifyLink }, '[DEV] Email verification skipped — no BREVO_API_KEY');
    return { token, verifyLink, sent: false };
  }

  await brevoService.sendEmail({
    to: email,
    subject: 'Confirm your 9Care email',
    htmlContent,
  });
  return { token, verifyLink, sent: true };
}

export const authController = {
  /**
   * POST /auth/patient/otp/request
   * OTP is for **sign-up / first-time phone verification only**.
   * If the phone already has a password set, reject and direct them to email login.
   */
  async patientOtpRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const { phone_number, channel } = req.body;

      const existing = await prisma.patient.findUnique({ where: { phone_number } });
      if (existing?.password_hash) {
        throw new ConflictError(
          'This phone number already has an account. Please log in with your email and password.'
        );
      }

      if (channel === 'whatsapp') {
        const pin_id = `wa-${Date.now()}`;
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        await redis.set(`otp:${pin_id}`, phone_number, 'EX', 900);
        await redis.set(`otp:code:${pin_id}`, code, 'EX', 900);

        await whatsappService.sendMessage({
          to: phone_number,
          message: `Your 9Care verification code is ${code}. Valid for 15 minutes.`,
        });

        return res.status(200).json({ pin_id });
      }

      // Dev mode: skip Termii when API key is not set
      if (!env.TERMII_API_KEY) {
        const pin_id = `dev-${Date.now()}`;
        await redis.set(`otp:${pin_id}`, phone_number, 'EX', 900);
        await redis.set(`otp:code:${pin_id}`, '123456', 'EX', 900);
        logger.info({ phone_number, pin_id, code: '123456' }, '[DEV] OTP bypassed — use code 123456');
        return res.status(200).json({ pin_id, dev_code: '123456' });
      }

      const result = await termiiService.requestOTP({ phone_number });
      await redis.set(`otp:${result.pin_id}`, phone_number, 'EX', 900);
      res.status(200).json({ pin_id: result.pin_id });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /auth/patient/otp/verify
   * Completes sign-up phone verification and returns JWT tokens.
   * Client should then call /auth/patient/credentials to set email + password.
   */
  async patientOtpVerify(req: Request, res: Response, next: NextFunction) {
    try {
      const { pin_id, code } = req.body;

      const phone_number = await redis.get(`otp:${pin_id}`);
      if (!phone_number) {
        throw new UnauthorizedError('OTP session expired or invalid');
      }

      const devCode = await redis.get(`otp:code:${pin_id}`);
      if (devCode) {
        if (code !== devCode) throw new UnauthorizedError('Invalid or expired OTP');
        await redis.del(`otp:code:${pin_id}`);
      } else {
        const result = await termiiService.verifyOTP({ pin_id, pin: code });
        if (!result.verified) throw new UnauthorizedError('Invalid or expired OTP');
      }

      const existing = await prisma.patient.findUnique({ where: { phone_number } });
      if (existing?.password_hash) {
        await redis.del(`otp:${pin_id}`);
        throw new ConflictError(
          'This phone number already has an account. Please log in with your email and password.'
        );
      }

      const patient = await prisma.patient.upsert({
        where: { phone_number },
        update: {},
        create: { phone_number, intake_status: 'not_started' },
      });

      await redis.del(`otp:${pin_id}`);

      const tokens = generateTokens({
        id: patient.id,
        role: 'patient',
        type: 'patient',
      });

      res.status(200).json({
        ...tokens,
        needs_credentials: !patient.password_hash,
        patient: patientPublic(patient),
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /auth/patient/credentials
   * Authenticated. Sets email + password after OTP sign-up (or legacy accounts without password).
   */
  async patientSetCredentials(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const patientId = req.user!.id;
      const { email, password, name, age } = req.body;
      const normalizedEmail = String(email).trim().toLowerCase();

      const patient = await prisma.patient.findUnique({ where: { id: patientId } });
      if (!patient) throw new NotFoundError('Patient not found');

      const emailTaken = await prisma.patient.findFirst({
        where: { email: normalizedEmail, NOT: { id: patientId } },
      });
      if (emailTaken) {
        throw new ConflictError('This email is already registered. Please log in instead.');
      }

      if (!isUsableEmail(normalizedEmail)) {
        throw new ValidationError('Enter a valid email address, not a phone number or username');
      }

      const password_hash = await bcrypt.hash(password, 10);
      const emailChanged = patient.email !== normalizedEmail;
      const updated = await prisma.patient.update({
        where: { id: patientId },
        data: {
          email: normalizedEmail,
          password_hash,
          ...(emailChanged ? { email_verified_at: null } : {}),
          ...(name ? { name } : {}),
          ...(age != null ? { age } : {}),
        },
      });

      await prisma.auditLog.create({
        data: {
          actor_type: 'patient',
          actor_id: patientId,
          action: 'patient_credentials_set',
          resource_type: 'patient',
          resource_id: patientId,
          before: null,
          after: { email: normalizedEmail },
        },
      });

      let verification: { sent: boolean; verifyLink?: string } = { sent: false };
      try {
        const result = await sendPatientEmailVerification(patientId, normalizedEmail, updated.name);
        verification = { sent: result.sent, ...(env.NODE_ENV !== 'production' ? { verifyLink: result.verifyLink } : {}) };
      } catch (err) {
        logger.warn({ err, patientId }, 'Failed to send email verification after credentials set');
      }

      res.status(200).json({
        message: 'Account credentials saved. Check your inbox to verify this email.',
        patient: patientPublic(updated),
        verification_sent: verification.sent,
        ...(verification.verifyLink ? { verification_url: verification.verifyLink } : {}),
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /auth/patient/login
   * Email + password. No OTP on returning login.
   */
  async patientLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const normalizedEmail = String(email).trim().toLowerCase();

      const patient = await prisma.patient.findUnique({ where: { email: normalizedEmail } });
      if (!patient || !patient.password_hash) {
        throw new UnauthorizedError('Invalid email or password');
      }

      const valid = await bcrypt.compare(password, patient.password_hash);
      if (!valid) {
        throw new UnauthorizedError('Invalid email or password');
      }

      const tokens = generateTokens({
        id: patient.id,
        role: 'patient',
        type: 'patient',
      });

      res.status(200).json({
        ...tokens,
        patient: patientPublic(patient),
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /auth/patient/register-email
   * Direct email + password signup — no OTP needed.
   * Creates a new patient and returns JWT tokens.
   */
  async patientRegisterEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, name, phone_number } = req.body;
      const normalizedEmail = String(email).trim().toLowerCase();

      if (!isUsableEmail(normalizedEmail)) {
        throw new ValidationError('Enter a valid email address, not a phone number or username');
      }

      const existing = await prisma.patient.findFirst({ where: { email: normalizedEmail } });
      if (existing) {
        throw new ConflictError('This email is already registered. Please log in instead.');
      }

      const password_hash = await bcrypt.hash(password, 10);
      const patient = await prisma.patient.create({
        data: {
          email: normalizedEmail,
          password_hash,
          phone_number: phone_number || `email-${Date.now()}`,
          name: name || null,
          intake_status: 'not_started',
          email_verified_at: null,
        },
      });

      logger.info({ patientId: patient.id, email: normalizedEmail }, 'Patient registered via email');

      try {
        await sendPatientEmailVerification(patient.id, normalizedEmail, patient.name);
      } catch (err) {
        logger.warn({ err, patientId: patient.id }, 'Failed to send email verification after register');
      }

      const tokens = generateTokens({
        id: patient.id,
        role: 'patient',
        type: 'patient',
      });

      res.status(201).json({
        ...tokens,
        patient: patientPublic(patient),
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /auth/doctor/login
   * Email + password auth for doctors
   */
  async doctorLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;

      const doctor = await prisma.doctor.findUnique({ where: { email } });
      if (!doctor) {
        throw new UnauthorizedError('Invalid email or password');
      }

      const valid = await bcrypt.compare(password, doctor.password_hash);
      if (!valid) {
        throw new UnauthorizedError('Invalid email or password');
      }

      const tokens = generateTokens({
        id: doctor.id,
        role: doctor.role,
        type: 'doctor',
      });

      res.status(200).json({
        ...tokens,
        doctor: {
          id: doctor.id,
          name: doctor.name,
          email: doctor.email,
          role: doctor.role,
          phone_number: doctor.phone_number,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /auth/doctor/register
   * Register a new doctor
   */
  async doctorRegister(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, name, phone_number } = req.body;

      const existing = await prisma.doctor.findUnique({ where: { email } });
      if (existing) {
        throw new AppError('Email already registered', 400);
      }

      const password_hash = await bcrypt.hash(password, 10);
      const doctor = await prisma.doctor.create({
        data: {
          email,
          password_hash,
          name,
          phone_number: phone_number || null,
          role: 'doctor', // default role
        },
      });

      res.status(201).json({ message: 'Doctor registered successfully' });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /auth/doctor/forgot-password
   * Doctor password recovery
   */
  async doctorForgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;
      
      const doctor = await prisma.doctor.findUnique({ where: { email } });
      if (!doctor) {
        // Return 200 anyway to prevent email enumeration
        return res.status(200).json({ message: 'Password recovery email sent (if account exists)' });
      }

      const token = crypto.randomBytes(32).toString('hex');
      
      // Store token in Redis mapped to email, valid for 15 minutes (900 seconds)
      await redis.set(`pwd_reset:${token}`, email, 'EX', 900);

      const resetLink = `${env.CORS_ORIGIN}/reset-password?token=${token}`;
      
      const htmlContent = `
        <p>Hello ${doctor.name},</p>
        <p>You requested a password reset for your Mama Care Provider Portal.</p>
        <p>Please click the link below to reset your password. This link is valid for 15 minutes.</p>
        <p><a href="${resetLink}">Reset Password</a></p>
        <p>If you did not request this, please ignore this email.</p>
      `;

      await brevoService.sendEmail({
        to: email,
        subject: 'Mama Care Provider Portal - Password Reset',
        htmlContent,
      });

      logger.info(`Password recovery email sent to doctor: ${email}`);

      res.status(200).json({ message: 'Password recovery email sent (if account exists)' });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /auth/doctor/reset-password
   * Verify token and reset password
   */
  async doctorResetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, new_password } = req.body;

      const email = await redis.get(`pwd_reset:${token}`);
      if (!email) {
        throw new AppError('Invalid or expired reset token', 400);
      }

      const doctor = await prisma.doctor.findUnique({ where: { email } });
      if (!doctor) {
        throw new AppError('Doctor not found', 404);
      }

      const password_hash = await bcrypt.hash(new_password, 10);
      await prisma.doctor.update({
        where: { email },
        data: { password_hash },
      });

      // Delete the token so it cannot be used again
      await redis.del(`pwd_reset:${token}`);

      logger.info(`Password successfully reset for doctor: ${email}`);

      res.status(200).json({ message: 'Password reset successfully' });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /auth/refresh
   * Refresh access token using refresh token
   */
  async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { refresh_token } = req.body;

      const decoded = jwt.verify(refresh_token, env.JWT_SECRET) as any;
      if (decoded.tokenType !== 'refresh') {
        throw new UnauthorizedError('Invalid refresh token');
      }

      const tokens = generateTokens({
        id: decoded.id,
        role: decoded.role,
        type: decoded.type,
      });

      res.status(200).json(tokens);
    } catch (err) {
      if (err instanceof jwt.JsonWebTokenError) {
        next(new UnauthorizedError('Invalid or expired refresh token'));
      } else {
        next(err);
      }
    }
  },

  /**
   * POST /auth/patient/email/request-verification
   * Authenticated. Save (or change) email and send a verification link.
   */
  async patientRequestEmailVerification(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const patientId = req.user!.id;
      const normalizedEmail = String(req.body.email).trim().toLowerCase();

      if (!isUsableEmail(normalizedEmail)) {
        throw new ValidationError('Enter a valid email address, not a phone number or username');
      }

      const patient = await prisma.patient.findUnique({ where: { id: patientId } });
      if (!patient) throw new NotFoundError('Patient not found');

      const emailTaken = await prisma.patient.findFirst({
        where: { email: normalizedEmail, NOT: { id: patientId } },
      });
      if (emailTaken) {
        throw new ConflictError('This email is already registered. Please log in instead.');
      }

      const emailChanged = patient.email !== normalizedEmail;
      const alreadyVerified = !emailChanged && !!patient.email_verified_at;

      const updated = await prisma.patient.update({
        where: { id: patientId },
        data: {
          email: normalizedEmail,
          ...(emailChanged ? { email_verified_at: null } : {}),
        },
      });

      if (alreadyVerified) {
        return res.status(200).json({
          message: 'This email is already verified.',
          already_verified: true,
          patient: patientPublic(updated),
        });
      }

      const result = await sendPatientEmailVerification(patientId, normalizedEmail, updated.name);

      res.status(200).json({
        message: 'Verification email sent. Check your inbox.',
        already_verified: false,
        verification_sent: result.sent,
        patient: patientPublic(updated),
        ...(env.NODE_ENV !== 'production' ? { verification_url: result.verifyLink } : {}),
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /auth/patient/email/verify  (also used from GET ?token=)
   * Marks the email as verified when the inbox link is opened.
   */
  async patientVerifyEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const rawToken = req.body?.token || req.query?.token;
      const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
      if (!token || typeof token !== 'string') throw new ValidationError('Token is required');

      const raw = await redis.get(`email_verify:${token}`);
      if (!raw) {
        throw new AppError('Invalid or expired verification link', 400);
      }

      let parsed: { patientId: string; email: string };
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new AppError('Invalid verification token', 400);
      }

      const patient = await prisma.patient.findUnique({ where: { id: parsed.patientId } });
      if (!patient) throw new NotFoundError('Patient not found');

      if (patient.email !== parsed.email) {
        throw new AppError('This verification link is for a previous email. Request a new one.', 400);
      }

      const updated = await prisma.patient.update({
        where: { id: patient.id },
        data: { email_verified_at: new Date() },
      });

      await redis.del(`email_verify:${token}`);

      logger.info({ patientId: patient.id }, 'Patient email verified');

      res.status(200).json({
        message: 'Email verified. You can use this address for login and updates.',
        patient: patientPublic(updated),
      });
    } catch (err) {
      next(err);
    }
  },
};
