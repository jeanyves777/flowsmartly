import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import puppeteer from 'puppeteer';
import { startPublicExportServer } from './serve-public-export.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, '../dist');
function horizontalDimensions() {
  return {
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    // A centred main allows full-bleed bands; only actual scroll surfaces
    // determine whether the visitor can scroll sideways.
    scrollers: Array.from(document.querySelectorAll('*')).filter((element) => {
      const style = getComputedStyle(element);
      return element.clientWidth > 0 && /auto|scroll/.test(`${style.overflowX} ${style.overflowY}`);
    }).map((element) => ({ width: element.scrollWidth, client: element.clientWidth })),
  };
}
function hasHorizontalOverflow(dimensions) {
  return dimensions.document > dimensions.viewport + 1 || dimensions.scrollers.some(({ width, client }) => width > client + 1);
}
const screenshotDir = path.resolve(process.env.V5_PUBLIC_QA_OUTPUT_DIR || path.join(tmpdir(), 'v5-video-studio-qa'));
await fs.mkdir(screenshotDir, { recursive: true });
const server = await startPublicExportServer(dist, Number(process.env.V5_PUBLIC_QA_PORT || 0));
let browser;
try {
  browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || puppeteer.executablePath(),
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1440, height: 1000, deviceScaleFactor: 1 },
  });
  const page = await browser.newPage();
  const expectPreviewAlt = (alt) => page.waitForFunction((expected) =>
    document.querySelector('[data-testid="video-studio-reference-image"] img')?.getAttribute('alt') === expected,
  { timeout: 15_000 }, alt);
  const runtimeErrors = [];
  const consoleErrors = [];
  const capabilityRequests = [];
  await page.setRequestInterception(true);
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('request', (request) => {
    if (/\/api\/|higgsfield|fal\.ai|runway|seedance/i.test(request.url())) capabilityRequests.push(request.url());
    const url = new URL(request.url());
    if (url.origin === server.origin || ['data:', 'blob:'].includes(url.protocol)) request.continue();
    else request.abort();
  });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const response = await page.goto(`${server.origin}/solutions/video-studio/`, { waitUntil: 'networkidle0', timeout: 60_000 });
  assert.equal(response.status(), 200, 'The exported Video Studio route must exist');
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
  await expectPreviewAlt('Creator-style social video still framed for a vertical feed');
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
  await expectPreviewAlt('Editorial campaign still of a car on a coastal road at sunset');

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
  for (const theme of ['light', 'grey', 'dark']) {
    await page.evaluate((mode) => localStorage.setItem('v5:theme', mode), theme);
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector(`[role="button"][aria-label="Theme: ${theme}. Change theme"]`);
    for (const width of widths) {
      await page.setViewport({ width, height: 960 });
      // React Native adopts a resized viewport after the browser resize event.
      // Wait for measured geometry to settle, not for overflow to disappear:
      // persistent overflow must still fail the assertion below.
      await page.waitForFunction((expectedWidth) => {
        if (innerWidth !== expectedWidth) return false;
        const key = JSON.stringify([innerWidth, document.documentElement.scrollWidth,
          ...Array.from(document.querySelectorAll('[role="main"]')).map((element) => [element.clientWidth, element.scrollWidth, element.scrollHeight])]);
        const previous = window.__videoQaLayout;
        if (!previous || previous.key !== key) window.__videoQaLayout = { key, since: performance.now() };
        return performance.now() - window.__videoQaLayout.since >= 300;
      }, { polling: 'raf', timeout: 15_000 }, width);
      const dimensions = await page.evaluate(horizontalDimensions);
      assert(!hasHorizontalOverflow(dimensions), `Horizontal overflow at ${theme}/${width}px: ${JSON.stringify(dimensions)}`);
      await page.evaluate(() => { for (const element of document.querySelectorAll('*')) if (/auto|scroll/.test(getComputedStyle(element).overflowY)) element.scrollTop = 0; });
      await page.screenshot({ path: path.join(screenshotDir, `video-studio-${theme}-${width}.png`), fullPage: true });
      console.log(`PASS ${theme}/${width}: ${JSON.stringify(dimensions)}`);
    }
  }
  // A real over-wide child must still fail the corrected detector, even though
  // the legitimate 1920px full-bleed bands above pass.
  await page.evaluate(() => {
    const scroller = Array.from(document.querySelectorAll('*')).find((element) => /auto|scroll/.test(getComputedStyle(element).overflowY) && element.clientHeight > 0);
    const probe = document.createElement('div');
    probe.id = 'qa-overflow-probe';
    probe.style.cssText = `width:${innerWidth + 200}px;min-width:${innerWidth + 200}px;height:1px;flex-shrink:0`;
    (scroller || document.body).appendChild(probe);
  });
  assert(hasHorizontalOverflow(await page.evaluate(horizontalDimensions)), 'The overflow detector must reject a real over-wide scroll child');
  await page.evaluate(() => document.getElementById('qa-overflow-probe').remove());
  assert.deepEqual(runtimeErrors, [], `The route must not throw in the browser: ${runtimeErrors.join('; ')}`);
  assert.deepEqual(consoleErrors, [], `The route must not log browser errors: ${consoleErrors.join('; ')}`);
  console.log('Video Studio public browser QA passed: reduced motion, local preview switching, natural keyboard focus/activation, FAQ disclosure, and screenshots/overflow checks at 390/768/1024/1280/1536/1920 widths.');
  console.log(`Screenshots: ${screenshotDir}`);
} finally {
  if (browser) await browser.close();
  await server.close();
}
