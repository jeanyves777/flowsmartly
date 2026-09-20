/**
 * Accessibility audit: axe-core over the built export, plus the checks axe
 * cannot make.
 *
 * WHY THE EXTRA CHECKS EXIST.
 *
 * react-native-web silently drops accessibility props it does not implement.
 * There is no warning, no type error, and no trace in the DOM - the prop simply
 * never becomes an attribute. axe then audits a page where the intent was
 * written and never shipped, finds nothing wrong with markup that is missing
 * the attribute entirely, and reports a clean result.
 *
 * Verified against react-native-web's own source in node_modules:
 *
 *   accessibilityState={{expanded}}     INERT. createDOMProps never reads it.
 *                                       It appears only in TouchableWithoutFeedback's
 *                                       prop allowlist and in a legacy
 *                                       `accessibilityStates` (plural) disabled
 *                                       check. Use accessibilityExpanded /
 *                                       Checked / Selected / Disabled / Busy.
 *   accessibilityElementsHidden         INERT. Zero references in dist.
 *   importantForAccessibility           INERT. Zero references in dist.
 *
 * So this greps the SOURCE for props that cannot survive the render, and audits
 * the DOM for what did. A rule that only reads the DOM would call all three of
 * those a pass.
 *
 *   node scripts/qa-a11y-audit.mjs [--base URL] [--width 390]
 *
 * axe-core is vendored (not an npm dependency) at scripts/vendor/axe.min.js:
 *   curl -sL https://cdn.jsdelivr.net/npm/axe-core@4.10.2/axe.min.js -o scripts/vendor/axe.min.js
 */
import puppeteer from 'puppeteer';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'http://127.0.0.1:8093');
const WIDTH = Number(arg('--width', '390'));
const HEIGHT = WIDTH <= 430 ? 844 : 900;
const AXE = 'scripts/vendor/axe.min.js';

if (!existsSync(AXE)) {
  console.error('  axe-core not vendored. Run:');
  console.error('  curl -sL https://cdn.jsdelivr.net/npm/axe-core@4.10.2/axe.min.js -o ' + AXE);
  process.exit(2);
}

const ROUTES = [
  '/', '/product', '/pricing', '/flowagent', '/login', '/early-access',
  '/solutions/custom-automation', '/platform/ads', '/resources/templates',
  '/company/about', '/legal/terms', '/education/ai-fluency',
];

/* ------------------------------------------------------------------ */
/* 1. source: props react-native-web will silently discard             */
/* ------------------------------------------------------------------ */

const SEP = String.fromCharCode(92);
const walk = (d, out = []) => {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/[.]tsx?$/.test(p)) out.push(p.split(SEP).join('/'));
  }
  return out;
};

const INERT = [
  ['accessibilityState', 'never read by createDOMProps - use accessibilityExpanded / Checked / Selected / Disabled'],
  ['accessibilityElementsHidden', 'zero references in react-native-web - use accessibilityHidden'],
  ['importantForAccessibility', 'zero references in react-native-web - use accessibilityHidden'],
];

/**
 * An inert prop is only a DEFECT when nothing else carries the meaning.
 *
 * These stay in the source on purpose: accessibilityState is the contract on
 * native, where the aria-* spelling is the one that is ignored. Keeping both
 * means neither target regresses. Flagging the pair would make this audit cry
 * wolf on 31 deliberate lines and bury the real findings underneath them -
 * which is the same failure mode as an audit that reports nothing at all.
 *
 * So the rule is companionship: an inert prop with an aria-* attribute for the
 * same state within a few lines is correct and silent. One on its own is
 * intent that never ships, and is reported.
 */
const COMPANION = {
  accessibilityState: ['aria-expanded', 'aria-selected', 'aria-checked', 'aria-disabled', 'aria-busy', 'aria-pressed', 'aria-current'],
  accessibilityElementsHidden: ['aria-hidden'],
  importantForAccessibility: ['aria-hidden'],
};

const inertHits = [];
for (const root of ['apps/v5/src']) {
  for (const f of walk(root)) {
    const lines = readFileSync(f, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const [prop, why] of INERT) {
        if (!line.includes(prop)) continue;
        const window = lines.slice(Math.max(0, i - 4), i + 5).join(' ');
        if ((COMPANION[prop] || []).some((c) => window.includes(c))) continue;
        inertHits.push({ f: f.replace('apps/v5/src/', ''), line: i + 1, prop, why });
      }
    });
  }
}

/* ------------------------------------------------------------------ */
/* 2. DOM: axe-core plus structural checks                             */
/* ------------------------------------------------------------------ */

const axeSrc = readFileSync(AXE, 'utf8');
/*
 * Audit at BOTH widths, not just the phone.
 *
 * Running only at 390px reported three unlabelled images on `/`. There are
 * nine: the phone composition simply does not render the other six, so a
 * phone-only sweep declared clean what a desktop visitor meets immediately.
 * Any breakpoint that renders different content needs its own pass, and this
 * site now recomposes heavily between the two.
 */
const WIDTHS = process.argv.includes('--width') ? [WIDTH] : [390, 1440];

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage();
await page.setViewport({ width: WIDTH, height: HEIGHT });

const violations = new Map();   // rule id -> { impact, help, nodes, routes }
const structural = [];

const runAxe = async (label) => {
  const res = await page.evaluate(async () =>
    // eslint-disable-next-line no-undef
    await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
      resultTypes: ['violations'],
    }));
  for (const v of res.violations) {
    const cur = violations.get(v.id) || { impact: v.impact, help: v.help, nodes: 0, routes: new Set(), sample: '' };
    cur.nodes += v.nodes.length;
    cur.routes.add(label);
    if (!cur.sample && v.nodes[0]) cur.sample = (v.nodes[0].html || '').replace(/\s+/g, ' ').slice(0, 96);
    violations.set(v.id, cur);
  }
  return res.violations.reduce((a, v) => a + v.nodes.length, 0);
};

for (const W of WIDTHS) {
 await page.setViewport({ width: W, height: W <= 430 ? 844 : 900 });
 for (const route of ROUTES) {
  const label = route + " @" + W;
  let res;
  try { res = await page.goto(BASE + route, { waitUntil: 'networkidle2', timeout: 45000 }); }
  catch { structural.push({ route: label, msg: 'did not load' }); continue; }
  if (!res || res.status() >= 400) { structural.push({ route: label, msg: 'HTTP ' + (res ? res.status() : '?') }); continue; }
  await new Promise((r) => setTimeout(r, 700));
  await page.addScriptTag({ content: axeSrc });

  const n = await runAxe(label);

  const s = await page.evaluate(() => {
    const q = (sel) => [...document.querySelectorAll(sel)];
    const headings = q('h1,h2,h3,h4,h5,h6,[role="heading"]').map((e) => ({
      lvl: e.tagName.startsWith('H') ? Number(e.tagName[1]) : Number(e.getAttribute('aria-level') || 0),
      txt: (e.textContent || '').trim().slice(0, 40),
    })).filter((h) => h.lvl > 0);
    let skip = null;
    for (let i = 1; i < headings.length; i++) {
      if (headings[i].lvl - headings[i - 1].lvl > 1) { skip = headings[i - 1].lvl + ' -> ' + headings[i].lvl + ' at "' + headings[i].txt + '"'; break; }
    }
    const focusable = q('a[href], button, [role="button"], input, select, textarea, [tabindex]')
      .filter((e) => e.getBoundingClientRect().width > 0);
    return {
      h1: headings.filter((h) => h.lvl === 1).length,
      firstLevel: headings.length ? headings[0].lvl : 0,
      skip,
      lang: document.documentElement.getAttribute('lang') || '',
      landmarks: {
        banner: q('header, [role="banner"]').length,
        nav: q('nav, [role="navigation"]').length,
        main: q('main, [role="main"]').length,
        contentinfo: q('footer, [role="contentinfo"]').length,
      },
      focusableCount: focusable.length,
      // a control whose only content is an icon glyph has no accessible name
      namelessControls: q('a[href], button, [role="button"]').filter((e) => {
        if (e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || e.getAttribute('title')) return false;
        const t = (e.textContent || '').trim();
        if (!t) return true;
        for (const ch of t) { const c = ch.codePointAt(0); if (!(c >= 0xe000 && c <= 0xf8ff) && !/\s/.test(ch)) return false; }
        return true;   // only private-use glyphs
      }).length,
      autoUpdating: q('[aria-live]').length,
    };
  });

  if (s.h1 !== 1) structural.push({ route: label, msg: 'expected exactly one h1, found ' + s.h1 });
  if (s.skip) structural.push({ route: label, msg: 'heading level skipped: ' + s.skip });
  if (!s.lang) structural.push({ route: label, msg: '<html> has no lang attribute' });
  for (const [k, v] of Object.entries(s.landmarks)) {
    if (v === 0) structural.push({ route: label, msg: 'no ' + k + ' landmark' });
  }
  if (s.namelessControls) structural.push({ route: label, msg: s.namelessControls + ' control(s) with no accessible name (icon-only)' });

  process.stdout.write('  ' + label.padEnd(32) + String(n).padStart(3) + ' axe  h1=' + s.h1 +
    '  landmarks[' + Object.entries(s.landmarks).map(([k, v]) => (v ? k[0] : '-')).join('') + ']' +
    '  focusable=' + String(s.focusableCount).padStart(3) + '\n');
}

}

/* ------------------------------------------------------------------ */
/* 3. the mobile menu, open - a whole surface axe never sees closed    */
/* ------------------------------------------------------------------ */
await page.setViewport({ width: 390, height: 844 });
await page.goto(BASE + '/', { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 800));
const opened = await page.evaluate(() => {
  const el = [...document.querySelectorAll('[role="button"], button')]
    .find((e) => /open navigation|menu/i.test(e.getAttribute('aria-label') || ''));
  if (!el) return false;
  el.click();
  return true;
});
if (opened) {
  await new Promise((r) => setTimeout(r, 700));
  await page.addScriptTag({ content: axeSrc });
  const n = await runAxe('menu(open)');
  const m = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('[aria-expanded]')];
    return {
      expanded: rows.length,
      dialog: document.querySelectorAll('[role="dialog"]').length,
      modal: document.querySelectorAll('[aria-modal="true"]').length,
      focusInside: (() => {
        const a = document.activeElement;
        const d = document.querySelector('[role="dialog"]');
        return !!(a && d && d.contains(a));
      })(),
    };
  });
  console.log('  ' + 'menu(open)'.padEnd(30) + String(n).padStart(3) + ' axe  aria-expanded rows=' + m.expanded +
    '  dialog=' + m.dialog + '  aria-modal=' + m.modal + '  focus inside=' + m.focusInside);
  if (!m.dialog) structural.push({ route: 'menu(open)', msg: 'overlay has no role="dialog"' });
  if (!m.modal) structural.push({ route: 'menu(open)', msg: 'overlay is not aria-modal' });
  if (!m.focusInside) structural.push({ route: 'menu(open)', msg: 'focus is not inside the overlay after opening' });
} else {
  structural.push({ route: 'menu(open)', msg: 'could not open the menu' });
}

await browser.close();

/* ------------------------------------------------------------------ */
/* report                                                              */
/* ------------------------------------------------------------------ */
console.log('\n=== props react-native-web discards (source) ===');
if (!inertHits.length) console.log('  none');
else {
  const byProp = inertHits.reduce((a, h) => { (a[h.prop] = a[h.prop] || []).push(h); return a; }, {});
  for (const [prop, list] of Object.entries(byProp)) {
    console.log('  ' + prop + '  x' + list.length + '   ' + list[0].why);
    const byFile = list.reduce((a, h) => { a[h.f] = (a[h.f] || 0) + 1; return a; }, {});
    for (const [f, c] of Object.entries(byFile).slice(0, 8)) console.log('      ' + f + '  x' + c);
    if (Object.keys(byFile).length > 8) console.log('      ... ' + (Object.keys(byFile).length - 8) + ' more files');
  }
}

console.log('\n=== axe-core violations ===');
if (!violations.size) console.log('  none');
else {
  const sorted = [...violations].sort((a, b) => b[1].nodes - a[1].nodes);
  for (const [id, v] of sorted) {
    console.log('  ' + String(v.impact || '?').padEnd(8) + id.padEnd(34) + String(v.nodes).padStart(4) + ' nodes  ' + v.routes.size + ' route(s)');
    console.log('      ' + v.help);
    if (v.sample) console.log('      e.g. ' + v.sample);
  }
}

console.log('\n=== structural ===');
if (!structural.length) console.log('  none');
else {
  const byMsg = structural.reduce((a, s) => { (a[s.msg] = a[s.msg] || []).push(s.route); return a; }, {});
  for (const [msg, routes] of Object.entries(byMsg).sort((a, b) => b[1].length - a[1].length)) {
    console.log('  ' + msg + '   (' + routes.length + ': ' + routes.slice(0, 4).join(', ') + (routes.length > 4 ? ', ...' : '') + ')');
  }
}

const total = inertHits.length + [...violations.values()].reduce((a, v) => a + v.nodes, 0) + structural.length;
writeFileSync('qa-a11y.json', JSON.stringify({
  inert: inertHits,
  axe: [...violations].map(([id, v]) => ({ id, impact: v.impact, help: v.help, nodes: v.nodes, routes: [...v.routes] })),
  structural,
}, null, 2));
console.log('\nTOTAL: ' + total + '  (' + inertHits.length + ' discarded props, ' +
  [...violations.values()].reduce((a, v) => a + v.nodes, 0) + ' axe nodes, ' + structural.length + ' structural)');
process.exit(total ? 1 : 0);
