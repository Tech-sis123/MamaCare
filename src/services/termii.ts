import { env } from '../config/env';
import { logger } from '../utils/logger';
import prisma from '../config/prisma';

interface TermiiSMSPayload {
  to: string;
  sms: string;
}

interface TermiiOTPRequestPayload {
  phone_number: string;
}

interface TermiiOTPVerifyPayload {
  pin_id: string;
  pin: string;
}

export const termiiService = {
  /**
   * Send an SMS via Termii API
   */
  async sendSMS(payload: TermiiSMSPayload): Promise<{ message_id: string }> {
    const url = `${env.TERMII_BASE_URL}/sms/send`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: payload.to,
          from: env.TERMII_SENDER_ID,
          sms: payload.sms,
          type: 'plain',
          channel: 'generic',
          api_key: env.TERMII_API_KEY,
        }),
      });

      const data = await response.json() as any;

      // Log to notifications_log
      await prisma.notificationsLog.create({
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
        logger.error({ data }, 'Termii SMS send failed');
        throw new Error(`Termii SMS failed: ${JSON.stringify(data)}`);
      }

      logger.info({ to: payload.to, message_id: data.message_id }, 'SMS sent via Termii');
      return { message_id: data.message_id };
    } catch (err) {
      logger.error({ err, to: payload.to }, 'Failed to send SMS via Termii');
      throw err;
    }
  },

  /**
   * Request OTP via Termii
   */
  async requestOTP(payload: TermiiOTPRequestPayload): Promise<{ pin_id: string }> {
    const url = `${env.TERMII_BASE_URL}/sms/otp/send`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: env.TERMII_API_KEY,
          message_type: 'NUMERIC',
          to: payload.phone_number,
          from: env.TERMII_SENDER_ID,
          channel: 'generic',
          pin_attempts: 3,
          pin_time_to_live: 10,
          pin_length: 6,
          pin_placeholder: '< 1234 >',
          message_text: 'Your Mama Care verification code is < 1234 >. Valid for 10 minutes.',
          pin_type: 'NUMERIC',
        }),
      });

      const data = await response.json() as any;
      
      if (!response.ok) {
        logger.error({ data }, 'Termii OTP request failed');
        throw new Error(`Termii OTP request failed: ${JSON.stringify(data)}`);
      }

      logger.info({ phone: payload.phone_number, pin_id: data.pinId }, 'OTP requested via Termii');
      return { pin_id: data.pinId };
    } catch (err) {
      logger.error({ err, phone: payload.phone_number }, 'Failed to request OTP');
      throw err;
    }
  },

  /**
   * Verify OTP via Termii
   */
  async verifyOTP(payload: TermiiOTPVerifyPayload): Promise<{ verified: boolean }> {
    const url = `${env.TERMII_BASE_URL}/sms/otp/verify`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: env.TERMII_API_KEY,
          pin_id: payload.pin_id,
          pin: payload.pin,
        }),
      });

      const data = await response.json() as any;

      if (!response.ok) {
        logger.error({ data }, 'Termii OTP verify failed');
        return { verified: false };
      }

      return { verified: data.verified === 'True' || data.verified === true };
    } catch (err) {
      logger.error({ err }, 'Failed to verify OTP');
      return { verified: false };
    }
  },
};
