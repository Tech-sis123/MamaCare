import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import prisma from '../../config/prisma';
import { env } from '../../config/env';
import { termiiService } from '../../services/termii';
import { redis } from '../../config/redis';
import { AppError, NotFoundError, UnauthorizedError } from '../../utils/errors';
import { logger } from '../../utils/logger';

function generateTokens(payload: { id: string; role: string; type: string }) {
  const access_token = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRY,
  });
  const refresh_token = jwt.sign({ ...payload, tokenType: 'refresh' }, env.JWT_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRY,
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
      const { phone_number } = req.body;

      const result = await termiiService.requestOTP({ phone_number });
      
      // Store mapping in Redis (expires in 15 minutes)
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

      const result = await termiiService.verifyOTP({ pin_id, pin: code });
      if (!result.verified) {
        throw new UnauthorizedError('Invalid or expired OTP');
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
