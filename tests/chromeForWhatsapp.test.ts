import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { chromeMajorVersion, desktopUserAgent } from '../src/services/chromeForWhatsapp';

const realPlatform = process.platform;
const setPlatform = (value: string) => Object.defineProperty(process, 'platform', { value });

describe('Chrome identity for WhatsApp Web', () => {
  afterEach(() => setPlatform(realPlatform));

  it('reads the version from a downloaded Chrome folder (Render/Linux and Windows)', () => {
    expect(chromeMajorVersion('/opt/render/project/src/.cache/puppeteer/chrome/linux-146.0.7680.31/chrome-linux64/chrome')).toBe(146);
    expect(chromeMajorVersion(String.raw`C:\app\.cache\puppeteer\chrome\win64-146.0.7680.31\chrome-win64\chrome.exe`)).toBe(146);
  });

  it('reads the version folder next to an installed Chrome', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-app-'));
    fs.mkdirSync(path.join(dir, '155.0.7000.1'));
    fs.mkdirSync(path.join(dir, '156.0.7100.2'));
    fs.mkdirSync(path.join(dir, 'SetupMetrics'));
    try {
      expect(chromeMajorVersion(path.join(dir, 'chrome.exe'))).toBe(156);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('builds a normal desktop Chrome user agent, never "HeadlessChrome"', () => {
    setPlatform('linux');
    const ua = desktopUserAgent('/srv/.cache/puppeteer/chrome/linux-146.0.7680.31/chrome-linux64/chrome');
    expect(ua).toBe('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36');
    setPlatform('win32');
    expect(desktopUserAgent(String.raw`C:\x\win64-146.0.7680.31\chrome.exe`)).toContain('Windows NT 10.0; Win64; x64');
  });

  it('gives up (null) when the version cannot be told', () => {
    setPlatform('win32');
    expect(desktopUserAgent(String.raw`Z:\nowhere\chrome.exe`)).toBeNull();
  });
});
