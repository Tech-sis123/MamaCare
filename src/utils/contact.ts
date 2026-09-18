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
