/**
 * LANE C probe — does the footer CTA gradient actually paint?
 *
 * Three ways this measurement can lie, each of which produced a convincing
 * wrong answer on the way here:
 *
 *  1. **A `background-image` is invisible to an ancestor `background-color`
 *     walk.** A contrast harness written that way skips the banner entirely and
 *     reports the page underneath it. That is what produced the ~1.05:1 numbers
 *     this lane was sent to explain, and it is reproduced here as `naive` so the
 *     two can be compared side by side.
 *  2. **The rect and the pixels must come from the same frame.** Lazy images and
 *     the reveal animation keep moving the page after `scrollIntoView` returns,
 *     so a clip taken from a rect measured a moment earlier photographs a
 *     different section. The rect is therefore settled first, the viewport is
 *     captured once, and the crop is cut out of that same decoded buffer.
 *  3. **The element must be proved to be the banner.** Its own text is checked,
 *     not its position.
 */
import puppeteer from 'puppeteer';
import { mkdir, writeFile } from 'node:fs/promises';
import { decodePng, px, hex, ratio } from './qa-png.mjs';
import { cropToPng } from './qa-png-write.mjs';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.argv[2] ?? 'qa-cta';
const BASE = process.argv[3] ?? 'http://127.0.0.1:8097';
const SHA = process.argv[4] ?? 'unknown';

const WIDTHS = [390, 768, 1440];
const THEMES = ['light', 'grey', 'dark'];
const HEADING = 'Ready to bring your business together?';
const PANEL = 'See FlowAgent in action';

await mkdir(OUT, { recursive: true });
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const rows = [];
const failures = [];

for (const theme of THEMES) {
  for (const width of WIDTHS) {
    const tag = theme + '-' + width;
    const page = await browser.newPage();
    await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
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
    await page.goto(BASE + '/', { waitUntil: 'networkidle0', timeout: 60000 });

    /* ---- the five assertions ---- */
    const seen = await page.evaluate((h) => ({
      route: location.pathname,
      notFound: document.body.innerText.includes('PAGE NOT FOUND'),
      mounted: !!document.querySelector('[aria-label^="Theme:"]'),
      heading: document.body.innerText.includes(h),
      startFree: document.body.innerText.includes('Start free'),
      inAction: document.body.innerText.includes('See FlowAgent in action'),
      bodyChars: document.body.innerText.length,
    }), HEADING);
    const shaOk = await page.evaluate(async (s) => {
      try {
        return (await (await fetch('/CANDIDATE_SHA.txt')).text()).trim() === s;
      } catch {
        return false;
      }
    }, SHA);
    const asserts = {
      ASSERT_ROUTE_IDENTITY: seen.route === '/',
      ASSERT_PAGE_MOUNTED: seen.mounted && seen.bodyChars > 2000,
      ASSERT_CANDIDATE_SHA: shaOk,
      ASSERT_NOT_404: !seen.notFound,
      ASSERT_EXPECTED_CONTENT: seen.heading && seen.startFree && seen.inAction,
    };
    if (Object.values(asserts).some((v) => !v)) {
      failures.push(tag + ': INVALID — ' + JSON.stringify(asserts));
      await page.close();
      continue;
    }

    /* ---- theme: click until the label says so, rather than counting ---- */
    const readTheme = () =>
      page.evaluate(() => {
        const el = document.querySelector('[aria-label^="Theme:"]');
        return ((el && el.getAttribute('aria-label')) || '').split(' ')[1]?.replace('.', '') ?? 'unknown';
      });
    let reached = await readTheme();
    for (let i = 0; i < 6 && reached !== theme; i += 1) {
      await page.waitForSelector('[aria-label^="Theme:"]', { visible: true, timeout: 15000 });
      await page.click('[aria-label^="Theme:"]');
      await new Promise((r) => setTimeout(r, 280));
      reached = await readTheme();
    }
    if (reached !== theme) {
      failures.push(tag + ': asked ' + theme + ', got ' + reached);
      await page.close();
      continue;
    }

    /* ---- scroll through (lazy art + reveals), then land on the banner ---- */
    await page.evaluate(async () => {
      const s = [...document.querySelectorAll('div')].find((el) => el.scrollHeight > el.clientHeight + 40);
      const el = s ?? document.documentElement;
      for (let y = 0; y < el.scrollHeight; y += 500) {
        el.scrollTop = y;
        await new Promise((r) => setTimeout(r, 60));
      }
    });

    /* ---- tag the banner by its own content, then wait for it to stop moving ---- */
    const tagged = await page.evaluate((h, p) => {
      const heading = [...document.querySelectorAll('h1,h2,div,span')].find((n) => n.textContent?.trim() === h);
      if (!heading) return null;
      let node = heading;
      while (node && node !== document.body) {
        const cs = getComputedStyle(node);
        if (cs.backgroundImage && cs.backgroundImage !== 'none') {
          node.setAttribute('data-qa-cta', '');
          return { text: (node.textContent || '').slice(0, 120), containsPanel: (node.textContent || '').includes(p) };
        }
        node = node.parentElement;
      }
      return null;
    }, HEADING, PANEL);
    if (!tagged || !tagged.containsPanel || !tagged.text.includes('Ready to bring')) {
      failures.push(tag + ': gradient host is not the CTA banner — ' + JSON.stringify(tagged));
      await page.close();
      continue;
    }

    let settled = null;
    for (let i = 0; i < 40; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const r = await page.evaluate(() => {
        const el = document.querySelector('[data-qa-cta]');
        if (!el) return null;
        const b = el.getBoundingClientRect();
        const vh = window.innerHeight;
        // Keep the banner's top edge on screen with room for the strip below it.
        if (b.top < 8 || b.top > vh - 40) el.scrollIntoView({ block: 'center' });
        const a = el.getBoundingClientRect();
        return { x: a.x, y: a.y, w: a.width, h: a.height };
      });
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r2) => setTimeout(r2, 200));
      // eslint-disable-next-line no-await-in-loop
      const r2 = await page.evaluate(() => {
        const el = document.querySelector('[data-qa-cta]');
        if (!el) return null;
        const a = el.getBoundingClientRect();
        return { x: a.x, y: a.y, w: a.width, h: a.height };
      });
      if (r && r2 && Math.abs(r.y - r2.y) < 0.5 && Math.abs(r.x - r2.x) < 0.5 && r2.y > 4) {
        settled = r2;
        break;
      }
    }
    if (!settled) {
      failures.push(tag + ': banner rect never settled on screen');
      await page.close();
      continue;
    }

    /* ---- one capture; rect re-checked against it before and after ---- */
    const info = await page.evaluate(() => {
      const el = document.querySelector('[data-qa-cta]');
      const cs = getComputedStyle(el);
      const heading = [...el.querySelectorAll('h1,h2,div,span')].find((n) =>
        n.textContent?.trim().startsWith('Ready to bring'),
      );
      const chain = [];
      let node = el;
      while (node && node !== document.body) {
        const c = getComputedStyle(node);
        chain.push({ bgColor: c.backgroundColor, bgImage: c.backgroundImage });
        node = node.parentElement;
      }
      const naive = chain.find((c) => c.bgColor !== 'rgba(0, 0, 0, 0)' && c.bgColor !== 'transparent');
      let eff = 1;
      let a = el;
      while (a && a !== document.body) {
        eff *= Number(getComputedStyle(a).opacity || '1');
        a = a.parentElement;
      }
      const b = el.getBoundingClientRect();
      return {
        rect: { x: b.x, y: b.y, w: b.width, h: b.height },
        bgImage: cs.backgroundImage,
        bgColor: cs.backgroundColor,
        effectiveOpacity: eff,
        ink: heading ? getComputedStyle(heading).color : null,
        naiveBackground: naive ? naive.bgColor : null,
      };
    });

    const buf = await page.screenshot();
    const after = await page.evaluate(() => {
      const b = document.querySelector('[data-qa-cta]').getBoundingClientRect();
      return { x: b.x, y: b.y };
    });
    if (Math.abs(after.y - info.rect.y) > 0.5 || Math.abs(after.x - info.rect.x) > 0.5) {
      failures.push(tag + ': banner moved during capture — rect and pixels do not match');
      await page.close();
      continue;
    }

    const img = decodePng(Buffer.from(buf));
    const cx = Math.round(info.rect.x);
    const cy = Math.round(info.rect.y);
    const cw = Math.min(img.width - cx, Math.round(info.rect.w));
    const chh = Math.min(img.height - cy, Math.round(info.rect.h));

    // 6px below the banner's own top edge, inside its padding — its bare field.
    // A horizontal gradient must read as three DIFFERENT colours across it.
    const ty = cy + 6;
    const strip = [0.06, 0.5, 0.94].map((f) => {
      const sx = Math.min(img.width - 2, Math.max(1, cx + Math.round(cw * f)));
      const rgb = px(img, sx, ty);
      return { at: f, color: hex(rgb), rgb };
    });
    const ink = (info.ink || 'rgb(0,0,0)').match(/\d+/g).slice(0, 3).map(Number);

    writeFileSync(join(OUT, 'cta-' + tag + '.png'), cropToPng(img, cx, cy, cw, chh));
    writeFileSync(join(OUT, 'view-' + tag + '.png'), Buffer.from(buf));

    rows.push({
      tag,
      theme,
      width,
      asserts,
      hostText: tagged.text,
      rect: info.rect,
      bgImage: info.bgImage,
      bgColor: info.bgColor,
      effectiveOpacity: info.effectiveOpacity,
      ink: info.ink,
      naiveBackground: info.naiveBackground,
      strip,
      distinct: new Set(strip.map((s) => s.color)).size,
      contrastReal: Number(ratio(ink, strip[0].rgb).toFixed(2)),
      contrastNaive: info.naiveBackground
        ? Number(ratio(ink, info.naiveBackground.match(/\d+/g).slice(0, 3).map(Number)).toFixed(2))
        : null,
    });
    await page.close();
  }
}

await browser.close();
await writeFile(join(OUT, 'report.json'), JSON.stringify({ sha: SHA, rows, failures }, null, 2), 'utf8');

console.log('tag           rect         bgColor            left      mid       right     n  real   naive');
for (const r of rows) {
  console.log(
    r.tag.padEnd(13) +
      ' ' +
      (Math.round(r.rect.w) + 'x' + Math.round(r.rect.h)).padEnd(12) +
      ' ' +
      String(r.bgColor).padEnd(18) +
      ' ' +
      r.strip[0].color.padEnd(9) +
      ' ' +
      r.strip[1].color.padEnd(9) +
      ' ' +
      r.strip[2].color.padEnd(9) +
      ' ' +
      String(r.distinct).padEnd(2) +
      ' ' +
      String(r.contrastReal).padEnd(6) +
      ' ' +
      String(r.contrastNaive),
  );
}
console.log('\n' + String(failures.length) + ' invalid run(s).');
for (const f of failures) console.log('  ' + f);
