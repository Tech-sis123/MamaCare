"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.brevoService = void 0;
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
const prisma_1 = __importDefault(require("../config/prisma"));
exports.brevoService = {
    /**
     * Send a transactional email via Brevo (Sendinblue) API
     */
    async sendEmail(payload) {
        const url = 'https://api.brevo.com/v3/smtp/email';
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': env_1.env.BREVO_API_KEY,
                },
                body: JSON.stringify({
                    sender: {
                        name: 'Mama Care AI',
                        email: env_1.env.BREVO_SENDER_EMAIL,
                    },
                    to: [{ email: payload.to }],
                    subject: payload.subject,
                    htmlContent: payload.htmlContent,
                }),
            });
            const data = await response.json();
            const messageId = data?.messageId || null;
            // Log to notifications_log
            await prisma_1.default.notificationsLog.create({
                data: {
                    channel: 'email',
                    recipient: payload.to,
                    payload: { subject: payload.subject },
                    provider_message_id: messageId,
                    status: response.ok ? 'sent' : 'failed',
                    error: response.ok ? null : JSON.stringify(data),
                },
            });
            if (!response.ok) {
                logger_1.logger.error({ data }, 'Brevo email send failed');
                throw new Error(`Brevo email failed: ${JSON.stringify(data)}`);
            }
            logger_1.logger.info({ to: payload.to, message_id: messageId }, 'Email sent via Brevo');
            return { message_id: messageId };
        }
        catch (err) {
            logger_1.logger.error({ err, to: payload.to }, 'Failed to send email via Brevo');
            throw err;
        }
    },
};
