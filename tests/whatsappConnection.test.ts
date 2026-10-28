import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const fake = vi.hoisted(() => {
  const authPath = `${process.env.TEMP || process.env.TMPDIR || '/tmp'}/wa-auth-test-${process.pid}`;
  process.env.WHATSAPP_AUTH_PATH = authPath;
  return { authPath, clients: [] as any[], failNextInit: null as Error | null };
});

vi.mock('whatsapp-web.js', async () => {
  const { EventEmitter } = await import('events');
  class Client extends EventEmitter {
    options: any;
    info: any = null;
    initialize = vi.fn(() => {
      const err = fake.failNextInit;
      fake.failNextInit = null;
      return err ? Promise.reject(err) : Promise.resolve();
    });
    destroy = vi.fn().mockResolvedValue(undefined);
    logout = vi.fn().mockResolvedValue(undefined);
    sendMessage = vi.fn().mockResolvedValue({ id: { id: 'm1' } });
    constructor(options: any) {
      super();
      this.options = options;
      fake.clients.push(this);
    }
  }
  class LocalAuth {
    constructor(public opts: any) {}
  }
  return { Client, LocalAuth };
});

vi.mock('qrcode-terminal', () => ({ default: { generate: vi.fn() } }));
vi.mock('../src/config/redis', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  return { redis: new RedisMock() };
});
vi.mock('../src/config/prisma', () => ({
  default: { notificationsLog: { create: vi.fn().mockResolvedValue({}) } },
}));

import { getWhatsAppStatus, logoutWhatsApp, startWhatsApp, whatsappService } from '../src/services/whatsapp';

const flush = () => new Promise((r) => setTimeout(r, 0));
const last = () => fake.clients[fake.clients.length - 1];

describe('clinic WhatsApp connection', () => {
  beforeEach(async () => {
    await logoutWhatsApp();
    fake.clients.length = 0;
  });

  it('is stopped until a doctor asks for a QR code', async () => {
    const s = await getWhatsAppStatus();
    expect(s.status).toBe('stopped');
    expect(s.qr_image).toBeNull();
    expect(s.has_saved_login).toBe(false);
  });

  it('shows the QR code as an image, and does not open a second WhatsApp for repeat clicks', async () => {
    expect((await startWhatsApp()).status).toBe('starting');
    last().emit('qr', '2@abc,def,ghi');
    const s = await getWhatsAppStatus();
    expect(s.status).toBe('qr');
    expect(s.qr_image).toMatch(/^data:image\/png;base64,/);
    expect(s.qr_updated_at).toBeInstanceOf(Date);

    await startWhatsApp();
    expect(fake.clients).toHaveLength(1);
  });

  it('reports the linked number once scanned', async () => {
    await startWhatsApp();
    const c = last();
    c.emit('qr', 'code');
    c.emit('authenticated');
    expect((await getWhatsAppStatus()).status).toBe('authenticating');
    c.info = { wid: { user: '2348034027044' }, pushname: '9Care Clinic' };
    c.emit('ready');
    const s = await getWhatsAppStatus();
    expect(s).toMatchObject({ status: 'ready', phone: '+2348034027044', name: '9Care Clinic', qr_image: null });
  });

  it('sends messages only when connected', async () => {
    expect((await whatsappService.sendMessage({ to: '+2348011111111', message: 'hi' })).message_id).toBeNull();
    await startWhatsApp();
    last().info = { wid: { user: '2348034027044' } };
    last().emit('ready');
    expect((await whatsappService.sendMessage({ to: '+2348011111111', message: 'hi' })).message_id).toBe('m1');
    expect(last().sendMessage).toHaveBeenCalledWith('2348011111111@c.us', 'hi');
  });

  it('can be restarted for a fresh code, ignoring the old one', async () => {
    await startWhatsApp();
    const old = last();
    old.emit('qr', 'old-code');
    await startWhatsApp({ restart: true });
    expect(old.destroy).toHaveBeenCalled();
    expect(fake.clients).toHaveLength(2);
    old.emit('ready');
    expect((await getWhatsAppStatus()).status).toBe('starting');
  });

  it('marks the code expired when nobody scans it, and a new request starts again', async () => {
    await startWhatsApp();
    last().emit('disconnected', 'Max qrcode retries reached');
    expect((await getWhatsAppStatus()).status).toBe('expired');
    await startWhatsApp();
    expect(fake.clients).toHaveLength(2);
    expect(last().options.qrMaxRetries).toBeGreaterThan(0);
  });

  it('explains when WhatsApp Web cannot start on the server', async () => {
    fake.failNextInit = new Error('Browser was not found at the configured executablePath');
    await startWhatsApp();
    await flush();
    const s = await getWhatsAppStatus();
    expect(s.status).toBe('failed');
    expect(s.error).toMatch(/could not open WhatsApp Web/);
    expect(s.detail).toContain('Browser was not found');
  });

  it('tries again by itself when WhatsApp Web reloads while starting', async () => {
    fake.failNextInit = new Error('Protocol error (Runtime.callFunctionOn): Execution context was destroyed.');
    await startWhatsApp();
    await flush();
    await flush();
    expect(fake.clients).toHaveLength(2);
    expect(fake.clients[0].destroy).toHaveBeenCalled();
    expect((await getWhatsAppStatus()).status).toBe('starting');
    last().emit('qr', 'code');
    expect((await getWhatsAppStatus()).status).toBe('qr');
  });

  it('says when WhatsApp rejects the login', async () => {
    await startWhatsApp();
    last().emit('auth_failure', 'bad session');
    expect(await getWhatsAppStatus()).toMatchObject({ status: 'failed', detail: 'bad session' });
  });

  it('unlinks: logs out, deletes the saved login and stops', async () => {
    fs.mkdirSync(path.join(fake.authPath, 'session'), { recursive: true });
    expect((await getWhatsAppStatus()).has_saved_login).toBe(true);
    await startWhatsApp();
    const c = last();
    c.emit('ready');
    const s = await logoutWhatsApp();
    expect(c.logout).toHaveBeenCalled();
    expect(s).toMatchObject({ status: 'stopped', phone: null, has_saved_login: false });
    expect(fs.existsSync(path.join(fake.authPath, 'session'))).toBe(false);
  });
});
