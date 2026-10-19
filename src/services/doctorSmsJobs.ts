import { randomUUID } from 'crypto';
import prisma from '../config/prisma';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import { termiiService } from './termii';

/**
 * Doctor SMS broadcasts run as background jobs so the dashboard can show,
 * number by number, which messages went through and which did not.
 *
 * Redis layout (expires after JOB_TTL_SECONDS):
 *   sms_job:{id}             JSON job metadata (incl. recipient order)
 *   sms_job:{id}:recipients  hash: formatted phone -> JSON recipient status
 */

const JOB_TTL_SECONDS = 7 * 24 * 60 * 60;
// A "sending" job with no progress for this long was cut short (e.g. server restart)
const STALL_MS = 3 * 60 * 1000;

export type RecipientStatus = 'queued' | 'sending' | 'sent' | 'failed';

export interface SmsJobRecipient {
  phone: string; // formatted, e.g. 2348012345678
  name: string | null;
  source: 'patient' | 'manual';
  status: RecipientStatus;
  error?: string;
  updated_at: string;
}

interface SmsJobMeta {
  id: string;
  doctor_id: string;
  message: string;
  state: 'sending' | 'completed';
  created_at: string;
  finished_at: string | null;
  total_targeted: number;
  manual_numbers: number;
  skipped_no_phone: number;
  invalid_manual_numbers: string[];
  order: string[];
}

const metaKey = (id: string) => `sms_job:${id}`;
const recipientsKey = (id: string) => `sms_job:${id}:recipients`;

async function saveMeta(meta: SmsJobMeta) {
  await redis.set(metaKey(meta.id), JSON.stringify(meta), 'EX', JOB_TTL_SECONDS);
}

async function saveRecipient(jobId: string, recipient: SmsJobRecipient) {
  await redis.hset(recipientsKey(jobId), recipient.phone, JSON.stringify(recipient));
}

/** Turns Termii's raw error ("Termii SMS failed: {...json}") into a short reason. */
function toFailureReason(err: any): string {
  const raw = String(err?.message || 'Send error');
  const jsonStart = raw.indexOf('{');
  if (jsonStart !== -1) {
    try {
      const data = JSON.parse(raw.slice(jsonStart));
      if (data?.message) return String(data.message);
    } catch {
      // not JSON, fall through
    }
  }
  return raw.replace(/^Termii SMS failed:\s*/, '');
}

/** termiiService.sendSMS returns (rather than throws) for these, but nothing was sent. */
const SKIPPED_REASONS: Record<string, string> = {
  'skipped-invalid-phone': 'Invalid phone number',
  'skipped-no-key': 'SMS gateway is not configured',
};

export const doctorSmsJobs = {
  async create(params: {
    doctorId: string;
    message: string;
    recipients: Array<{ phone: string; name: string | null; source: 'patient' | 'manual' }>;
    totalTargeted: number;
    manualNumbers: number;
    skippedNoPhone: number;
    invalidManualNumbers: string[];
  }) {
    const now = new Date().toISOString();
    const meta: SmsJobMeta = {
      id: randomUUID(),
      doctor_id: params.doctorId,
      message: params.message,
      state: 'sending',
      created_at: now,
      finished_at: null,
      total_targeted: params.totalTargeted,
      manual_numbers: params.manualNumbers,
      skipped_no_phone: params.skippedNoPhone,
      invalid_manual_numbers: params.invalidManualNumbers,
      order: params.recipients.map((r) => r.phone),
    };

    await saveMeta(meta);
    if (params.recipients.length > 0) {
      const fields: Record<string, string> = {};
      for (const r of params.recipients) {
        fields[r.phone] = JSON.stringify({ ...r, status: 'queued', updated_at: now } satisfies SmsJobRecipient);
      }
      await redis.hset(recipientsKey(meta.id), fields);
      await redis.expire(recipientsKey(meta.id), JOB_TTL_SECONDS);
    }

    return meta.id;
  },

  /** Sends to every queued recipient one by one, recording each outcome. Not awaited by the request. */
  async run(jobId: string) {
    const meta = await this.loadMeta(jobId);
    if (!meta) return;

    let sent = 0;
    let failed = 0;

    for (const phone of meta.order) {
      const raw = await redis.hget(recipientsKey(jobId), phone);
      if (!raw) continue;
      const recipient: SmsJobRecipient = JSON.parse(raw);

      await saveRecipient(jobId, { ...recipient, status: 'sending', updated_at: new Date().toISOString() });

      let status: RecipientStatus = 'sent';
      let error: string | undefined;
      try {
        const { message_id } = await termiiService.sendSMS({ to: phone, sms: meta.message });
        if (SKIPPED_REASONS[message_id]) {
          status = 'failed';
          error = SKIPPED_REASONS[message_id];
        }
      } catch (err) {
        status = 'failed';
        error = toFailureReason(err);
      }

      if (status === 'sent') sent++;
      else failed++;
      await saveRecipient(jobId, { ...recipient, status, error, updated_at: new Date().toISOString() });
    }

    await saveMeta({ ...meta, state: 'completed', finished_at: new Date().toISOString() });

    await prisma.auditLog.create({
      data: {
        actor_type: 'doctor',
        actor_id: meta.doctor_id,
        action: 'doctor_sms_broadcast',
        resource_type: 'patient_sms',
        resource_id: meta.doctor_id,
        after: {
          job_id: jobId,
          message: meta.message,
          total_targeted: meta.total_targeted,
          manual_numbers: meta.manual_numbers,
          unique_recipients: meta.order.length,
          sent,
          failed,
          skipped_invalid: meta.skipped_no_phone,
          skipped_invalid_manual: meta.invalid_manual_numbers.length,
        },
      },
    });
  },

  /** Starts run() in the background; a crash marks the job completed so the UI stops waiting. */
  start(jobId: string) {
    this.run(jobId).catch(async (err) => {
      logger.error({ err, jobId }, 'Doctor SMS job crashed');
      const meta = await this.loadMeta(jobId).catch(() => null);
      if (meta && meta.state !== 'completed') {
        await saveMeta({ ...meta, state: 'completed', finished_at: new Date().toISOString() }).catch(() => {});
      }
    });
  },

  async loadMeta(jobId: string): Promise<SmsJobMeta | null> {
    const raw = await redis.get(metaKey(jobId));
    return raw ? (JSON.parse(raw) as SmsJobMeta) : null;
  },

  /** Job status for the dashboard, or null if missing / owned by another doctor. */
  async getForDoctor(jobId: string, doctorId: string) {
    const meta = await this.loadMeta(jobId);
    if (!meta || meta.doctor_id !== doctorId) return null;

    const hash = await redis.hgetall(recipientsKey(jobId));
    const results: SmsJobRecipient[] = meta.order
      .map((phone) => (hash[phone] ? (JSON.parse(hash[phone]) as SmsJobRecipient) : null))
      .filter((r): r is SmsJobRecipient => r !== null);

    const lastActivity = Math.max(
      Date.parse(meta.created_at),
      ...results.map((r) => Date.parse(r.updated_at) || 0)
    );
    const state = meta.state === 'sending' && Date.now() - lastActivity > STALL_MS ? 'completed' : meta.state;

    // A recipient left "sending"/"queued" on a completed job means the run was cut short
    if (state === 'completed') {
      for (const r of results) {
        if (r.status === 'queued' || r.status === 'sending') {
          r.status = 'failed';
          r.error = r.error || 'Sending was interrupted';
        }
      }
    }

    const counts = { queued: 0, sending: 0, sent: 0, failed: 0 };
    for (const r of results) counts[r.status]++;

    return {
      job_id: meta.id,
      state,
      message: meta.message,
      created_at: meta.created_at,
      finished_at: meta.finished_at,
      total_targeted: meta.total_targeted,
      manual_numbers: meta.manual_numbers,
      unique_recipients: results.length,
      skipped_no_phone: meta.skipped_no_phone,
      invalid_manual_numbers: meta.invalid_manual_numbers,
      ...counts,
      results,
    };
  },
};
