import prisma from '../config/prisma';
import { logger } from '../utils/logger';

/**
 * Record a patient opening the app.
 * Counts at most one visit per calendar day (UTC) so refreshes don't inflate conversion.
 */
export async function recordPatientSiteVisit(
  patientId: string,
  path = '/dashboard'
): Promise<void> {
  try {
    const now = new Date();
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const existingToday = await prisma.patientSiteVisit.findFirst({
      where: { patient_id: patientId, visited_at: { gte: dayStart } },
      select: { id: true },
    });

    if (existingToday) {
      await prisma.patient.update({
        where: { id: patientId },
        data: { last_seen_at: now },
      });
      return;
    }

    await prisma.$transaction([
      prisma.patientSiteVisit.create({
        data: { patient_id: patientId, visited_at: now, path },
      }),
      prisma.patient.update({
        where: { id: patientId },
        data: { last_seen_at: now, site_visit_count: { increment: 1 } },
      }),
    ]);
  } catch (err) {
    logger.warn({ err, patientId }, 'Failed to record patient site visit');
  }
}
