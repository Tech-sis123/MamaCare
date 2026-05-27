/**
 * MAMA CARE AI — SSE Alert Controller
 *
 * CLINICAL SAFETY CRITICAL CODE
 *
 * GET /alerts/subscribe — SSE stream for doctors:
 * 1. Authenticate, extract doctor_id from JWT
 * 2. Set SSE headers (Content-Type: text/event-stream, no cache, keep-alive)
 * 3. Stream LRANGE doctor:{doctorId}:active_alerts 0 -1 as initial events
 * 4. SUBSCRIBE doctor:{doctorId}:alerts and forward each message as SSE event
 * 5. Send heartbeat comment every 25 seconds
 * 6. On client disconnect, unsubscribe cleanly
 *
 * Uses a SEPARATE ioredis client for SUBSCRIBE.
 */

import { Response, NextFunction } from 'express';
import prisma from '../../config/prisma';
import { redis, createSubscriberClient } from '../../config/redis';
import { AuthRequest } from '../../utils/types';
import { NotFoundError } from '../../utils/errors';
import { logger } from '../../utils/logger';

export const alertsController = {
  /**
   * GET /alerts/subscribe — SSE stream for the authenticated doctor
   */
  async subscribe(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const doctorId = req.user!.id;

      // Set SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      });

      // Flush headers
      res.flushHeaders();

      // Step 3: Send initial alerts from the Redis list
      const existingAlerts = await redis.lrange(`doctor:${doctorId}:active_alerts`, 0, -1);
      for (const alertJson of existingAlerts) {
        res.write(`event: alert\ndata: ${alertJson}\n\n`);
      }

      // Step 4: Subscribe to the doctor's alert channel
      const subscriber = createSubscriberClient();
      const channel = `doctor:${doctorId}:alerts`;

      await subscriber.subscribe(channel);
      logger.info({ doctorId, channel }, 'SSE client subscribed');

      subscriber.on('message', (ch: string, message: string) => {
        if (ch === channel) {
          res.write(`event: alert\ndata: ${message}\n\n`);
        }
      });

      // Step 5: Heartbeat every 25 seconds
      const heartbeatInterval = setInterval(() => {
        res.write(': heartbeat\n\n');
      }, 25000);

      // Step 6: Cleanup on client disconnect
      req.on('close', () => {
        logger.info({ doctorId }, 'SSE client disconnected');
        clearInterval(heartbeatInterval);
        subscriber.unsubscribe(channel);
        subscriber.quit();
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /alerts/:id/acknowledge
   * Mark a danger alert as acknowledged by the doctor.
   */
  async acknowledge(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const doctorId = req.user!.id;

      const alert = await prisma.dangerAlert.findUnique({ where: { id } });
      if (!alert) {
        throw new NotFoundError('Alert not found');
      }

      const updated = await prisma.dangerAlert.update({
        where: { id },
        data: {
          status: 'acknowledged',
          acknowledged_at: new Date(),
        },
      });

      // Write audit log
      await prisma.auditLog.create({
        data: {
          actor_type: 'doctor',
          actor_id: doctorId,
          action: 'alert_acknowledged',
          resource_type: 'danger_alert',
          resource_id: id,
          before: { status: alert.status },
          after: { status: 'acknowledged' },
        },
      });

      // Remove from the doctor's active alerts list in Redis
      if (alert.doctor_id) {
        const alerts = await redis.lrange(`doctor:${alert.doctor_id}:active_alerts`, 0, -1);
        for (const alertJson of alerts) {
          try {
            const parsed = JSON.parse(alertJson);
            if (parsed.alert_id === id) {
              await redis.lrem(`doctor:${alert.doctor_id}:active_alerts`, 1, alertJson);
              break;
            }
          } catch {
            // skip malformed entries
          }
        }
      }

      res.status(200).json({
        id: updated.id,
        status: updated.status,
        acknowledged_at: updated.acknowledged_at,
      });
    } catch (err) {
      next(err);
    }
  },
};
