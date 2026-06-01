import { env } from '../config/env';
import { logger } from '../utils/logger';
import prisma from '../config/prisma';

interface EmailPayload {
  to: string;
  subject: string;
  htmlContent: string;
}

export const brevoService = {
  /**
   * Send a transactional email via Brevo (Sendinblue) API
   */
  async sendEmail(payload: EmailPayload): Promise<{ message_id: string | null }> {
    const url = 'https://api.brevo.com/v3/smtp/email';

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': env.BREVO_API_KEY,
        },
        body: JSON.stringify({
          sender: {
            name: 'Mama Care AI',
            email: env.BREVO_SENDER_EMAIL,
          },
          to: [{ email: payload.to }],
          subject: payload.subject,
          htmlContent: payload.htmlContent,
        }),
      });

      const data = await response.json() as any;
      const messageId = data?.messageId || null;

      // Log to notifications_log
      await prisma.notificationsLog.create({
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
        logger.error({ data }, 'Brevo email send failed');
        throw new Error(`Brevo email failed: ${JSON.stringify(data)}`);
      }

      logger.info({ to: payload.to, message_id: messageId }, 'Email sent via Brevo');
      return { message_id: messageId };
    } catch (err) {
      logger.error({ err, to: payload.to }, 'Failed to send email via Brevo');
      throw err;
    }
  },
};
