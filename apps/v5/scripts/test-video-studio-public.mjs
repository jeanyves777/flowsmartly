import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import puppeteer from 'puppeteer';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, '../dist');
const routeFile = path.join(dist, 'solutions/video-studio/index.html');
await fs.access(routeFile);
const port = Number(process.env.V5_PUBLIC_QA_PORT || 8097);
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', dist], { stdio: 'ignore' });
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { ready = (await fetch(`http://127.0.0.1:${port}/`)).ok; } catch {}
    if (ready) break;
    await delay(250);
  }
  assert(ready, 'Expo static export server must start');
  browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || puppeteer.executablePath(),
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1440, height: 1000, deviceScaleFactor: 1 },
  });
  const page = await browser.newPage();
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto(`http://127.0.0.1:${port}/solutions/video-studio/`, { waitUntil: 'networkidle0', timeout: 60_000 });
  await page.waitForSelector('[role="main"]');
  await page.waitForSelector('[role="button"][aria-label="Show Product film reference"]');
  assert.equal(await page.locator('[role="heading"][aria-level="1"]').count(), 1, 'The public route must expose one primary heading');
  assert.equal(await page.locator('[role="button"][aria-label$=" reference"] img').count(), 4, 'Each direction control must show its local thumbnail');
  assert.match(await page.locator('[role="heading"][aria-level="1"]').innerText(), /Make your next story/);
  assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);
  assert.equal(await page.locator('[role="heading"][aria-level="1"]').evaluate((el) => getComputedStyle(el).opacity), '1', 'Reduced motion must leave the page content visible');

  // Exercise the real gallery action and make sure it stays a local reference.
  await page.locator('[role="button"][aria-label="Show Social reference"]').click();
  assert.equal(await page.locator('[role="button"][aria-label="Show Social reference"]').evaluate((el) => el.getAttribute('aria-pressed')), 'true');
  assert.equal(await page.locator('[data-testid="video-studio-reference-image"] img').getAttribute('alt'), 'Creator-style social video still framed for a vertical feed');
  assert.match(await page.locator('body').innerText(), /This selector changes the preview only/);

  // Prove natural Tab traversal reaches the custom controls, with a visible focus
  // state; then activate the next preview from the keyboard.
  await page.reload({ waitUntil: 'networkidle0' });
  const campaign = page.locator('[role="button"][aria-label="Show Campaign reference"]');
  let reached = false;
  for (let step = 0; step < 50; step += 1) {
    await page.keyboard.press('Tab');
    reached = await campaign.evaluate((el) => document.activeElement === el);
    if (reached) break;
  }
  assert(reached, 'Natural Tab order must reach the campaign preview control');
  assert.equal(await campaign.evaluate((el) => getComputedStyle(el).borderWidth), '2px', 'Keyboard focus must be visible');
  await page.keyboard.press('Space');
  assert.equal(await campaign.evaluate((el) => el.getAttribute('aria-pressed')), 'true', 'Space must select a preview');
  assert.equal(await page.locator('[data-testid="video-studio-reference-image"] img').getAttribute('alt'), 'Editorial campaign still of a car on a coastal road at sunset');

  // The FAQ control is an actual disclosure and reports its expanded state.
  const faq = page.getByRole('button', { name: /Can I generate a video from this page/ });
  await faq.click();
  assert.equal(await faq.getAttribute('aria-expanded'), 'false');
  await faq.click();
  assert.equal(await faq.getAttribute('aria-expanded'), 'true');
  assert.match(await page.locator('body').innerText(), /Video generation is not wired to this page/);

  const widths = [390, 768, 1024, 1536];
  for (const width of widths) {
    await page.setViewport({ width, height: 960 });
    await page.waitForFunction(() => document.documentElement.clientWidth > 0);
    const dimensions = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
      main: document.querySelector('[role="main"]')?.scrollWidth,
      mainClient: document.querySelector('[role="main"]')?.clientWidth,
    }));
    assert(dimensions.document <= dimensions.viewport, `Document overflow at ${width}px: ${JSON.stringify(dimensions)}`);
    assert(dimensions.main <= dimensions.mainClient + 1, `Main content overflow at ${width}px: ${JSON.stringify(dimensions)}`);
    if (width === 390 || width === 1536) await page.screenshot({ path: `/tmp/video-studio-${width}.png`, fullPage: true });
  }
  assert.deepEqual(runtimeErrors, [], `The route must not throw in the browser: ${runtimeErrors.join('; ')}`);
  console.log('Video Studio public browser QA passed: reduced motion, local preview switching, natural keyboard focus/activation, FAQ disclosure, 390/768/1024/1536 widths.');
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
