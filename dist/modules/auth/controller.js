"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const prisma_1 = __importDefault(require("../../config/prisma"));
const env_1 = require("../../config/env");
const termii_1 = require("../../services/termii");
const redis_1 = require("../../config/redis");
const errors_1 = require("../../utils/errors");
function generateTokens(payload) {
    const access_token = jsonwebtoken_1.default.sign(payload, env_1.env.JWT_SECRET, {
        expiresIn: env_1.env.JWT_ACCESS_EXPIRY,
    });
    const refresh_token = jsonwebtoken_1.default.sign({ ...payload, tokenType: 'refresh' }, env_1.env.JWT_SECRET, {
        expiresIn: env_1.env.JWT_REFRESH_EXPIRY,
    });
    return { access_token, refresh_token };
}
exports.authController = {
    /**
     * POST /auth/patient/otp/request
     * Sends OTP to patient phone via Termii, creates patient if new
     */
    async patientOtpRequest(req, res, next) {
        try {
            const { phone_number } = req.body;
            const result = await termii_1.termiiService.requestOTP({ phone_number });
            // Store mapping in Redis (expires in 15 minutes)
            await redis_1.redis.set(`otp:${result.pin_id}`, phone_number, 'EX', 900);
            res.status(200).json({ pin_id: result.pin_id });
        }
        catch (err) {
            next(err);
        }
    },
    /**
     * POST /auth/patient/otp/verify
     * Verifies OTP and returns JWT tokens
     */
    async patientOtpVerify(req, res, next) {
        try {
            const { pin_id, code } = req.body;
            // Look up the phone number associated with this pin_id in Redis
            const phone_number = await redis_1.redis.get(`otp:${pin_id}`);
            if (!phone_number) {
                throw new errors_1.UnauthorizedError('OTP session expired or invalid');
            }
            const result = await termii_1.termiiService.verifyOTP({ pin_id, pin: code });
            if (!result.verified) {
                throw new errors_1.UnauthorizedError('Invalid or expired OTP');
            }
            // Upsert patient now that their phone is verified
            const patient = await prisma_1.default.patient.upsert({
                where: { phone_number },
                update: {},
                create: { phone_number },
            });
            // Cleanup OTP session
            await redis_1.redis.del(`otp:${pin_id}`);
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
        }
        catch (err) {
            next(err);
        }
    },
    /**
     * POST /auth/doctor/login
     * Email + password auth for doctors
     */
    async doctorLogin(req, res, next) {
        try {
            const { email, password } = req.body;
            const doctor = await prisma_1.default.doctor.findUnique({ where: { email } });
            if (!doctor) {
                throw new errors_1.UnauthorizedError('Invalid email or password');
            }
            const valid = await bcrypt_1.default.compare(password, doctor.password_hash);
            if (!valid) {
                throw new errors_1.UnauthorizedError('Invalid email or password');
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
        }
        catch (err) {
            next(err);
        }
    },
    /**
     * POST /auth/refresh
     * Refresh access token using refresh token
     */
    async refreshToken(req, res, next) {
        try {
            const { refresh_token } = req.body;
            const decoded = jsonwebtoken_1.default.verify(refresh_token, env_1.env.JWT_SECRET);
            if (decoded.tokenType !== 'refresh') {
                throw new errors_1.UnauthorizedError('Invalid refresh token');
            }
            const tokens = generateTokens({
                id: decoded.id,
                role: decoded.role,
                type: decoded.type,
            });
            res.status(200).json(tokens);
        }
        catch (err) {
            if (err instanceof jsonwebtoken_1.default.JsonWebTokenError) {
                next(new errors_1.UnauthorizedError('Invalid or expired refresh token'));
            }
            else {
                next(err);
            }
        }
    },
};
