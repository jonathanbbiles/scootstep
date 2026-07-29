/* ============================================================================
   ScootSteps — App Store screenshots, rendered headless from the CURRENT www/.

     node scripts/shots.mjs

   Writes 1290×2796 PNGs (iPhone 6.9"/6.7" — one set covers both) into
   screenshots/. That is the exact pixel size App Store Connect wants; ASC
   rejects off-spec files AT UPLOAD, so these are rendered at 430×932pt with
   deviceScaleFactor 3 rather than captured off a screen.

   RE-RUN THIS AFTER EVERY UI CHANGE. Live screenshots that still show a removed
   feature are a 2.3.3 reject.

   Needs playwright-core and a Chromium on disk:
     npm i -D playwright-core && npx playwright install chromium
   Point CHROME= at a Chromium binary to override auto-detection.
   ============================================================================ */
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync, existsSync, readdirSync } from 'node:fs';
import { extname, join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WWW = join(ROOT, 'www');
const OUT = join(ROOT, 'screenshots');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

function findChromium() {
  if (process.env.CHROME) return process.env.CHROME;
  const cache = join(process.env.HOME, 'Library/Caches/ms-playwright');
  if (!existsSync(cache)) return null;
  for (const d of readdirSync(cache).filter((n) => n.startsWith('chromium-')).sort().reverse()) {
    for (const p of [
      join(cache, d, 'chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'),
      join(cache, d, 'chrome-mac/Chromium.app/Contents/MacOS/Chromium'),
    ]) if (existsSync(p)) return p;
  }
  return null;
}

const server = createServer(async (req, res) => {
  const p = join(WWW, decodeURIComponent(req.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  try {
    const body = await readFile(p);
    res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

mkdirSync(OUT, { recursive: true });
const exe = findChromium();
if (!exe) { console.error('No Chromium found. Run: npx playwright install chromium'); process.exit(2); }
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

// Deterministic shots: skip onboarding, seed a streak, and freeze animation so the
// boots land in the same pose every run instead of wherever the rAF loop happened to be.
await page.addInitScript(() => {
  localStorage.setItem('ss_state', JSON.stringify({
    onboarded: true, plan: null, mastery: { 'the-wobble': 'learning', 'cupid-shuffle': 'know-it' },
    want: { 'cotton-eyed-joe': true }, streak: { count: 4, last: new Date().toDateString() },
    history: [1, 2, 3], settings: { countStyle: 'click', haptics: true, orientation: 'portrait', reminders: true, textScale: 1 },
  }));
});
await page.goto(base, { waitUntil: 'networkidle' });

const settle = () => page.waitForTimeout(900);
const shot = async (name) => { await settle(); await page.screenshot({ path: join(OUT, `iphone69_${name}.png`) }); console.log('  ', `iphone69_${name}.png`); };

console.log('rendering 1290x2796 screenshots ->', OUT);
await shot('1_tonight');

await page.click('.tab[data-view="library"]');
await shot('2_library');

await page.click('[data-open="cupid-shuffle"]');
await shot('3_detail');

await page.click('#d-learn');
await page.waitForSelector('#player.on');
await shot('4_learn');

await page.click('#p-mode-watch');
await page.waitForTimeout(400);
await page.$eval('#p-tempo', (el) => { el.value = 60; el.dispatchEvent(new Event('input', { bubbles: true })); });
await shot('5_tempo');

await page.click('#p-close');
await page.click('.tab[data-view="glossary"]');
await shot('6_basics');

await browser.close();
server.close();
console.log('done');
