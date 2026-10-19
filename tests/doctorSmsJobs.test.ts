import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/config/redis', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  return { redis: new RedisMock() };
});

vi.mock('../src/config/prisma', () => ({
  default: { auditLog: { create: vi.fn().mockResolvedValue({}) } },
}));

vi.mock('../src/services/termii', () => ({
  termiiService: { sendSMS: vi.fn() },
}));

import { doctorSmsJobs } from '../src/services/doctorSmsJobs';
import { termiiService } from '../src/services/termii';
import prisma from '../src/config/prisma';

const createJob = (doctorId = 'doc-1') =>
  doctorSmsJobs.create({
    doctorId,
    message: 'Hello from 9Care',
    recipients: [
      { phone: '2348011111111', name: 'Ada', source: 'patient' },
      { phone: '2348022222222', name: null, source: 'manual' },
      { phone: '2348033333333', name: null, source: 'manual' },
    ],
    totalTargeted: 4,
    manualNumbers: 2,
    skippedNoPhone: 1,
    invalidManualNumbers: [],
  });

describe('doctor SMS jobs', () => {
  beforeEach(() => {
    vi.mocked(termiiService.sendSMS).mockReset();
  });

  it('starts every number as waiting', async () => {
    const id = await createJob();
    const job = await doctorSmsJobs.getForDoctor(id, 'doc-1');

    expect(job?.state).toBe('sending');
    expect(job?.queued).toBe(3);
    expect(job?.results.map((r) => r.phone)).toEqual(['2348011111111', '2348022222222', '2348033333333']);
  });

  it('records which numbers went through and which did not', async () => {
    vi.mocked(termiiService.sendSMS)
      .mockResolvedValueOnce({ message_id: 'm-1' })
      .mockRejectedValueOnce(new Error('Termii SMS failed: {"message":"Insufficient balance"}'))
      .mockResolvedValueOnce({ message_id: 'skipped-no-key' });

    const id = await createJob();
    await doctorSmsJobs.run(id);
    const job = await doctorSmsJobs.getForDoctor(id, 'doc-1');

    expect(job?.state).toBe('completed');
    expect(job?.sent).toBe(1);
    expect(job?.failed).toBe(2);
    expect(job?.results.map((r) => [r.status, r.error])).toEqual([
      ['sent', undefined],
      ['failed', 'Insufficient balance'],
      ['failed', 'SMS gateway is not configured'],
    ]);
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it('hides a job from other doctors', async () => {
    const id = await createJob('doc-1');
    expect(await doctorSmsJobs.getForDoctor(id, 'doc-2')).toBeNull();
  });
});
