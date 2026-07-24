import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import prisma from '../../config/prisma';
import { env } from '../../config/env';
import { termiiService } from '../../services/termii';
import { redis } from '../../config/redis';
import { AppError, NotFoundError, UnauthorizedError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { whatsappService } from '../../services/whatsapp';
import crypto from 'crypto';
import { brevoService } from '../../services/brevo';

function generateTokens(payload: { id: string; role: string; type: string }) {
  const access_token = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRY as any,
  });
  const refresh_token = jwt.sign({ ...payload, tokenType: 'refresh' }, env.JWT_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRY as any,
  });
  return { access_token, refresh_token };
}

export const authController = {
  /**
   * POST /auth/patient/otp/request
   * Sends OTP to patient phone via Termii, creates patient if new
   */
  async patientOtpRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const { phone_number, channel } = req.body;

      if (channel === 'whatsapp') {
        const pin_id = `wa-${Date.now()}`;
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        await redis.set(`otp:${pin_id}`, phone_number, 'EX', 900);
        await redis.set(`otp:code:${pin_id}`, code, 'EX', 900);

        await whatsappService.sendMessage({
          to: phone_number,
          message: `Your Mama Care verification code is ${code}. Valid for 15 minutes.`
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
   * Verifies OTP and returns JWT tokens
   */
  async patientOtpVerify(req: Request, res: Response, next: NextFunction) {
    try {
      const { pin_id, code } = req.body;

      // Look up the phone number associated with this pin_id in Redis
      const phone_number = await redis.get(`otp:${pin_id}`);
      if (!phone_number) {
        throw new UnauthorizedError('OTP session expired or invalid');
      }

      // Dev mode: verify against stored dev code
      const devCode = await redis.get(`otp:code:${pin_id}`);
      if (devCode) {
        if (code !== devCode) throw new UnauthorizedError('Invalid or expired OTP');
        await redis.del(`otp:code:${pin_id}`);
      } else {
        const result = await termiiService.verifyOTP({ pin_id, pin: code });
        if (!result.verified) throw new UnauthorizedError('Invalid or expired OTP');
      }

      // Upsert patient now that their phone is verified
      const patient = await prisma.patient.upsert({
        where: { phone_number },
        update: {},
        create: { phone_number },
      });

      // Cleanup OTP session
      await redis.del(`otp:${pin_id}`);

      const tokens = generateTokens({
        id: patient.id,
        role: 'patient',
        type: 'patient',
      });

      res.status(200).json({
        ...tokens,
        patient: {
          id: patient.id,
          phone_number: patient.phone_number,
          name: patient.name,
        },
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
      const { email, password, name } = req.body;

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
};
