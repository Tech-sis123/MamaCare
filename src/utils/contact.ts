/**
 * Helpers for patient contact quality and doctor-facing risk reasons.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** True when the value is a real email, not a phone number or generated placeholder. */
export function isUsableEmail(email?: string | null): boolean {
  if (!email) return false;
  const value = String(email).trim().toLowerCase();
  if (!EMAIL_RE.test(value)) return false;
  const local = value.split('@')[0] || '';
  if (/^[0-9]+$/.test(local)) return false;
  if (local.startsWith('email-')) return false;
  return true;
}

/** True when the value can be sent via Termii / WhatsApp. */
export function isSmsPhone(phone?: string | null): boolean {
  if (!phone) return false;
  const value = String(phone).trim();
  if (value.startsWith('email-')) return false;
  const digits = value.replace(/[^\d+]/g, '');
  const justDigits = digits.replace(/\D/g, '');
  return justDigits.length >= 10 && justDigits.length <= 15;
}

/** Format phone number to Termii expected international format without leading + (e.g. 2348012345678) */
export function formatPhoneForTermii(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '234' + cleaned.slice(1);
  } else if (!cleaned.startsWith('234') && cleaned.length === 10 && /^[789]/.test(cleaned)) {
    cleaned = '234' + cleaned;
  }
  return cleaned;
}

/** All the ways a Nigerian number may have been saved on a patient record (234…, +234…, 0…). */
export function phoneVariants(raw: string): string[] {
  const intl = formatPhoneForTermii(raw);
  const local = intl.startsWith('234') ? `0${intl.slice(3)}` : intl;
  return Array.from(new Set([intl, `+${intl}`, local, raw.replace(/\D/g, '')]));
}

/**
 * Number with country code (+2348012345678), or null if it isn't a valid phone number.
 * Nigerian numbers can be typed as 0801…, 801…, 234801… or +234 801…;
 * other countries need the + and country code.
 */
export function normalizeWhatsappNumber(raw?: string | null): string | null {
  const value = String(raw ?? '').trim();
  if (!value || /[^\d\s+()-]/.test(value)) return null;
  const international = value.startsWith('+') || value.startsWith('00');
  const digits = formatPhoneForTermii(value.replace(/^00/, ''));
  if (digits.startsWith('234')) {
    // Nigerian mobile numbers: 234 + 10 digits starting 7, 8 or 9
    return /^234[789]\d{9}$/.test(digits) ? `+${digits}` : null;
  }
  return international && /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
}

export function toReasonList(reasons: unknown): string[] {
  if (!Array.isArray(reasons)) return [];
  return reasons
    .map((r) => (typeof r === 'string' ? r : String(r ?? '')).trim())
    .filter(Boolean);
}

function isIncompleteNote(reason: string): boolean {
  return (
    reason.startsWith('Incomplete clinic data') ||
    reason.startsWith('Missing critical field') ||
    reason === 'Genotype not confirmed'
  );
}

/** Clinical drivers of MEDIUM/HIGH vs notes that clinic data is still missing. */
export function splitRiskReasons(reasons: unknown): {
  clinical: string[];
  incomplete: string[];
} {
  const list = toReasonList(reasons);
  const clinical: string[] = [];
  const incomplete: string[] = [];
  for (const reason of list) {
    if (isIncompleteNote(reason)) incomplete.push(reason);
    else clinical.push(reason);
  }
  return { clinical, incomplete };
}
