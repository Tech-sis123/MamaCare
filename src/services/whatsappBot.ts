import prisma from '../config/prisma';
import { redis } from '../config/redis';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { formatPhoneForTermii } from '../utils/contact';

/**
 * Simple WhatsApp auto-reply bot.
 *
 * When someone texts the clinic number they get a numbered menu and short,
 * generic answers. When they seem to need more help (they pick "talk to a
 * doctor", mention danger signs, or the bot can't understand them twice in a
 * row) the bot gives them the number of the doctor available to them.
 *
 * Transport-agnostic: whichever WhatsApp connection is used later just calls
 * `whatsappBot.reply({ from, text })` and sends back the returned text.
 */

const SESSION_TTL_SECONDS = 60 * 60;
/** Unrecognised messages in a row before the bot hands over to a doctor. */
const MAX_MISSES = 2;

type Session = { misses: number };

type BotPatient = { id: string; name: string | null; primary_doctor_id: string | null };

export type BotContact = { name: string | null; phone: string; source: 'clinic_day' | 'primary' | 'on_call' | 'support' };

const MENU_OPTIONS = [
  '1. Danger signs in pregnancy',
  '2. Appointments',
  '3. Healthy eating & taking your drugs',
  '4. Help with the 9Care app (login, password)',
  '5. Talk to a doctor',
];

/** Words that mean "this may be an emergency": hand over to a doctor straight away. */
const EMERGENCY_RE =
  /\b(bleed(ing)?|convuls\w*|seiz\w*|faint\w*|unconscious|water (has )?(broke|break)|baby (is )?not moving|not feeling (the )?baby|blurr?(ed|y) (vision|eyes)|severe (pain|headache)|swollen face|can'?t breathe|difficulty breathing|emergency)\b/i;

/** Words that mean "I want a person". */
const HUMAN_RE = /\b(doctor|doc|nurse|human|person|call( me)?|talk to|speak to|help me|worried|urgent|sick|pain)\b/i;

const GREETING_RE = /^(hi+|hello|hey|good (morning|afternoon|evening)|menu|start|help|0|options?)\b/i;

const formatPhone = (digits: string) => `+${digits}`;

function firstName(name?: string | null) {
  return (name || '').trim().split(/\s+/)[0] || '';
}

function menuText(patient: BotPatient | null) {
  const hello = firstName(patient?.name) ? `Hello ${firstName(patient?.name)} 👋` : 'Hello 👋';
  return [
    `${hello} Welcome to *9Care AI*.`,
    '',
    'Reply with a number:',
    ...MENU_OPTIONS,
    '',
    '_If you are bleeding, having fits, or your baby has stopped moving, go to the hospital now._',
  ].join('\n');
}

const FOOTER = '\n\nReply *5* to talk to a doctor, or *0* for the menu.';

const TOPIC_REPLIES: Record<string, string> = {
  '1': [
    '*Danger signs in pregnancy*',
    'Go to the hospital *immediately* if you have any of these:',
    '• Bleeding from your private part',
    '• Fits (convulsions) or fainting',
    '• Very bad headache or blurred vision',
    '• Swelling of your face or hands',
    '• Severe belly pain',
    '• Water breaking before your time',
    '• Your baby is moving less or has stopped moving',
    '• High fever or difficulty breathing',
    '',
    'Do not wait for a reply on WhatsApp in an emergency.',
  ].join('\n'),
  '2': [
    '*Appointments*',
    'You can see your next visit or tap *Book appointment* on the home page of the 9Care app.',
    'Please come with your antenatal card and any test results.',
    'If you missed an appointment, book a new one as soon as you can.',
  ].join('\n'),
  '3': [
    '*Healthy eating & your drugs*',
    '• Eat beans, eggs, fish, meat, and green vegetables like ugwu and spinach',
    '• Take your iron and folic acid every day as your clinic told you',
    '• Take iron with water or orange juice, not with tea, pap or milk',
    '• Drink plenty of clean water',
    '• Sleep under a treated mosquito net and take your malaria-prevention drugs (IPT) at clinic',
    '• Do not take any drug or herbs without asking your doctor',
  ].join('\n'),
  '4': [
    '*Help with the 9Care app*',
    '• Forgot your password or used a wrong email? On the login page tap *Forgot your login?* and enter your details.',
    '• You can log in with your email or your username.',
    '• Your health information, lessons and appointments are all in the app.',
  ].join('\n'),
};

function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
}

/** All the ways a Nigerian number may have been saved on a patient record. */
export function phoneCandidates(raw: string): string[] {
  const intl = formatPhoneForTermii(raw);
  const local = intl.startsWith('234') ? `0${intl.slice(3)}` : intl;
  return Array.from(new Set([intl, `+${intl}`, local, digitsOnly(raw)]));
}

async function findPatient(from: string): Promise<BotPatient | null> {
  try {
    return await prisma.patient.findFirst({
      where: { phone_number: { in: phoneCandidates(from) } },
      select: { id: true, name: true, primary_doctor_id: true },
    });
  } catch (err) {
    logger.warn({ err }, 'WhatsApp bot: patient lookup failed');
    return null;
  }
}

/**
 * The doctor a patient should contact: today's clinic doctor first, then her
 * own doctor, then the on-call doctor. Falls back to the clinic support number.
 */
export async function findAvailableDoctor(patient: BotPatient | null, now = new Date()): Promise<BotContact> {
  const withPhone = { phone_number: { not: null } };
  const select = { name: true, phone_number: true };
  try {
    const today = now.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Africa/Lagos' });
    const clinicDay = await prisma.doctor.findFirst({ where: { clinic_days: { has: today }, ...withPhone }, select });
    if (clinicDay?.phone_number) return { name: clinicDay.name, phone: formatPhoneForTermii(clinicDay.phone_number), source: 'clinic_day' };

    if (patient?.primary_doctor_id) {
      const primary = await prisma.doctor.findFirst({ where: { id: patient.primary_doctor_id, ...withPhone }, select });
      if (primary?.phone_number) return { name: primary.name, phone: formatPhoneForTermii(primary.phone_number), source: 'primary' };
    }

    const config = await prisma.systemConfig.findFirst();
    if (config?.on_call_doctor_id) {
      const onCall = await prisma.doctor.findFirst({ where: { id: config.on_call_doctor_id, ...withPhone }, select });
      if (onCall?.phone_number) return { name: onCall.name, phone: formatPhoneForTermii(onCall.phone_number), source: 'on_call' };
    }
  } catch (err) {
    logger.warn({ err }, 'WhatsApp bot: doctor lookup failed');
  }
  return { name: null, phone: digitsOnly(env.SUPPORT_WHATSAPP_NUMBER), source: 'support' };
}

function doctorText(contact: BotContact, emergency: boolean) {
  const who = contact.name ? `*${contact.name}*` : 'our clinic team';
  const lines = emergency
    ? [
        '🚨 *This may be an emergency.*',
        'Please go to the nearest hospital *now*. Do not wait for a reply here.',
        '',
        `You can also call ${who} on *${formatPhone(contact.phone)}*.`,
      ]
    : [
        `You can reach ${who} on *${formatPhone(contact.phone)}* (call or WhatsApp).`,
        'Please tell them your name and what is worrying you.',
        '',
        'If it is an emergency, go to the hospital straight away.',
      ];
  return lines.join('\n') + '\n\nReply *0* for the menu.';
}

async function getSession(key: string): Promise<Session> {
  try {
    const raw = await redis.get(key);
    if (raw) return JSON.parse(raw) as Session;
  } catch {
    /* treat as a new conversation */
  }
  return { misses: 0 };
}

async function saveSession(key: string, session: Session) {
  try {
    await redis.set(key, JSON.stringify(session), 'EX', SESSION_TTL_SECONDS);
  } catch (err) {
    logger.warn({ err }, 'WhatsApp bot: could not save session');
  }
}

export const whatsappBot = {
  /**
   * Work out the reply to an incoming WhatsApp message.
   * Returns null when the bot should stay silent.
   */
  async reply(params: { from: string; text?: string | null }): Promise<string | null> {
    if (env.WHATSAPP_BOT_ENABLED !== 'true') return null;
    const from = formatPhoneForTermii(params.from);
    if (!from) return null;

    const text = (params.text || '').trim().slice(0, 500);
    const sessionKey = `wa:bot:${from}`;
    const session = await getSession(sessionKey);
    const patient = await findPatient(from);

    let reply: string;
    if (EMERGENCY_RE.test(text)) {
      reply = doctorText(await findAvailableDoctor(patient), true);
      session.misses = 0;
    } else if (text === '5' || HUMAN_RE.test(text)) {
      reply = doctorText(await findAvailableDoctor(patient), false);
      session.misses = 0;
    } else if (TOPIC_REPLIES[text]) {
      reply = TOPIC_REPLIES[text] + FOOTER;
      session.misses = 0;
    } else if (!text || GREETING_RE.test(text)) {
      reply = menuText(patient);
      session.misses = 0;
    } else {
      session.misses += 1;
      if (session.misses >= MAX_MISSES) {
        reply = "Sorry, I couldn't understand that. A doctor can help you better.\n\n" +
          doctorText(await findAvailableDoctor(patient), false);
        session.misses = 0;
      } else {
        reply = "Sorry, I didn't understand that.\n\n" + menuText(patient);
      }
    }

    await saveSession(sessionKey, session);
    return reply;
  },
};
