/**
 * Reproduces the FAILING measurement rather than the banner.
 *
 * Two ways a checker ends up reporting `textOnBrand` on a bare page surface at
 * ~1.05:1 even though the banner paints:
 *
 *   A. it resolves the effective background by walking ancestors for a
 *      `background-color`, which a `background-image` is invisible to;
 *   B. it measures while the banner's `Reveal` is still at `opacity: 0`.
 *
 * Both are checked here, across routes, so the reported numbers can be matched
 * to a mechanism instead of guessed at.
 */
import puppeteer from 'puppeteer';
import { writeFile } from 'node:fs/promises';
import { decodePng, px, hex, ratio } from './qa-png.mjs';

const BASE = process.argv[2] ?? 'http://127.0.0.1:8097';
const SHA = process.argv[3] ?? 'unknown';
const HEADING = 'Ready to bring your business together?';
const ROUTES = ['/', '/pricing', '/product', '/flowagent', '/company/security', '/resources'];
const THEMES = ['light', 'grey', 'dark'];

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const out = [];

for (const theme of THEMES) {
  for (const route of ROUTES) {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 900, deviceScaleFactor: 1 });
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
    await page.goto(BASE + route, { waitUntil: 'networkidle0', timeout: 60000 });

    const ok = await page.evaluate((h) => ({
      route: location.pathname,
      notFound: document.body.innerText.includes('PAGE NOT FOUND'),
      heading: document.body.innerText.includes(h),
      chars: document.body.innerText.length,
    }), HEADING);
    const shaOk = await page.evaluate(async (s) => {
      try {
        return (await (await fetch('/CANDIDATE_SHA.txt')).text()).trim() === s;
      } catch {
        return false;
      }
    }, SHA);
    if (ok.notFound || !ok.heading || !shaOk || ok.chars < 2000) {
      out.push({ theme, route, invalid: { ...ok, shaOk } });
      await page.close();
      continue;
    }

    const readTheme = () =>
      page.evaluate(() => {
        const el = document.querySelector('[aria-label^="Theme:"]');
        return ((el && el.getAttribute('aria-label')) || '').split(' ')[1]?.replace('.', '') ?? 'unknown';
      });
    let reached = await readTheme();
    for (let i = 0; i < 6 && reached !== theme; i += 1) {
      await page.click('[aria-label^="Theme:"]');
      await new Promise((r) => setTimeout(r, 260));
      reached = await readTheme();
    }
    if (reached !== theme) {
      out.push({ theme, route, invalid: { reached } });
      await page.close();
      continue;
    }

    // Mechanism B: jump to the banner and read it while the reveal may still be
    // at zero, exactly as a checker that does not wait for motion would.
    const jump = await page.evaluate((h) => {
      const heading = [...document.querySelectorAll('h1,h2,div,span')].find((n) => n.textContent?.trim() === h);
      if (!heading) return null;
      let node = heading;
      while (node && node !== document.body) {
        const cs = getComputedStyle(node);
        if (cs.backgroundImage && cs.backgroundImage !== 'none') break;
        node = node.parentElement;
      }
      if (!node || node === document.body) return null;
      node.setAttribute('data-qa-cta', '');
      node.scrollIntoView({ block: 'center' });
      let eff = 1;
      let a = node;
      const surfaces = [];
      while (a && a !== document.body) {
        const cs = getComputedStyle(a);
        eff *= Number(cs.opacity || '1');
        if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent') {
          surfaces.push(cs.backgroundColor);
        }
        a = a.parentElement;
      }
      const r = node.getBoundingClientRect();
      return {
        effectiveOpacity: eff,
        ownBgColor: getComputedStyle(node).backgroundColor,
        ancestorSurfaces: surfaces,
        ink: getComputedStyle(heading).color,
        rect: { x: r.x, y: r.y, w: r.width, h: r.height },
      };
    }, HEADING);

    if (!jump) {
      out.push({ theme, route, invalid: 'no banner' });
      await page.close();
      continue;
    }

    // Pixels while the reveal may still be running.
    const buf = await page.screenshot();
    const img = decodePng(Buffer.from(buf));
    const cx = Math.max(0, Math.round(jump.rect.x));
    const cy = Math.max(0, Math.round(jump.rect.y));
    let pixel = null;
    if (cy + 8 < img.height && cx + 8 < img.width) {
      pixel = hex(px(img, cx + 12, cy + 6));
    }

    const ink = jump.ink.match(/\d+/g).slice(0, 3).map(Number);
    const naive = jump.ancestorSurfaces[0];
    out.push({
      theme,
      route,
      effectiveOpacity: jump.effectiveOpacity,
      ownBgColor: jump.ownBgColor,
      ink: jump.ink,
      naiveBackground: naive ?? null,
      naiveContrast: naive ? Number(ratio(ink, naive.match(/\d+/g).slice(0, 3).map(Number)).toFixed(2)) : null,
      allAncestorSurfaces: jump.ancestorSurfaces,
      pixelAtBannerCorner: pixel,
      pixelContrast: pixel
        ? Number(ratio(ink, [1, 3, 5].map((i) => parseInt(pixel.slice(i, i + 2), 16))).toFixed(2))
        : null,
    });
    await page.close();
  }
}

await browser.close();
await writeFile('../qa-cta/naive.json', JSON.stringify({ sha: SHA, out }, null, 2), 'utf8');

console.log('theme  route              opacity  ownBg              naiveBg              naive  pixel     pxContrast');
for (const r of out) {
  if (r.invalid) {
    console.log(r.theme.padEnd(6), r.route.padEnd(18), 'INVALID', JSON.stringify(r.invalid));
    continue;
  }
  console.log(
    r.theme.padEnd(6),
    r.route.padEnd(18),
    String(r.effectiveOpacity).padEnd(8),
    String(r.ownBgColor).padEnd(18),
    String(r.naiveBackground).padEnd(20),
    String(r.naiveContrast).padEnd(6),
    String(r.pixelAtBannerCorner).padEnd(9),
    String(r.pixelContrast),
  );
}
