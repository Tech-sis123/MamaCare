/** Versioned local draft for doctor consultation fields (offline / outage safety). */

const VERSION = 'v1';

const draftKey = (patientId) => `mamacare_consult:${VERSION}:${patientId || 'demo'}`;
const legacyKey = (patientId) => `mamacare_review_${patientId || 'demo'}`;

export function readConsultationDraft(patientId) {
  try {
    const raw = localStorage.getItem(draftKey(patientId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.data) return parsed;
    }
    const legacy = localStorage.getItem(legacyKey(patientId));
    if (legacy) {
      const data = JSON.parse(legacy);
      return { v: VERSION, savedAt: 0, data };
    }
  } catch {
    /* quota / private mode */
  }
  return null;
}

export function writeConsultationDraft(patientId, data) {
  try {
    localStorage.setItem(
      draftKey(patientId),
      JSON.stringify({ v: VERSION, savedAt: Date.now(), data })
    );
  } catch {
    /* quota / private mode */
  }
}
