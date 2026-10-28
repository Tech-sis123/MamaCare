import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../utils/types';
import { logger } from '../../utils/logger';
import { getWhatsAppStatus, logoutWhatsApp, startWhatsApp } from '../../services/whatsapp';

/** Doctors link the clinic WhatsApp from the provider dashboard (WhatsApp tab). */
export const whatsappConnectionController = {
  /** GET /providers/whatsapp — connection status, with the QR code image while waiting for a scan */
  async status(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      res.status(200).json(await getWhatsAppStatus());
    } catch (err) {
      next(err);
    }
  },

  /** POST /providers/whatsapp/connect { restart?: boolean } — starts WhatsApp Web and produces a QR code */
  async connect(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const restart = req.body?.restart === true;
      logger.info({ doctorId: req.user?.id, restart }, 'Doctor requested a WhatsApp QR code');
      res.status(200).json(await startWhatsApp({ restart }));
    } catch (err) {
      next(err);
    }
  },

  /** POST /providers/whatsapp/logout — unlinks the clinic WhatsApp so another number can be linked */
  async logout(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      logger.warn({ doctorId: req.user?.id }, 'Doctor unlinked the clinic WhatsApp');
      res.status(200).json(await logoutWhatsApp());
    } catch (err) {
      next(err);
    }
  },
};
