import prisma from '../config/prisma';
import { logger } from '../utils/logger';
import { isSmsPhone, normalizeWhatsappNumber } from '../utils/contact';

/**
 * A patient's WhatsApp number and her consent to receive updates on it.
 *
 * Verification (later): once the WhatsApp connection is live, send a code to
 * whatsapp_number and set whatsapp_verified / whatsapp_verified_at when she types
 * it in. Saving a different number always resets verification, so the code step
 * can sit after saveNumber() without changing how numbers are stored.
 */

export interface WhatsappFields {
  phone_number?: string | null;
  whatsapp_number?: string | null;
  whatsapp_consent?: boolean | null;
  whatsapp_consent_at?: Date | null;
  whatsapp_verified?: boolean | null;
  account_recovered_at?: Date | null;
}

/** The phone number she signed up with, in +234 form, if it's a real number. */
export function usablePhone(phone?: string | null): string | null {
  return isSmsPhone(phone) ? normalizeWhatsappNumber(phone) : null;
}

/** Ask for a WhatsApp number after account recovery, at every login, until she saves one. */
export function needsWhatsappPrompt(p: WhatsappFields): boolean {
  return !!p.account_recovered_at && !p.whatsapp_number;
}

/** What the patient app shows about her WhatsApp number. */
export function whatsappStatus(p: WhatsappFields) {
  return {
    number: p.whatsapp_number ?? null,
    consent: p.whatsapp_consent === true,
    consent_at: p.whatsapp_consent ? p.whatsapp_consent_at ?? null : null,
    verified: !!p.whatsapp_number && !!p.whatsapp_verified,
    /** Offered as "Is this also your WhatsApp number?" */
    phone_number: usablePhone(p.phone_number),
    prompt: needsWhatsappPrompt(p),
  };
}

/**
 * Where to send her WhatsApp messages, or null to send none.
 * - Withdrew consent: nothing.
 * - Saved a WhatsApp number with consent: that number.
 * - Never asked (older accounts): her sign-up phone, as before.
 */
export function whatsappRecipient(p: WhatsappFields): string | null {
  if (p.whatsapp_consent === false) return null;
  if (p.whatsapp_consent === true && p.whatsapp_number) return p.whatsapp_number;
  return isSmsPhone(p.phone_number) ? (p.phone_number as string) : null;
}

const STATUS_SELECT = {
  phone_number: true,
  whatsapp_number: true,
  whatsapp_consent: true,
  whatsapp_consent_at: true,
  whatsapp_verified: true,
  account_recovered_at: true,
} as const;

async function audit(patientId: string, action: string, before: object, after: object) {
  await prisma.auditLog
    .create({
      data: { actor_type: 'patient', actor_id: patientId, action, resource_type: 'patient', resource_id: patientId, before, after },
    })
    .catch((err) => logger.warn({ err, patientId, action }, 'Failed to audit WhatsApp change'));
}

export const whatsappContact = {
  /** Saves her WhatsApp number with consent. `number` must already be normalized. */
  async saveNumber(patientId: string, number: string, source: 'prompt' | 'profile') {
    const before = await prisma.patient.findUnique({ where: { id: patientId }, select: STATUS_SELECT });
    const changed = before?.whatsapp_number !== number;
    const renewConsent = changed || before?.whatsapp_consent !== true;
    const updated = await prisma.patient.update({
      where: { id: patientId },
      data: {
        whatsapp_number: number,
        whatsapp_consent: true,
        ...(renewConsent ? { whatsapp_consent_at: new Date() } : {}),
        ...(changed ? { whatsapp_verified: false, whatsapp_verified_at: null } : {}),
      },
      select: STATUS_SELECT,
    });
    await audit(
      patientId,
      'whatsapp_number_saved',
      { whatsapp_number: before?.whatsapp_number ?? null, whatsapp_consent: before?.whatsapp_consent ?? null },
      { whatsapp_number: number, whatsapp_consent: true, source }
    );
    return whatsappStatus(updated);
  },

  /** She no longer wants WhatsApp messages. The number is kept so she can turn them back on. */
  async withdrawConsent(patientId: string) {
    const before = await prisma.patient.findUnique({ where: { id: patientId }, select: STATUS_SELECT });
    const updated = await prisma.patient.update({
      where: { id: patientId },
      data: { whatsapp_consent: false, whatsapp_consent_at: null },
      select: STATUS_SELECT,
    });
    await audit(
      patientId,
      'whatsapp_consent_withdrawn',
      { whatsapp_consent: before?.whatsapp_consent ?? null, whatsapp_consent_at: before?.whatsapp_consent_at ?? null },
      { whatsapp_consent: false }
    );
    return whatsappStatus(updated);
  },
};
