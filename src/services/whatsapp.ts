import { logger } from '../utils/logger';
import prisma from '../config/prisma';
import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';

interface WhatsAppMessagePayload {
  to: string; // Phone number in international format (e.g. 2348012345678)
  message: string;
}

let client: Client;
let isReady = false;

export const initWhatsApp = () => {
  client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    }
  });

  client.on('qr', (qr) => {
    logger.info('Please scan the WhatsApp QR Code below:');
    qrcode.generate(qr, { small: true });
  });

  client.on('ready', () => {
    isReady = true;
    logger.info(' WhatsApp client is ready!');
  });

  client.on('auth_failure', (msg) => {
    logger.error('WhatsApp authentication failure', { msg });
  });

  client.on('disconnected', (reason) => {
    isReady = false;
    logger.warn('WhatsApp disconnected', { reason });
  });

  client.initialize().catch((err) => {
    logger.error('Failed to initialize WhatsApp client', { err });
  });
};

export const whatsappService = {
  /**
   * Send a WhatsApp text message via whatsapp-web.js
   */
  async sendMessage(payload: WhatsAppMessagePayload): Promise<{ message_id: string | null }> {
    if (!client || !isReady) {
      logger.error('WhatsApp client is not ready. Skipping message to ' + payload.to);
      return { message_id: null };
    }

    try {
      // Format number for whatsapp-web.js (remove any + and append @c.us)
      const formattedNumber = payload.to.replace('+', '') + '@c.us';
      
      const response = await client.sendMessage(formattedNumber, payload.message);
      const messageId = response.id.id;

      // Log to notifications_log
      await prisma.notificationsLog.create({
        data: {
          channel: 'whatsapp',
          recipient: payload.to,
          payload: { message: payload.message },
          provider_message_id: messageId,
          status: 'sent',
          error: null,
        },
      });

      logger.info({ to: payload.to, message_id: messageId }, 'WhatsApp message sent');
      return { message_id: messageId };
    } catch (err: any) {
      logger.error({ err, to: payload.to }, 'Failed to send WhatsApp message');
      
      await prisma.notificationsLog.create({
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
  async sendEmergencyAlert(params: {
    patientPhone: string;
    doctorPhone: string;
    patientName: string;
    triggers: string[];
  }): Promise<void> {
    const alertMessage = `🚨 MAMA CARE EMERGENCY ALERT 🚨\n\nPatient: ${params.patientName}\nDanger Signs: ${params.triggers.join(', ')}\n\nPlease respond immediately.`;

    const patientMessage = `🚨 URGENT: Your symptoms indicate a potential emergency.\n\nDanger Signs: ${params.triggers.join(', ')}\n\nPlease proceed to the hospital immediately or call your doctor.`;

    // Send both in parallel to minimize latency
    await Promise.allSettled([
      whatsappService.sendMessage({ to: params.doctorPhone, message: alertMessage }),
      whatsappService.sendMessage({ to: params.patientPhone, message: patientMessage }),
    ]);
  },
};
