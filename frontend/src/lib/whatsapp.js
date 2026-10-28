/**
 * WhatsApp number helpers. Same rules as normalizeWhatsappNumber on the server,
 * which has the final say.
 */

/** "+2348012345678" from 0801…, 801…, 234801… or +234 801…; other countries need +. Null if invalid. */
export function toWhatsappNumber(raw) {
  const value = String(raw ?? '').trim();
  if (!value || /[^\d\s+()-]/.test(value)) return null;
  const international = value.startsWith('+') || value.startsWith('00');
  let digits = value.replace(/^00/, '').replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `234${digits.slice(1)}`;
  else if (!digits.startsWith('234') && digits.length === 10 && /^[789]/.test(digits)) digits = `234${digits}`;
  if (digits.startsWith('234')) return /^234[789]\d{9}$/.test(digits) ? `+${digits}` : null;
  return international && /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
}

/** "+234 801 234 5678" for display. */
export function formatWhatsappNumber(number) {
  const m = /^\+234(\d{3})(\d{3})(\d{4})$/.exec(number || '');
  return m ? `+234 ${m[1]} ${m[2]} ${m[3]}` : number || '';
}

export const WHATSAPP_CONSENT_TEXT = 'I agree to receive educational updates and appointment reminders on WhatsApp.';
