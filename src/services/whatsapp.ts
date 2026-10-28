import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import prisma from '../config/prisma';
import { env } from '../config/env';
import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import QRCode from 'qrcode';
import { whatsappBot } from './whatsappBot';

interface WhatsAppMessagePayload {
  to: string; // Phone number in international format (e.g. 2348012345678)
  message: string;
}

/**
 * The clinic's WhatsApp connection (whatsapp-web.js). Doctors link it from the
 * provider dashboard: "Get QR code" starts WhatsApp Web, the QR is shown on the
 * page, and scanning it from the clinic phone (Linked devices) logs in. The
 * login is saved in WHATSAPP_AUTH_PATH, so restarts reconnect without a new scan.
 */
export type WhatsAppStatus =
  | 'stopped' // not linked / not running
  | 'starting' // opening WhatsApp Web
  | 'qr' // waiting for the QR code to be scanned
  | 'authenticating' // scanned, loading chats
  | 'ready' // connected, messages can be sent
  | 'expired' // nobody scanned in time
  | 'disconnected'
  | 'failed';

// WhatsApp shows a new code about every 20 seconds; stop after ~2 minutes so Chrome isn't left running
const QR_MAX_RETRIES = 6;
const ACTIVE: WhatsAppStatus[] = ['starting', 'qr', 'authenticating', 'ready'];
const START_ATTEMPTS = 3;
const TRANSIENT_START_ERROR = /Execution context was destroyed|navigation|Target closed|Session closed/i;

interface ConnectionState {
  status: WhatsAppStatus;
  qr: string | null;
  qrAt: Date | null;
  phone: string | null;
  name: string | null;
  error: string | null;
  detail: string | null;
  updatedAt: Date;
}

let client: Client | null = null;
let generation = 0;
let state: ConnectionState = {
  status: 'stopped',
  qr: null,
  qrAt: null,
  phone: null,
  name: null,
  error: null,
  detail: null,
  updatedAt: new Date(),
};
let qrImageCache: { qr: string; image: string } | null = null;

const setState = (patch: Partial<ConnectionState>) => {
  state = { ...state, ...patch, updatedAt: new Date() };
};

const sessionDir = () => path.join(path.resolve(env.WHATSAPP_AUTH_PATH), 'session');

export const hasSavedSession = () => fs.existsSync(sessionDir());

function chromePath(): string | undefined {
  if (env.WHATSAPP_CHROME_PATH) return env.WHATSAPP_CHROME_PATH;
  const windowsChrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  return fs.existsSync(windowsChrome) ? windowsChrome : undefined;
}

function createClient(attempt = 1): Client {
  const gen = ++generation;
  // Ignore events from a client that has since been restarted or logged out
  const current = () => gen === generation;

  const c = new Client({
    authStrategy: new LocalAuth({ dataPath: env.WHATSAPP_AUTH_PATH }),
    qrMaxRetries: QR_MAX_RETRIES,
    // The library's default user agent is Chrome 101, which WhatsApp now sends to a "Download WhatsApp"
    // page instead of the QR code. Use the installed Chrome's own user agent, which stays current.
    // (Typed as string, but whatsapp-web.js treats false as "don't override".)
    userAgent: false as unknown as string,
    puppeteer: {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: chromePath(),
    },
  });

  c.on('qr', (qr) => {
    if (!current()) return;
    setState({ status: 'qr', qr, qrAt: new Date(), error: null, detail: null });
    logger.info('WhatsApp QR code ready (scan it on the provider dashboard, WhatsApp tab, or below):');
    qrcode.generate(qr, { small: true });
  });

  c.on('authenticated', () => {
    if (!current()) return;
    setState({ status: 'authenticating', qr: null, qrAt: null });
  });

  c.on('ready', () => {
    if (!current()) return;
    const wid = c.info?.wid?.user;
    setState({
      status: 'ready',
      qr: null,
      qrAt: null,
      error: null,
      detail: null,
      phone: wid ? `+${wid}` : null,
      name: c.info?.pushname || null,
    });
    logger.info({ phone: wid }, 'WhatsApp client is ready!');
  });

  c.on('auth_failure', (msg) => {
    if (!current()) return;
    logger.error({ msg }, 'WhatsApp authentication failure');
    setState({
      status: 'failed',
      qr: null,
      qrAt: null,
      error: 'WhatsApp did not accept the login. Get a new QR code and scan it again.',
      detail: String(msg ?? '').slice(0, 300) || null,
    });
  });

  // Auto-reply menu bot for patients who text the clinic number
  c.on('message', async (msg) => {
    try {
      if (msg.fromMe || msg.isStatus || !msg.from.endsWith('@c.us')) return;
      const reply = await whatsappBot.reply({ from: msg.from.split('@')[0], text: msg.body });
      if (reply) await c.sendMessage(msg.from, reply);
    } catch (err) {
      logger.error({ err, from: msg.from }, 'WhatsApp bot failed to reply');
    }
  });

  c.on('disconnected', (reason) => {
    if (!current()) return;
    const expired = String(reason).includes('Max qrcode retries');
    logger.warn({ reason }, 'WhatsApp disconnected');
    if (expired) client = null; // whatsapp-web.js closes the browser itself
    setState({
      status: expired ? 'expired' : 'disconnected',
      qr: null,
      qrAt: null,
      error: expired ? null : 'WhatsApp was disconnected. Get a new QR code to link it again.',
      detail: expired ? null : String(reason),
    });
  });

  c.initialize().catch(async (err) => {
    if (!current()) return;
    // WhatsApp Web sometimes reloads itself while loading (often on a fresh profile); trying again usually works
    if (attempt < START_ATTEMPTS && TRANSIENT_START_ERROR.test(String(err?.message || err))) {
      logger.warn({ err: String(err?.message || err), attempt }, 'WhatsApp Web reloaded while starting, trying again');
      await c.destroy().catch(() => {}); // free the browser profile before reopening it
      if (current()) client = createClient(attempt + 1);
      return;
    }
    logger.error({ err }, 'Failed to initialize WhatsApp client');
    client = null;
    setState({
      status: 'failed',
      qr: null,
      qrAt: null,
      error: 'The server could not open WhatsApp Web. Try again, or ask your technical team to check the server.',
      detail: String(err?.message || err).slice(0, 300),
    });
    c.destroy().catch(() => {});
  });

  return c;
}

async function closeClient() {
  const old = client;
  client = null;
  generation++;
  if (old) await old.destroy().catch((err) => logger.warn({ err }, 'Could not close WhatsApp client'));
}

/** Starts WhatsApp Web (shows a QR code unless a saved login reconnects). restart=true closes the current one first. */
export async function startWhatsApp({ restart = false } = {}) {
  if (client && !restart && ACTIVE.includes(state.status)) return getWhatsAppStatus();
  await closeClient();
  setState({ status: 'starting', qr: null, qrAt: null, error: null, detail: null });
  client = createClient();
  return getWhatsAppStatus();
}

/** Unlinks the clinic WhatsApp and deletes the saved login, so the next start needs a new scan. */
export async function logoutWhatsApp() {
  const old = client;
  client = null;
  generation++;
  if (old) {
    const loggedIn = state.status === 'ready' || state.status === 'authenticating';
    await (loggedIn ? old.logout() : old.destroy()).catch((err) => logger.warn({ err }, 'WhatsApp logout did not finish cleanly'));
  }
  await fs.promises
    .rm(sessionDir(), { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
    .catch((err) => logger.warn({ err }, 'Could not delete the saved WhatsApp login'));
  setState({ status: 'stopped', qr: null, qrAt: null, phone: null, name: null, error: null, detail: null });
  return getWhatsAppStatus();
}

/** What the provider dashboard shows. The QR code comes as an image (data URL). */
export async function getWhatsAppStatus() {
  let qrImage: string | null = null;
  if (state.status === 'qr' && state.qr) {
    if (qrImageCache?.qr !== state.qr) {
      qrImageCache = { qr: state.qr, image: await QRCode.toDataURL(state.qr, { width: 320, margin: 1 }) };
    }
    qrImage = qrImageCache.image;
  }
  return {
    status: state.status,
    qr_image: qrImage,
    qr_updated_at: state.qrAt,
    phone: state.status === 'ready' ? state.phone : null,
    name: state.status === 'ready' ? state.name : null,
    error: state.error,
    detail: state.detail,
    has_saved_login: hasSavedSession(),
    updated_at: state.updatedAt,
  };
}

/** On server start: reconnect if WhatsApp was linked before; otherwise wait for a doctor to link it. */
export const initWhatsApp = () => {
  if (hasSavedSession()) {
    startWhatsApp().catch((err) => logger.error({ err }, 'Failed to start WhatsApp'));
  } else {
    logger.info('WhatsApp is not linked yet. A doctor can link it from the provider dashboard (WhatsApp tab).');
  }
};

export const whatsappService = {
  /**
   * Send a WhatsApp text message via whatsapp-web.js
   */
  async sendMessage(payload: WhatsAppMessagePayload): Promise<{ message_id: string | null }> {
    if (!client || state.status !== 'ready') {
      logger.error('WhatsApp client is not ready. Skipping message to ' + payload.to);
      return { message_id: null };
    }

    try {
      // Format number for whatsapp-web.js (remove any + and append @c.us)
      const formattedNumber = payload.to.replace('+', '') + '@c.us';

      const response = await client.sendMessage(formattedNumber, payload.message);
      const messageId = response.id.id;

      // Log to notifications_log
      await prisma.notificationsLog.create({
        data: {
          channel: 'whatsapp',
          recipient: payload.to,
          payload: { message: payload.message },
          provider_message_id: messageId,
          status: 'sent',
          error: null,
        },
      });

      logger.info({ to: payload.to, message_id: messageId }, 'WhatsApp message sent');
      return { message_id: messageId };
    } catch (err: any) {
      logger.error({ err, to: payload.to }, 'Failed to send WhatsApp message');

      await prisma.notificationsLog.create({
        data: {
          channel: 'whatsapp',
          recipient: payload.to,
          payload: { message: payload.message },
          provider_message_id: null,
          status: 'failed',
          error: JSON.stringify(err.message || err),
        },
      });
      throw err;
    }
  },

  /**
   * Send an emergency alert via WhatsApp
   */
  async sendEmergencyAlert(params: {
    patientPhone: string;
    doctorPhone: string;
    patientName: string;
    triggers: string[];
  }): Promise<void> {
    const alertMessage = `🚨 9CARE EMERGENCY ALERT 🚨\n\nPatient: ${params.patientName}\nDanger Signs: ${params.triggers.join(', ')}\n\nPlease respond immediately.`;

    const patientMessage = `🚨 URGENT: Your symptoms indicate a potential emergency.\n\nDanger Signs: ${params.triggers.join(', ')}\n\nPlease proceed to the hospital immediately or call your doctor.`;

    // Send both in parallel to minimize latency
    await Promise.allSettled([
      whatsappService.sendMessage({ to: params.doctorPhone, message: alertMessage }),
      whatsappService.sendMessage({ to: params.patientPhone, message: patientMessage }),
    ]);
  },
};
