/**
 * Review captures: the hero and the navigation at 390 / 768 / 1440.
 *
 * Two things are photographed at each width because they are the two surfaces
 * that changed shape rather than size:
 *
 *   HERO   the first viewport, which is what decides whether the copy is
 *          readable and whether the CTA is reachable without scrolling. A
 *          full-page screenshot hides exactly that - it rescales the fold away.
 *          So this captures ONE VIEWPORT, not the whole page, and separately
 *          records where the primary CTA actually lands.
 *   NAV    closed, then open. Below the compact breakpoint that is the overlay;
 *          above it, the mega panel. Both are "the navigation at this width",
 *          so both get taken and named by what they are.
 *
 *   node scripts/qa-capture.mjs [--base URL] [--out qa-shots/review]
 */
import puppeteer from 'puppeteer';
import { mkdirSync } from 'node:fs';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'http://127.0.0.1:8093');
const OUT = arg('--out', 'qa-shots/review');
mkdirSync(OUT, { recursive: true });

const SIZES = [
  { w: 390, h: 844 },
  { w: 768, h: 1024 },
  { w: 1440, h: 900 },
];

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage();
const rows = [];

for (const { w, h } of SIZES) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
  await page.goto(BASE + '/', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1100));

  // one viewport, so the fold is where a visitor's fold actually is
  await page.screenshot({ path: OUT + '/hero-' + w + '.png' });

  const facts = await page.evaluate(() => {
    const vh = window.innerHeight;
    /*
     * The HERO's call to action, not the header's.
     *
     * The site header carries a "Join early access" button too, so a plain
     * text match found it first and reported the CTA at 10px from the top at
     * 1440 - a number that looks like a pass and measures the wrong control.
     * Anything inside the banner landmark is excluded.
     */
    const byText = (re) => [...document.querySelectorAll('[role="button"], button, a[href]')]
      .filter((e) => !e.closest('header, [role="banner"], [role="dialog"]'))
      .find((e) => re.test((e.textContent || '').trim()));
    const cta = byText(/^join early access$/i);
    const second = byText(/see flowagent in action/i);
    const h1 = document.querySelector('h1, [role="heading"][aria-level="1"]');
    // is any hero text sitting on a photograph?
    const imgs = [...document.querySelectorAll('img')].filter((i) => {
      const r = i.getBoundingClientRect();
      return r.top < vh && r.height > 60;
    });
    const rect = (e) => (e ? Math.round(e.getBoundingClientRect().top) : null);
    return {
      vh,
      h1Top: rect(h1),
      ctaTop: rect(cta),
      ctaInFold: cta ? cta.getBoundingClientRect().bottom <= vh : false,
      secondTop: rect(second),
      heroImages: imgs.length,
      scroller: (() => {
        const s = [...document.querySelectorAll('*')].find((e) => {
          const cs = getComputedStyle(e);
          return /auto|scroll/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 4;
        });
        return s ? s.scrollHeight : 0;
      })(),
    };
  });

  // navigation: closed, then open, whichever mechanism this width uses
  const nav = await page.evaluate(() => {
    const hamburger = [...document.querySelectorAll('[role="button"], button')]
      .find((e) => /open navigation/i.test(e.getAttribute('aria-label') || ''));
    if (hamburger) { hamburger.click(); return 'overlay'; }
    const trigger = [...document.querySelectorAll('[aria-expanded]')]
      .find((e) => e.getBoundingClientRect().width > 0);
    if (trigger) { trigger.click(); return 'mega'; }
    return 'none';
  });
  await new Promise((r) => setTimeout(r, 650));
  if (nav !== 'none') await page.screenshot({ path: OUT + '/nav-' + nav + '-' + w + '.png' });

  rows.push({ w, nav, ...facts });
}

await browser.close();

console.log('=== review captures ===');
for (const r of rows) {
  console.log('  ' + String(r.w).padStart(4) + 'px  viewport ' + r.vh +
    '   h1 at ' + String(r.h1Top).padStart(4) +
    '   CTA at ' + String(r.ctaTop).padStart(4) + (r.ctaInFold ? '  IN FOLD' : '  BELOW FOLD') +
    '   hero images ' + r.heroImages +
    '   page ' + r.scroller + 'px   nav=' + r.nav);
}
console.log('\n  written to ' + OUT);
