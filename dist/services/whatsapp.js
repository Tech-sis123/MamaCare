"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.whatsappService = exports.initWhatsApp = void 0;
const logger_1 = require("../utils/logger");
const prisma_1 = __importDefault(require("../config/prisma"));
const whatsapp_web_js_1 = require("whatsapp-web.js");
const qrcode_terminal_1 = __importDefault(require("qrcode-terminal"));
let client;
let isReady = false;
const initWhatsApp = () => {
    client = new whatsapp_web_js_1.Client({
        authStrategy: new whatsapp_web_js_1.LocalAuth(),
        puppeteer: {
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        }
    });
    client.on('qr', (qr) => {
        logger_1.logger.info('Please scan the WhatsApp QR Code below:');
        qrcode_terminal_1.default.generate(qr, { small: true });
    });
    client.on('ready', () => {
        isReady = true;
        logger_1.logger.info('✅ WhatsApp client is ready!');
    });
    client.on('auth_failure', (msg) => {
        logger_1.logger.error('WhatsApp authentication failure', { msg });
    });
    client.on('disconnected', (reason) => {
        isReady = false;
        logger_1.logger.warn('WhatsApp disconnected', { reason });
    });
    client.initialize().catch((err) => {
        logger_1.logger.error('Failed to initialize WhatsApp client', { err });
    });
};
exports.initWhatsApp = initWhatsApp;
exports.whatsappService = {
    /**
     * Send a WhatsApp text message via whatsapp-web.js
     */
    async sendMessage(payload) {
        if (!client || !isReady) {
            logger_1.logger.error('WhatsApp client is not ready. Skipping message to ' + payload.to);
            return { message_id: null };
        }
        try {
            // Format number for whatsapp-web.js (remove any + and append @c.us)
            const formattedNumber = payload.to.replace('+', '') + '@c.us';
            const response = await client.sendMessage(formattedNumber, payload.message);
            const messageId = response.id.id;
            // Log to notifications_log
            await prisma_1.default.notificationsLog.create({
                data: {
                    channel: 'whatsapp',
                    recipient: payload.to,
                    payload: { message: payload.message },
                    provider_message_id: messageId,
                    status: 'sent',
                    error: null,
                },
            });
            logger_1.logger.info({ to: payload.to, message_id: messageId }, 'WhatsApp message sent');
            return { message_id: messageId };
        }
        catch (err) {
            logger_1.logger.error({ err, to: payload.to }, 'Failed to send WhatsApp message');
            await prisma_1.default.notificationsLog.create({
                data: {
                    channel: 'whatsapp',
                    recipient: payload.to,
                    payload: { message: payload.message },
                    provider_message_id: null,
                    status: 'failed',
                    error: JSON.stringify(err.message || err),
                },
            });
            throw err;
        }
    },
    /**
     * Send an emergency alert via WhatsApp
     */
    async sendEmergencyAlert(params) {
        const alertMessage = `🚨 MAMA CARE EMERGENCY ALERT 🚨\n\nPatient: ${params.patientName}\nDanger Signs: ${params.triggers.join(', ')}\n\nPlease respond immediately.`;
        const patientMessage = `🚨 URGENT: Your symptoms indicate a potential emergency.\n\nDanger Signs: ${params.triggers.join(', ')}\n\nPlease proceed to the hospital immediately or call your doctor.`;
        // Send both in parallel to minimize latency
        await Promise.allSettled([
            exports.whatsappService.sendMessage({ to: params.doctorPhone, message: alertMessage }),
            exports.whatsappService.sendMessage({ to: params.patientPhone, message: patientMessage }),
        ]);
    },
};
