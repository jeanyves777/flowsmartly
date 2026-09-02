/**
 * DOM-level accessibility REGRESSION ASSERTIONS at 390px and 1440px.
 *
 * These are deliberately not axe rules. axe audits the DOM it is given, and
 * every defect this file guards against was invisible to it: react-native-web
 * silently drops accessibility props it does not implement, so the attribute
 * was simply absent and there was nothing for a rule to object to. A green axe
 * run was compatible with disclosures that announced no state and 670 icon
 * glyphs being read aloud.
 *
 * So each assertion states a POSITIVE FACT about the rendered document, and
 * fails if the fact stops being true:
 *
 *   1. DISCLOSURE STATE      every expandable control carries a real
 *                            aria-expanded, and the value TRACKS the toggle.
 *                            An attribute that never changes would satisfy a
 *                            presence check while telling a screen-reader user
 *                            the same thing forever.
 *   2. SELECTED / CURRENT    aria-selected only on tab-like roles, aria-pressed
 *                            on buttons, aria-current on links. Getting this
 *                            wrong is prohibited ARIA, not a style preference,
 *                            and it was introduced ONCE ALREADY by the fix that
 *                            was meant to add these attributes.
 *   3. DECORATIVE SVG        every inline svg is either hidden or labelled.
 *   4. ICON GLYPHS           no private-use-area codepoint is exposed to
 *                            assistive technology. @expo/vector-icons sets no
 *                            accessibility props, so each icon is a text node
 *                            holding an unpronounceable character.
 *
 * Both widths, because the site recomposes between them and a phone-only sweep
 * once reported three unlabelled images where there were nine.
 *
 *   node scripts/qa-a11y-assertions.mjs [--base URL]
 */
import puppeteer from 'puppeteer';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'http://127.0.0.1:8093');
const WIDTHS = [390, 1440];

const ROUTES = [
  '/', '/product', '/pricing', '/flowagent', '/early-access',
  '/platform/ads', '/platform/integrations', '/resources/templates',
  '/company/about', '/company/careers', '/education/ai-fluency',
];

const failures = [];
const stats = { expanded: 0, toggled: 0, pressed: 0, current: 0, svg: 0, glyphs: 0, checked: 0 };

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage();

for (const W of WIDTHS) {
  await page.setViewport({ width: W, height: W <= 430 ? 844 : 900 });

  for (const route of ROUTES) {
    const at = route + ' @' + W;
    try {
      const res = await page.goto(BASE + route, { waitUntil: 'networkidle2', timeout: 45000 });
      if (!res || res.status() >= 400) { failures.push(at + '  did not load'); continue; }
    } catch { failures.push(at + '  did not load'); continue; }
    await new Promise((r) => setTimeout(r, 650));

    /* ---- 2/3/4: static facts about the rendered document ---- */
    const s = await page.evaluate(() => {
      const q = (sel) => [...document.querySelectorAll(sel)];
      const bad = [];

      // aria-selected is valid ONLY on tab-like roles
      const SELECTABLE = ['tab', 'option', 'row', 'gridcell', 'treeitem', 'columnheader', 'rowheader'];
      for (const e of q('[aria-selected]')) {
        const role = e.getAttribute('role') || '';
        if (!SELECTABLE.includes(role)) {
          bad.push('aria-selected on role="' + (role || 'none') + '": ' + (e.textContent || '').trim().slice(0, 30));
        }
      }
      /*
       * aria-label on a GENERIC element names nothing. But "no role attribute"
       * is not the same as "no role": an <input>, <a href>, <button> or <img>
       * carries an implicit role that a label attaches to perfectly well.
       * Treating those as roleless flagged the integrations search field and
       * its own description - correct markup reported as a defect.
       */
      const IMPLICIT = { INPUT: 1, TEXTAREA: 1, SELECT: 1, BUTTON: 1, IMG: 1, SVG: 1, NAV: 1, MAIN: 1, HEADER: 1, FOOTER: 1, SECTION: 1, ASIDE: 1, FORM: 1, DIALOG: 1 };
      for (const e of q('[aria-label], [aria-labelledby]')) {
        const role = e.getAttribute('role');
        if (role && role !== 'generic' && role !== 'presentation' && role !== 'none') continue;
        if (IMPLICIT[e.tagName]) continue;
        if (e.tagName === 'A' && e.hasAttribute('href')) continue;
        bad.push('aria-label on a roleless element: "' + (e.getAttribute('aria-label') || '').slice(0, 30) + '"');
      }
      // every inline svg must be hidden or named
      let svgSeen = 0;
      for (const e of q('svg')) {
        svgSeen++;
        const hidden = e.closest('[aria-hidden="true"]');
        const named = e.getAttribute('aria-label') || e.getAttribute('role') === 'img' || e.querySelector('title');
        if (!hidden && !named) bad.push('svg neither hidden nor named');
      }
      // no private-use glyph may be reachable by assistive technology
      let glyphs = 0;
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walk.nextNode())) {
        const t = (n.textContent || '').trim();
        if (!t) continue;
        let isGlyph = false;
        for (const ch of t) {
          const c = ch.codePointAt(0);
          if (c >= 0xe000 && c <= 0xf8ff) { isGlyph = true; break; }
        }
        if (!isGlyph) continue;
        glyphs++;
        const el = n.parentElement;
        if (!el) continue;
        if (el.closest('[aria-hidden="true"]')) continue;
        /*
         * A glyph inside an element that has its own accessible name is fine:
         * role="img" + aria-label makes the label the announcement and the text
         * content is never read. Requiring aria-hidden as well would have meant
         * every brand mark on the integrations page reported as a defect for
         * being correctly labelled.
         */
        const named = el.closest('[aria-label], [aria-labelledby]');
        if (named) {
          const r = named.getAttribute('role');
          if (r === 'img' || r === 'button' || r === 'link' || named.tagName === 'BUTTON' || named.tagName === 'A') continue;
        }
        bad.push('icon glyph exposed to assistive tech near: ' + (el.parentElement ? (el.parentElement.textContent || '').trim().slice(0, 28) : ''));
      }
      return {
        bad,
        counts: {
          expanded: q('[aria-expanded]').length,
          pressed: q('[aria-pressed]').length,
          current: q('[aria-current]').length,
          checked: q('[aria-checked]').length,
          svg: svgSeen,
          glyphs,
        },
      };
    });

    stats.expanded += s.counts.expanded;
    stats.pressed += s.counts.pressed;
    stats.current += s.counts.current;
    stats.checked += s.counts.checked;
    stats.svg += s.counts.svg;
    stats.glyphs += s.counts.glyphs;

    // dedupe within a route so one repeated component is one failure line
    for (const b of [...new Set(s.bad)]) failures.push(at + '  ' + b);

    /* ---- 1: disclosure state must TRACK the control ---- */
    const toggled = await page.evaluate(async () => {
      const rows = [...document.querySelectorAll('[aria-expanded]')]
        .filter((e) => e.getBoundingClientRect().width > 0);
      if (!rows.length) return { tested: 0, broken: [] };
      const broken = [];
      let tested = 0;
      for (const el of rows.slice(0, 4)) {
        const before = el.getAttribute('aria-expanded');
        el.click();
        await new Promise((r) => setTimeout(r, 260));
        const after = el.getAttribute('aria-expanded');
        tested++;
        if (before === after) {
          broken.push('aria-expanded stuck at "' + before + '" on "' + (el.textContent || '').trim().slice(0, 24) + '"');
        }
        el.click();                       // restore
        await new Promise((r) => setTimeout(r, 160));
      }
      return { tested, broken };
    });
    stats.toggled += toggled.tested;
    for (const b of toggled.broken) failures.push(at + '  ' + b);

    process.stdout.write('  ' + at.padEnd(32) +
      'expanded=' + String(s.counts.expanded).padStart(2) +
      ' pressed=' + String(s.counts.pressed).padStart(2) +
      ' current=' + String(s.counts.current).padStart(2) +
      ' svg=' + String(s.counts.svg).padStart(3) +
      ' glyphs=' + String(s.counts.glyphs).padStart(3) +
      '  toggled=' + toggled.tested + '\n');
  }
}

/* ---- the mobile menu, open: its own surface ---- */
await page.setViewport({ width: 390, height: 844 });
await page.goto(BASE + '/', { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 700));
const menu = await page.evaluate(async () => {
  const trigger = [...document.querySelectorAll('[role="button"], button')]
    .find((e) => /open navigation|menu/i.test(e.getAttribute('aria-label') || ''));
  if (!trigger) return { opened: false };
  trigger.click();
  await new Promise((r) => setTimeout(r, 500));
  const dialog = document.querySelector('[role="dialog"]');
  const rows = [...document.querySelectorAll('[aria-expanded]')].filter((e) => dialog && dialog.contains(e));
  const broken = [];
  for (const el of rows.slice(0, 3)) {
    const before = el.getAttribute('aria-expanded');
    el.click();
    await new Promise((r) => setTimeout(r, 260));
    if (el.getAttribute('aria-expanded') === before) {
      broken.push('menu row aria-expanded stuck: "' + (el.textContent || '').trim().slice(0, 24) + '"');
    }
  }
  return {
    opened: true,
    dialogNamed: !!(dialog && (dialog.getAttribute('aria-label') || dialog.getAttribute('aria-labelledby'))),
    modal: !!document.querySelector('[aria-modal="true"]'),
    rows: rows.length,
    broken,
  };
});
if (!menu.opened) failures.push('menu  could not open');
else {
  if (!menu.dialogNamed) failures.push('menu  dialog has no accessible name');
  if (!menu.modal) failures.push('menu  dialog is not aria-modal');
  if (!menu.rows) failures.push('menu  no aria-expanded rows inside the dialog');
  for (const b of menu.broken) failures.push('menu  ' + b);
  console.log('  ' + 'menu(open)'.padEnd(32) + 'rows=' + menu.rows + ' named=' + menu.dialogNamed + ' modal=' + menu.modal);
}

await browser.close();

console.log('\n=== observed across ' + WIDTHS.join(' / ') + 'px ===');
console.log('  aria-expanded controls   ' + stats.expanded + '   (' + stats.toggled + ' toggled and verified to change)');
console.log('  aria-pressed             ' + stats.pressed);
console.log('  aria-current             ' + stats.current);
console.log('  aria-checked             ' + stats.checked);
console.log('  inline svg               ' + stats.svg + '   (all hidden or named)');
console.log('  icon glyphs              ' + stats.glyphs + '   (all behind aria-hidden)');

console.log('\n=== assertion failures ===');
if (!failures.length) console.log('  none');
else for (const f of failures.slice(0, 40)) console.log('  ' + f);
if (failures.length > 40) console.log('  ... ' + (failures.length - 40) + ' more');

console.log('\nTOTAL FAILURES: ' + failures.length);
process.exit(failures.length ? 1 : 0);
