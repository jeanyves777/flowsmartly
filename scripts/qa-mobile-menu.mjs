/**
 * Mobile navigation verification at 390px.
 *
 * Screenshots the four states worth judging by eye - closed, open with
 * everything collapsed, one section expanded, several expanded - and machine-
 * checks the things an eye is bad at.
 *
 * The check that matters most is COVERAGE. react-native-web scrolls the page
 * inside a transformed container, and a CSS transform makes any `position:
 * fixed` descendant resolve against THAT box instead of the viewport. The menu
 * therefore rendered as a short panel with the hero plainly visible underneath
 * it. "The overlay has position:fixed and height:100dvh" is not evidence it
 * covered anything - so this asks the document what is actually painted at the
 * bottom of the viewport and fails if the answer is page content.
 *
 *   node scripts/qa-mobile-menu.mjs [--base URL] [--shots DIR]
 */
import puppeteer from 'puppeteer';
import { mkdirSync } from 'node:fs';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'http://127.0.0.1:8093');
const SHOTS = arg('--shots', './qa-shots/menu');
mkdirSync(SHOTS, { recursive: true });

const findings = [];
const note = (s) => findings.push(s);

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await page.goto(BASE + '/', { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 900));

const shot = (name) => page.screenshot({ path: SHOTS + '/' + name + '.png' });

/** The hamburger: an accessible control that opens navigation. */
const findTrigger = () =>
  page.evaluateHandle(() => {
    const cands = [...document.querySelectorAll('[role="button"], button')];
    return cands.find((e) => /open navigation|menu/i.test(e.getAttribute('aria-label') || '')) || null;
  });

await shot('01-closed');

const trigger = await findTrigger();
if (!(await trigger.evaluate((e) => !!e))) {
  note('FAIL  no control with an "Open navigation" accessible label was found');
} else {
  await trigger.evaluate((e) => e.click());
  await new Promise((r) => setTimeout(r, 600));
  await shot('02-open-collapsed');

  /* ---------- coverage: is the page visible underneath? ---------- */
  const cover = await page.evaluate(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // what is painted near the bottom of the viewport, and near the middle?
    const probes = [[vw / 2, vh - 24], [vw / 2, vh / 2], [vw / 2, vh - 120]];
    const hits = probes.map(([x, y]) => {
      const el = document.elementFromPoint(x, y);
      if (!el) return { tag: 'none', txt: '' };
      return { tag: el.tagName, txt: (el.textContent || '').trim().slice(0, 40) };
    });
    // the overlay = the topmost fixed ancestor of the element at mid-viewport
    let ov = document.elementFromPoint(vw / 2, vh / 2);
    let overlay = null;
    while (ov) {
      const cs = getComputedStyle(ov);
      if (cs.position === 'fixed') overlay = ov;
      ov = ov.parentElement;
    }
    const r = overlay ? overlay.getBoundingClientRect() : null;
    return {
      hits,
      overlay: r ? { top: Math.round(r.top), left: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height) } : null,
      vw, vh,
      bodyScrollLocked: getComputedStyle(document.body).overflow,
    };
  });

  if (!cover.overlay) {
    note('FAIL  no position:fixed overlay found at mid-viewport - the menu is not escaping the transform');
  } else {
    const o = cover.overlay;
    if (o.top > 1 || o.left > 1 || o.w < cover.vw - 1 || o.h < cover.vh - 1) {
      note('FAIL  overlay does not cover the viewport: ' + JSON.stringify(o) + ' vs ' + cover.vw + 'x' + cover.vh);
    } else {
      note('ok    overlay covers the full viewport (' + o.w + 'x' + o.h + ')');
    }
  }

  /* ---------- scroll lock ---------- */
  const scrolled = await page.evaluate(async () => {
    const all = [...document.querySelectorAll('*')];
    const sc = all.find((e) => {
      const cs = getComputedStyle(e);
      return /auto|scroll/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 4;
    });
    if (!sc) return { moved: 0, found: false };
    const before = sc.scrollTop;
    sc.scrollTop = before + 400;
    window.scrollBy(0, 400);
    await new Promise((r) => setTimeout(r, 120));
    const after = sc.scrollTop;
    sc.scrollTop = before;
    return { moved: Math.abs(after - before), found: true };
  });
  if (scrolled.found && scrolled.moved > 4) {
    note('WARN  the page behind the menu still scrolls (' + scrolled.moved + 'px)');
  } else {
    note('ok    background scroll is locked');
  }

  /* ---------- rows, labels, targets ---------- */
  const rows = await page.evaluate(() => {
    const vh = window.innerHeight;
    let ov = document.elementFromPoint(window.innerWidth / 2, vh / 2);
    let overlay = null;
    while (ov) { if (getComputedStyle(ov).position === 'fixed') overlay = ov; ov = ov.parentElement; }
    if (!overlay) return null;
    const inter = [...overlay.querySelectorAll('[role="button"], button, a[href], [role="link"]')];
    const small = inter
      .map((e) => ({ r: e.getBoundingClientRect(), t: (e.textContent || '').trim().slice(0, 24) }))
      .filter((x) => x.r.height > 0 && x.r.height < 44)
      .map((x) => x.t + ' ' + Math.round(x.r.height) + 'px');
    const expandables = inter.filter((e) => e.hasAttribute('aria-expanded'));
    const primary = inter
      .map((e) => ({ h: e.getBoundingClientRect().height, fs: parseFloat(getComputedStyle(e).fontSize), t: (e.textContent || '').trim() }))
      .filter((x) => /^(Product|Solutions|Resources|FlowAgent|Pricing)$/.test(x.t));
    return { small, expandableCount: expandables.length, primary, total: inter.length };
  });

  if (!rows) note('FAIL  could not inspect overlay contents');
  else {
    note('ok    ' + rows.total + ' interactive controls, ' + rows.expandableCount + ' carry aria-expanded');
    if (rows.small.length) note('WARN  touch targets under 44px: ' + rows.small.slice(0, 6).join(', '));
    else note('ok    every touch target is at least 44px');
    for (const p of rows.primary) {
      const okH = p.h >= 58 && p.h <= 70;
      note((okH ? 'ok   ' : 'WARN ') + ' row "' + p.t + '" ' + Math.round(p.h) + 'px (want 60-68)');
    }
  }

  /* ---------- expand one, then several ---------- */
  const expandByLabel = (label) =>
    page.evaluate((lbl) => {
      const els = [...document.querySelectorAll('[role="button"], button')];
      const el = els.find((e) => (e.textContent || '').trim() === lbl && e.hasAttribute('aria-expanded'));
      if (el) { el.click(); return true; }
      return false;
    }, label);

  if (await expandByLabel('Product')) {
    await new Promise((r) => setTimeout(r, 450));
    await shot('03-product-expanded');
    note('ok    Product expands');
  } else note('WARN  no expandable row labelled "Product"');

  if (await expandByLabel('Solutions')) {
    await new Promise((r) => setTimeout(r, 400));
    await expandByLabel('Resources');
    await new Promise((r) => setTimeout(r, 450));
    await shot('04-multiple-expanded');
    note('ok    multiple sections expand');
  } else note('WARN  no expandable row labelled "Solutions"');

  /* ---------- escape closes ---------- */
  await page.keyboard.press('Escape');
  await new Promise((r) => setTimeout(r, 500));
  const stillOpen = await page.evaluate(() => {
    let ov = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
    while (ov) { if (getComputedStyle(ov).position === 'fixed' && ov.getBoundingClientRect().height > window.innerHeight * 0.8) return true; ov = ov.parentElement; }
    return false;
  });
  note((stillOpen ? 'WARN  Escape did not close the menu' : 'ok    Escape closes the menu'));
}

/* ---------- short viewport ---------- */
await page.setViewport({ width: 390, height: 640, deviceScaleFactor: 2 });
await page.reload({ waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 800));
const t2 = await findTrigger();
if (await t2.evaluate((e) => !!e)) {
  await t2.evaluate((e) => e.click());
  await new Promise((r) => setTimeout(r, 600));
  await shot('05-short-viewport-640');
  const short = await page.evaluate(() => {
    let ov = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
    let overlay = null;
    while (ov) { if (getComputedStyle(ov).position === 'fixed') overlay = ov; ov = ov.parentElement; }
    if (!overlay) return null;
    const r = overlay.getBoundingClientRect();
    // are the bottom actions reachable (either visible or scrollable to)?
    const actions = [...overlay.querySelectorAll('[role="button"], button, a[href]')]
      .filter((e) => /join early access|log in/i.test(e.textContent || ''));
    return { h: Math.round(r.height), vh: window.innerHeight, actions: actions.length };
  });
  if (!short) note('FAIL  no overlay at 390x640');
  else note((short.h >= short.vh - 1 ? 'ok   ' : 'WARN ') + ' at 390x640 overlay is ' + short.h + 'px for a ' + short.vh + 'px viewport; ' + short.actions + ' bottom action(s) present');
}

await browser.close();

console.log('\n=== mobile menu at 390px ===');
for (const f of findings) console.log('  ' + f);
const bad = findings.filter((f) => f.startsWith('FAIL') || f.startsWith('WARN'));
console.log('\n  screenshots: ' + SHOTS);
console.log('  ' + bad.length + ' issue(s)');
process.exit(findings.some((f) => f.startsWith('FAIL')) ? 1 : 0);
