import crypto from 'crypto';
import prisma from '../config/prisma';
import { redis } from '../config/redis';

/**
 * TEMPORARY biodata-based account recovery.
 *
 * Many patients signed up with made-up emails (we didn't verify them) and then
 * forgot their password. Until every account has login details the patient can
 * remember, a patient can regain access by matching their name plus at least
 * REQUIRED_EXTRA_MATCHES other details from their profile. This is weaker than
 * an OTP or email link: anyone who knows those details about a patient can get
 * in. Switch it off with PATIENT_RECOVERY_ENABLED=false once it's no longer needed.
 */

export const REQUIRED_EXTRA_MATCHES = 2;
const RECOVERY_TOKEN_TTL_SECONDS = 15 * 60;
const MAX_FAILED_ATTEMPTS_PER_ACCOUNT = 5;
const ACCOUNT_LOCK_SECONDS = 24 * 60 * 60;

export interface RecoveryAnswers {
  full_name: string;
  phone_number?: string | null;
  email?: string | null;
  age?: number | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
}

interface RecoveryCandidate {
  id: string;
  name: string | null;
  phone_number: string;
  email: string | null;
  age: number | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
}

export type MatchedFactor = 'phone_number' | 'email' | 'age' | 'emergency_contact_name' | 'emergency_contact_phone';

const nameTokens = (name?: string | null) =>
  (name || '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2);

/** Name matches when enough words overlap, in any order ("Ada Okafor" ≈ "okafor ada chioma"). */
export function namesMatch(stored: string | null | undefined, given: string, minOverlap = 2): boolean {
  const storedTokens = new Set(nameTokens(stored));
  const givenTokens = new Set(nameTokens(given));
  if (storedTokens.size === 0 || givenTokens.size === 0) return false;
  let overlap = 0;
  for (const t of givenTokens) if (storedTokens.has(t)) overlap++;
  return overlap >= Math.min(minOverlap, storedTokens.size, givenTokens.size);
}

/** Compares the last 10 digits so 0803…, 234803… and +234 803… all match. */
const phoneKey = (phone?: string | null) => {
  if (!phone || phone.startsWith('email-')) return null;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : null;
};

export function matchedFactors(candidate: RecoveryCandidate, answers: RecoveryAnswers): MatchedFactor[] {
  const matched: MatchedFactor[] = [];
  const givenPhone = phoneKey(answers.phone_number);
  if (givenPhone && givenPhone === phoneKey(candidate.phone_number)) matched.push('phone_number');

  const givenEmail = answers.email?.trim().toLowerCase();
  if (givenEmail && givenEmail === candidate.email?.trim().toLowerCase()) matched.push('email');

  // Stored age can be a year out of date
  if (answers.age != null && candidate.age != null && Math.abs(candidate.age - answers.age) <= 1) matched.push('age');

  if (answers.emergency_contact_name && namesMatch(candidate.emergency_contact_name, answers.emergency_contact_name, 1)) {
    matched.push('emergency_contact_name');
  }

  const givenEcPhone = phoneKey(answers.emergency_contact_phone);
  if (givenEcPhone && givenEcPhone === phoneKey(candidate.emergency_contact_phone)) matched.push('emergency_contact_phone');

  return matched;
}

export function isRecoveryMatch(candidate: RecoveryCandidate, answers: RecoveryAnswers) {
  const factors = matchedFactors(candidate, answers);
  return {
    nameMatches: namesMatch(candidate.name, answers.full_name),
    factors,
    ok: namesMatch(candidate.name, answers.full_name) && factors.length >= REQUIRED_EXTRA_MATCHES,
  };
}

const failKey = (patientId: string) => `recover_fail:${patientId}`;
const tokenKey = (token: string) => `patient_recover:${token}`;

async function findCandidates(answers: RecoveryAnswers): Promise<RecoveryCandidate[]> {
  const or: any[] = [];
  const phone = phoneKey(answers.phone_number);
  if (phone) or.push({ phone_number: { endsWith: phone } });
  const ecPhone = phoneKey(answers.emergency_contact_phone);
  if (ecPhone) or.push({ emergency_contact_phone: { endsWith: ecPhone } });
  if (answers.email) or.push({ email: { equals: answers.email.trim().toLowerCase(), mode: 'insensitive' } });
  for (const token of nameTokens(answers.full_name).filter((t) => t.length >= 3)) {
    or.push({ name: { contains: token, mode: 'insensitive' } });
  }
  if (or.length === 0) return [];

  return prisma.patient.findMany({
    where: { OR: or },
    select: {
      id: true,
      name: true,
      phone_number: true,
      email: true,
      age: true,
      emergency_contact_name: true,
      emergency_contact_phone: true,
    },
    take: 200,
  });
}

export interface RecoveryResult {
  ok: boolean;
  reason: 'matched' | 'no_match' | 'ambiguous' | 'locked';
  /** The matched patient on success; accounts that were targeted on failure */
  patientIds: string[];
  token?: string;
  expiresIn?: number;
  factors?: MatchedFactor[];
}

export const patientRecovery = {
  /** Finds exactly one patient whose biodata matches; issues a short-lived recovery token. */
  async attempt(answers: RecoveryAnswers): Promise<RecoveryResult> {
    const candidates = await findCandidates(answers);
    const evaluated = candidates.map((c) => ({ c, ...isRecoveryMatch(c, answers) }));
    const passing = evaluated.filter((e) => e.ok);

    if (passing.length > 1) {
      return { ok: false, reason: 'ambiguous', patientIds: passing.map((e) => e.c.id) };
    }

    if (passing.length === 0) {
      // Count failures against accounts whose name matched, so one patient can't be guessed at forever
      const targeted = evaluated.filter((e) => e.nameMatches).map((e) => e.c.id);
      for (const id of targeted) {
        const n = await redis.incr(failKey(id));
        if (n === 1) await redis.expire(failKey(id), ACCOUNT_LOCK_SECONDS);
      }
      return { ok: false, reason: 'no_match', patientIds: targeted };
    }

    const match = passing[0];
    const failures = Number((await redis.get(failKey(match.c.id))) || 0);
    if (failures >= MAX_FAILED_ATTEMPTS_PER_ACCOUNT) {
      return { ok: false, reason: 'locked', patientIds: [match.c.id] };
    }

    const token = crypto.randomBytes(32).toString('hex');
    await redis.set(tokenKey(token), match.c.id, 'EX', RECOVERY_TOKEN_TTL_SECONDS);
    await redis.del(failKey(match.c.id));
    return {
      ok: true,
      reason: 'matched',
      patientIds: [match.c.id],
      token,
      expiresIn: RECOVERY_TOKEN_TTL_SECONDS,
      factors: match.factors,
    };
  },

  /** Returns the patient id for a recovery token, or null if expired/used. */
  async patientIdForToken(token: string): Promise<string | null> {
    return redis.get(tokenKey(token));
  },

  async consumeToken(token: string) {
    await redis.del(tokenKey(token));
  },
};
