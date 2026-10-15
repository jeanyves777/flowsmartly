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
  const capabilityRequests = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('request', (request) => {
    if (/\/api\/|higgsfield|fal\.ai|runway|seedance/i.test(request.url())) capabilityRequests.push(request.url());
  });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto(`http://127.0.0.1:${port}/solutions/video-studio/`, { waitUntil: 'networkidle0', timeout: 60_000 });
  await page.waitForSelector('[role="main"]');
  await page.waitForSelector('[role="button"][aria-label="Show Product film reference"]');
  const headingSelector = '[role="heading"][aria-level="1"]';
  assert.equal(await page.evaluate((selector) => document.querySelectorAll(selector).length, headingSelector), 1, 'The public route must expose one primary heading');
  assert.equal(await page.evaluate((selector) => document.querySelectorAll(selector).length, '[role="button"][aria-label$=" reference"] img'), 4, 'Each direction control must show its local thumbnail');
  assert.match(await page.$eval(headingSelector, (element) => element.innerText), /Make your next story/);
  assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);
  assert.equal(await page.$eval(headingSelector, (element) => getComputedStyle(element).opacity), '1', 'Reduced motion must leave the page content visible');

  // Exercise the real gallery action and make sure it stays a local reference.
  const socialSelector = '[role="button"][aria-label="Show Social reference"]';
  const requestsBeforeSelection = capabilityRequests.length;
  await page.click(socialSelector);
  assert.equal(await page.$eval(socialSelector, (element) => element.getAttribute('aria-pressed')), 'true');
  assert.equal(await page.$eval('[data-testid="video-studio-reference-image"] img', (element) => element.getAttribute('alt')), 'Creator-style social video still framed for a vertical feed');
  assert.match(await page.$eval('body', (element) => element.innerText), /This selector changes the preview only/);
  await delay(200);
  assert.equal(capabilityRequests.length, requestsBeforeSelection, 'Selecting a thumbnail must not call a video/API provider');

  // Prove natural Tab traversal reaches the custom controls, with a visible focus
  // state; then activate the next preview from the keyboard.
  await page.reload({ waitUntil: 'networkidle0' });
  const campaignSelector = '[role="button"][aria-label="Show Campaign reference"]';
  const campaign = await page.waitForSelector(campaignSelector);
  let reached = false;
  for (let step = 0; step < 50; step += 1) {
    await page.keyboard.press('Tab');
    reached = await campaign.evaluate((element) => document.activeElement === element);
    if (reached) break;
  }
  assert(reached, 'Natural Tab order must reach the campaign preview control');
  assert.equal(await campaign.evaluate((element) => getComputedStyle(element).borderWidth), '2px', 'Keyboard focus must be visible');
  await page.keyboard.press('Space');
  assert.equal(await campaign.evaluate((element) => element.getAttribute('aria-pressed')), 'true', 'Space must select a preview');
  assert.equal(await page.$eval('[data-testid="video-studio-reference-image"] img', (element) => element.getAttribute('alt')), 'Editorial campaign still of a car on a coastal road at sunset');

  // The FAQ control is an actual disclosure and reports its expanded state.
  const faqSelector = 'button[aria-expanded]';
  const faqLabel = 'Can I generate a video from this page';
  const faqCount = await page.evaluate((selector, label) => Array.from(document.querySelectorAll(selector)).filter((element) => (element.innerText || '').includes(label)).length, faqSelector, faqLabel);
  assert.equal(faqCount, 1, 'The generation FAQ disclosure must be present exactly once');
  const clickFaq = () => page.evaluate((selector, label) => {
    const element = Array.from(document.querySelectorAll(selector)).find((candidate) => (candidate.innerText || '').includes(label));
    if (!element) throw new Error('The generation FAQ disclosure was not found');
    element.click();
  }, faqSelector, faqLabel);
  const faqExpanded = () => page.evaluate((selector, label) => {
    const element = Array.from(document.querySelectorAll(selector)).find((candidate) => (candidate.innerText || '').includes(label));
    return element?.getAttribute('aria-expanded') ?? null;
  }, faqSelector, faqLabel);
  await clickFaq();
  assert.equal(await faqExpanded(), 'false');
  await clickFaq();
  assert.equal(await faqExpanded(), 'true');
  assert.match(await page.$eval('body', (element) => element.innerText), /Video generation is not wired to this page/);

  const widths = [390, 768, 1024, 1280, 1536, 1920];
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
    await page.screenshot({ path: `/tmp/video-studio-${width}.png`, fullPage: true });
  }
  assert.deepEqual(runtimeErrors, [], `The route must not throw in the browser: ${runtimeErrors.join('; ')}`);
  console.log('Video Studio public browser QA passed: reduced motion, local preview switching, natural keyboard focus/activation, FAQ disclosure, and screenshots/overflow checks at 390/768/1024/1280/1536/1920 widths.');
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
