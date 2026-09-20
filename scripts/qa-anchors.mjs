/**
 * Visual QA over the eight anchor routes.
 *
 * Three things this has to get right, each of which silently produced a
 * convincing but wrong capture on the way here:
 *
 *   1. **Clean URLs.** `python -m http.server` 404s `/flowagent` and serves
 *      `/flowagent.html`, and loading the second makes expo-router match
 *      nothing and render its not-found page. Every screenshot looked fine and
 *      every screenshot was of a 404.
 *   2. **The scroll container is nested.** react-native-web does not scroll
 *      `body`, so `fullPage` captures one viewport and `body.scrollHeight`
 *      always reads exactly the viewport height.
 *   3. **The theme is not persisted.** It is `useState`, cycled by a button, so
 *      grey and dark have to be clicked into existence.
 */
import puppeteer from 'puppeteer';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const OUT = process.argv[2] ?? 'qa-anchors';
const BASE = process.argv[3] ?? 'http://127.0.0.1:8093';

const ROUTES = [
  ['/', 'home'],
  ['/product', 'product'],
  ['/flowagent', 'flowagent'],
  ['/pricing', 'pricing'],
  ['/solutions/flowshop', 'flowshop'],
  ['/solutions/call-agent', 'call-agent'],
  ['/company/security', 'security'],
  ['/resources/blog', 'blog'],
];

const WIDTHS = [390, 768, 1280, 1536];
const THEMES = ['light', 'grey', 'dark'];
/** light → grey → dark, so N clicks from the default. */
const CLICKS = { light: 0, grey: 1, dark: 2 };

const MAX_CAPTURE_HEIGHT = 14_000;

await mkdir(OUT, { recursive: true });

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const findings = [];
const measurements = [];

for (const [route, name] of ROUTES) {
  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      const page = await browser.newPage();
      await page.setViewport({ width, height: 1000, deviceScaleFactor: 1 });

      // Answer the consent banner before the app boots, so it is not sitting
      // over the bottom of every capture.
      await page.evaluateOnNewDocument(() => {
        try {
          window.localStorage.setItem(
            'fs.consent.v1',
            JSON.stringify({
              necessary: true,
              analytics: false,
              marketing: false,
              at: Date.now(),
              version: 1,
            }),
          );
        } catch {
          /* private mode */
        }
      });

      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle0', timeout: 60_000 });

      if (await page.evaluate(() => document.body.innerText.includes('PAGE NOT FOUND'))) {
        findings.push(`${name} @ ${width} ${theme}: rendered the 404 page`);
        await page.close();
        continue;
      }

      /* ---- theme ---- */

      // Waited for, not queried once. Hydration discards the server tree and
      // re-renders, so a handle taken immediately after `networkidle0` is
      // detached by the time it is clicked — which reads as "no toggle" and is
      // really "not yet".
      for (let i = 0; i < CLICKS[theme]; i += 1) {
        try {
          await page.waitForSelector('[aria-label^="Theme:"]', { visible: true, timeout: 15_000 });
          await page.click('[aria-label^="Theme:"]');
          await new Promise((r) => setTimeout(r, 200));
        } catch {
          findings.push(`${name} @ ${width}: could not reach ${theme}`);
          break;
        }
      }

      // Confirm the theme actually changed rather than trusting the clicks.
      const reached = await page.evaluate(() => {
        const el = document.querySelector('[aria-label^="Theme:"]');
        return el?.getAttribute('aria-label')?.split(' ')[1]?.replace('.', '') ?? 'unknown';
      });
      if (reached !== theme) {
        findings.push(`${name} @ ${width}: asked for ${theme}, landed on ${reached}`);
      }

      /* ---- the real scroll container ---- */

      const scroller = await page.evaluate(() => {
        const candidates = [...document.querySelectorAll('div')];
        const found = candidates.find((el) => el.scrollHeight > el.clientHeight + 40);
        if (!found) return null;
        found.setAttribute('data-qa-scroller', '');
        return { height: found.scrollHeight, client: found.clientHeight };
      });

      // expo-image lazy-loads; below-the-fold art captures blank unless the
      // page has actually been scrolled through first.
      await page.evaluate(async () => {
        const el = document.querySelector('[data-qa-scroller]') ?? document.documentElement;
        for (let y = 0; y < el.scrollHeight; y += 700) {
          el.scrollTop = y;
          await new Promise((r) => setTimeout(r, 50));
        }
        el.scrollTop = 0;
        await new Promise((r) => setTimeout(r, 250));
      });

      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return Math.max(doc.scrollWidth - doc.clientWidth, document.body.scrollWidth - width0());
        function width0() {
          return document.body.clientWidth;
        }
      });

      if (overflow > 1) {
        findings.push(`${name} @ ${width} ${theme}: horizontal overflow ${overflow}px`);
      }

      /* ---- capture ---- */

      // Growing the viewport is the only way to get a whole page out of a
      // nested scroller; `fullPage` measures the document, which never scrolls.
      const full = Math.min(scroller?.height ?? 1000, MAX_CAPTURE_HEIGHT);
      await page.setViewport({ width, height: full, deviceScaleFactor: 1 });
      await new Promise((r) => setTimeout(r, 400));

      await page.screenshot({ path: join(OUT, `${name}-${width}-${theme}.png`) });

      if (theme === 'light' && width === 1280) {
        const stats = await page.evaluate(() => ({
          svg: document.querySelectorAll('svg').length,
          text: document.body.innerText.length,
        }));
        measurements.push({ name, height: scroller?.height ?? 0, ...stats });
      }

      await page.close();
    }
  }
}

await browser.close();

console.log('route         height   svg   chars');
for (const m of measurements) {
  console.log(
    `${m.name.padEnd(13)} ${String(m.height).padStart(6)} ${String(m.svg).padStart(5)} ${String(m.text).padStart(7)}`,
  );
}

await writeFile(join(OUT, 'findings.txt'), findings.join('\n') || 'none', 'utf8');
console.log(`\n${String(findings.length)} finding(s).`);
for (const f of findings) console.log(`  ${f}`);
