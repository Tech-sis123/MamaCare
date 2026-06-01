"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.termiiService = void 0;
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
const prisma_1 = __importDefault(require("../config/prisma"));
exports.termiiService = {
    /**
     * Send an SMS via Termii API
     */
    async sendSMS(payload) {
        const url = `${env_1.env.TERMII_BASE_URL}/sms/send`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: payload.to,
                    from: env_1.env.TERMII_SENDER_ID,
                    sms: payload.sms,
                    type: 'plain',
                    channel: 'generic',
                    api_key: env_1.env.TERMII_API_KEY,
                }),
            });
            const data = await response.json();
            // Log to notifications_log
            await prisma_1.default.notificationsLog.create({
                data: {
                    channel: 'sms',
                    recipient: payload.to,
                    payload: { message: payload.sms },
                    provider_message_id: data.message_id || null,
                    status: response.ok ? 'sent' : 'failed',
                    error: response.ok ? null : JSON.stringify(data),
                },
            });
            if (!response.ok) {
                logger_1.logger.error({ data }, 'Termii SMS send failed');
                throw new Error(`Termii SMS failed: ${JSON.stringify(data)}`);
            }
            logger_1.logger.info({ to: payload.to, message_id: data.message_id }, 'SMS sent via Termii');
            return { message_id: data.message_id };
        }
        catch (err) {
            logger_1.logger.error({ err, to: payload.to }, 'Failed to send SMS via Termii');
            throw err;
        }
    },
    /**
     * Request OTP via Termii
     */
    async requestOTP(payload) {
        const url = `${env_1.env.TERMII_BASE_URL}/sms/otp/send`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    api_key: env_1.env.TERMII_API_KEY,
                    message_type: 'NUMERIC',
                    to: payload.phone_number,
                    from: env_1.env.TERMII_SENDER_ID,
                    channel: 'generic',
                    pin_attempts: 3,
                    pin_time_to_live: 10,
                    pin_length: 6,
                    pin_placeholder: '< 1234 >',
                    message_text: 'Your Mama Care verification code is < 1234 >. Valid for 10 minutes.',
                    pin_type: 'NUMERIC',
                }),
            });
            const data = await response.json();
            if (!response.ok) {
                logger_1.logger.error({ data }, 'Termii OTP request failed');
                throw new Error(`Termii OTP request failed: ${JSON.stringify(data)}`);
            }
            logger_1.logger.info({ phone: payload.phone_number, pin_id: data.pinId }, 'OTP requested via Termii');
            return { pin_id: data.pinId };
        }
        catch (err) {
            logger_1.logger.error({ err, phone: payload.phone_number }, 'Failed to request OTP');
            throw err;
        }
    },
    /**
     * Verify OTP via Termii
     */
    async verifyOTP(payload) {
        const url = `${env_1.env.TERMII_BASE_URL}/sms/otp/verify`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    api_key: env_1.env.TERMII_API_KEY,
                    pin_id: payload.pin_id,
                    pin: payload.pin,
                }),
            });
            const data = await response.json();
            if (!response.ok) {
                logger_1.logger.error({ data }, 'Termii OTP verify failed');
                return { verified: false };
            }
            return { verified: data.verified === 'True' || data.verified === true };
        }
        catch (err) {
            logger_1.logger.error({ err }, 'Failed to verify OTP');
            return { verified: false };
        }
    },
};
