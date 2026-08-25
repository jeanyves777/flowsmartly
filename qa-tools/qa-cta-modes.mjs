/**
 * Can the CTA gradient be made NOT to paint at 390?
 *
 * The main probe scrolls the whole page before measuring, which plays every
 * `Reveal`. A real capture may not. This tries the access patterns that could
 * plausibly leave the banner unpainted, so "it paints" is a tested claim rather
 * than an artefact of how the probe happened to reach the element.
 */
import puppeteer from 'puppeteer';
import { mkdir, writeFile } from 'node:fs/promises';
import { decodePng, px, hex, ratio } from './qa-png.mjs';
import { join } from 'node:path';

const OUT = process.argv[2] ?? '../qa-cta';
const BASE = process.argv[3] ?? 'http://127.0.0.1:8097';
const SHA = process.argv[4] ?? 'unknown';
const HEADING = 'Ready to bring your business together?';

const MODES = [
  'scroll-through', // incremental scroll, like the main probe
  'jump', // straight to the banner, measured immediately
  'grown-viewport', // viewport grown to the whole scroller, like qa-anchors
  'no-js', // the static export with scripting disabled
  'reduced-motion', // prefers-reduced-motion: Reveal never animates
];

await mkdir(OUT, { recursive: true });
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const rows = [];

for (const mode of MODES) {
  const page = await browser.newPage();
  if (mode === 'no-js') await page.setJavaScriptEnabled(false);
  if (mode === 'reduced-motion') {
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  }
  await page.setViewport({ width: 390, height: 900, deviceScaleFactor: 1 });
  if (mode !== 'no-js') {
    await page.evaluateOnNewDocument(() => {
      try {
        window.localStorage.setItem(
          'fs.consent.v1',
          JSON.stringify({ necessary: true, analytics: false, marketing: false, at: Date.now(), version: 1 }),
        );
      } catch {
        /* private mode */
      }
    });
  }
  await page.goto(BASE + '/', { waitUntil: 'networkidle0', timeout: 60000 });

  const identity = await page.evaluate((h) => ({
    route: location.pathname,
    notFound: document.body.innerText.includes('PAGE NOT FOUND'),
    heading: document.body.innerText.includes(h) || document.body.textContent.includes(h),
    chars: document.body.textContent.length,
  }), HEADING);
  const shaOk = mode === 'no-js' ? 'n/a (no fetch)' : await page.evaluate(async (s) => {
    try {
      return (await (await fetch('/CANDIDATE_SHA.txt')).text()).trim() === s;
    } catch {
      return false;
    }
  }, SHA);

  if (mode === 'grown-viewport') {
    const h = await page.evaluate(() => {
      const s = [...document.querySelectorAll('div')].find((el) => el.scrollHeight > el.clientHeight + 40);
      return Math.min(s ? s.scrollHeight : 900, 12000);
    });
    await page.setViewport({ width: 390, height: h, deviceScaleFactor: 1 });
    await new Promise((r) => setTimeout(r, 600));
  } else if (mode === 'scroll-through') {
    await page.evaluate(async () => {
      const s = [...document.querySelectorAll('div')].find((el) => el.scrollHeight > el.clientHeight + 40);
      const el = s ?? document.documentElement;
      for (let y = 0; y < el.scrollHeight; y += 600) {
        el.scrollTop = y;
        await new Promise((r) => setTimeout(r, 40));
      }
    });
  }

  if (mode !== 'grown-viewport') {
    await page.evaluate((h) => {
      const n = [...document.querySelectorAll('h2,h1,div,span')].find((e) => e.textContent?.trim() === h);
      if (n) n.scrollIntoView({ block: 'center' });
    }, HEADING);
    await new Promise((r) => setTimeout(r, mode === 'jump' ? 120 : 700));
  }

  const info = await page.evaluate((h) => {
    const n = [...document.querySelectorAll('h2,h1,div,span')].find((e) => e.textContent?.trim() === h);
    if (!n) return null;
    let node = n;
    let host = null;
    while (node && node !== document.body) {
      const cs = getComputedStyle(node);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') {
        host = node;
        break;
      }
      node = node.parentElement;
    }
    if (!host) return { hostFound: false };
    const cs = getComputedStyle(host);
    const r = host.getBoundingClientRect();
    // Effective opacity — a Reveal that never played leaves an ancestor at 0.
    let eff = 1;
    let a = host;
    while (a && a !== document.body) {
      eff *= Number(getComputedStyle(a).opacity || '1');
      a = a.parentElement;
    }
    return {
      hostFound: true,
      bgImage: cs.backgroundImage,
      bgColor: cs.backgroundColor,
      rect: { x: r.x, y: r.y, w: r.width, h: r.height },
      effectiveOpacity: eff,
      ink: getComputedStyle(n).color,
    };
  }, HEADING);

  let sample = null;
  if (info && info.hostFound) {
    const buf = await page.screenshot({ path: join(OUT, 'mode-' + mode + '.png') });
    const img = decodePng(Buffer.from(buf));
    const cx = Math.max(0, Math.round(info.rect.x));
    const cy = Math.max(0, Math.round(info.rect.y));
    if (cy >= 0 && cy + 6 < img.height) {
      const ty = cy + 4;
      const cols = [0.06, 0.5, 0.94].map((f) => {
        const sx = Math.min(img.width - 2, Math.max(1, cx + Math.round(info.rect.w * f)));
        return px(img, sx, ty);
      });
      const ink = (info.ink.match(/\d+/g) || ['0', '0', '0']).slice(0, 3).map(Number);
      sample = {
        colors: cols.map(hex),
        distinct: new Set(cols.map(hex)).size,
        contrast: Number(ratio(ink, cols[0]).toFixed(2)),
      };
    }
  }

  rows.push({ mode, identity, shaOk, info, sample });
  console.log(
    mode.padEnd(16),
    'route=' + identity.route,
    'heading=' + identity.heading,
    'sha=' + shaOk,
    '| host=' + (info ? info.hostFound : 'none'),
    '| opacity=' + (info && info.effectiveOpacity !== undefined ? info.effectiveOpacity : '-'),
    '| px=' + (sample ? sample.colors.join(',') + ' distinct=' + sample.distinct + ' contrast=' + sample.contrast : 'n/a'),
  );
  await page.close();
}

await browser.close();
await writeFile(join(OUT, 'modes.json'), JSON.stringify({ sha: SHA, rows }, null, 2), 'utf8');
