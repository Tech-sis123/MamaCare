import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { createRequire } from 'module';

/**
 * The Chrome that whatsapp-web.js should launch on a server (Render, Linux).
 *
 * Uses the Puppeteer that whatsapp-web.js itself depends on (CommonJS, Node 18+), loaded
 * relative to whatsapp-web.js so it resolves however npm laid out node_modules. Its Chrome is
 * normally downloaded by `npm install` into .cache/puppeteer (see .puppeteerrc.cjs); if that
 * step was skipped, downloadChrome() fetches the same version at runtime.
 */

// Same folder as .puppeteerrc.cjs
export const BROWSER_CACHE_DIR = path.join(__dirname, '..', '..', '.cache', 'puppeteer');

function puppeteerRequire() {
  const wwebRequire = createRequire(require.resolve('whatsapp-web.js'));
  return createRequire(wwebRequire.resolve('puppeteer'));
}

/** Path of the Chrome that whatsapp-web.js's Puppeteer expects, if it is on disk. */
export function findChrome(): string | null {
  const puppeteer = puppeteerRequire()('puppeteer');
  const expected: string = puppeteer.executablePath();
  return expected && fs.existsSync(expected) ? expected : null;
}

/** Chrome's major version (e.g. 146) for the browser at this path, or null if it can't be told. */
export function chromeMajorVersion(executablePath: string): number | null {
  // Downloaded Chrome lives in a folder named after its version (…/linux-146.0.7680.31/…)
  const fromPath = executablePath.match(/[-\\/](\d{2,3})\.\d+\.\d+\.\d+[\\/]/);
  if (fromPath) return Number(fromPath[1]);
  // Installed Chrome on Windows keeps a version-named folder next to chrome.exe
  try {
    const versions = fs
      .readdirSync(path.dirname(executablePath))
      .map((name) => name.match(/^(\d+)\.\d+\.\d+\.\d+$/))
      .filter((m): m is RegExpMatchArray => !!m)
      .map((m) => Number(m[1]));
    if (versions.length) return Math.max(...versions);
  } catch {
    // folder not readable: try asking Chrome below
  }
  if (process.platform !== 'win32') {
    try {
      const out = execFileSync(executablePath, ['--version'], { timeout: 15000 }).toString();
      const m = out.match(/(\d{2,3})\.\d+\.\d+/);
      if (m) return Number(m[1]);
    } catch {
      // unknown version
    }
  }
  return null;
}

/**
 * A normal desktop Chrome user agent for this browser. Headless Chrome on Linux calls itself
 * "HeadlessChrome", and WhatsApp answers that with "update Chrome" instead of the QR code.
 */
export function desktopUserAgent(executablePath: string): string | null {
  const major = chromeMajorVersion(executablePath);
  if (!major) return null;
  const os =
    process.platform === 'win32'
      ? 'Windows NT 10.0; Win64; x64'
      : process.platform === 'darwin'
        ? 'Macintosh; Intel Mac OS X 10_15_7'
        : 'X11; Linux x86_64';
  return `Mozilla/5.0 (${os}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`;
}

/** Downloads that Chrome into .cache/puppeteer and returns its path. */
export async function downloadChrome(): Promise<string> {
  const req = puppeteerRequire();
  const { PUPPETEER_REVISIONS } = req('puppeteer-core/internal/revisions.js');
  const { install, Browser } = req('@puppeteer/browsers');
  const installed = await install({ browser: Browser.CHROME, buildId: PUPPETEER_REVISIONS.chrome, cacheDir: BROWSER_CACHE_DIR });
  return installed.executablePath;
}
