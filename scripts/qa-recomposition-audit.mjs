/**
 * Finds sections that were "made responsive" only by turning sideways.
 *
 * THE RULE: a section that answers a narrow viewport with `flexDirection:
 * 'column'` has not been made responsive. It is still the desktop composition,
 * just taller. Sections must structurally REARRANGE at mobile.
 *
 * That rule is easy to state and easy to violate quietly, because the violating
 * code looks responsive - it has a breakpoint in it. So this measures the thing
 * the rule is actually about, by loading every route TWICE and comparing:
 *
 *   at 1440   a container is a row of N children
 *   at 390    the SAME container is a column of the SAME N children
 *
 * Same children, same order, only the axis changed, and the result is tall
 * enough to scroll past. That is the anti-pattern, and it is reported with the
 * height it costs.
 *
 * Containers are matched across the two runs by their structural path from the
 * scroll root (child indices). If a path does not exist at the other width, the
 * tree genuinely differs between breakpoints - which is what real recomposition
 * looks like - and it is not reported.
 *
 *   node scripts/qa-recomposition-audit.mjs [--base URL] [--routes all]
 */
import puppeteer from 'puppeteer';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';

/*
 * The register of sections that have been looked at and accepted, each with the
 * reason and the height it was accepted at. A ratchet, not an exemption: an
 * accepted section that grows past its recorded height fails again.
 */
const REG = 'scripts/qa-recomposition-accepted.json';
const ACCEPTED = existsSync(REG) ? JSON.parse(readFileSync(REG, 'utf8')) : { tolerancePx: 0, accepted: [] };
/**
 * Match a section against the register by its VISIBLE text.
 *
 * Icon glyphs are text nodes holding private-use codepoints, so a section whose
 * first element gains an icon suddenly begins with a character that prints as
 * nothing. A plain startsWith then fails against a register entry that looks
 * identical in every terminal and every diff - the hero shrank from 1105px to
 * 843px and was reported as an unreviewed regression because an invisible
 * character had been prepended to its name.
 */
const visible = (s) => {
  let out = '';
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (!(c >= 0xe000 && c <= 0xf8ff)) out += ch;
  }
  return out.trim();
};
const acceptedFor = (route, txt) =>
  ACCEPTED.accepted.find((a) => a.route === route && visible(txt).startsWith(visible(a.match)));

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'http://127.0.0.1:8093');

const ROUTES = (arg('--routes', '') === 'all'
  ? null
  : ['/', '/product', '/pricing', '/flowagent', '/platform/ads', '/platform/social',
     '/solutions/custom-automation', '/solutions/flowshop', '/resources/templates',
     '/company/about', '/education/ai-fluency', '/early-access']);

/** How tall a stacked section has to be before it is worth reporting. */
const TALL_PX = 600;
/**
 * TWO children is the common case, not three. The dominant offender on this
 * site is a copy-beside-a-visual split: at 1440 it is a balanced row, at 390 it
 * becomes 1,100-1,900px of stacked block. An earlier version of this audit
 * required three children AND an unchanged child count, which excluded every
 * one of them and reported a clean sweep across twelve routes.
 */
const MIN_CHILDREN = 2;

const collect = async (page, url) => {
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
  await new Promise((r) => setTimeout(r, 700));
  return page.evaluate(() => {
    const all = [...document.querySelectorAll('*')];
    const scroller = all.find((e) => {
      const cs = getComputedStyle(e);
      return /auto|scroll/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 4;
    }) || document.body;

    const out = {};
    const walk = (el, path, depth) => {
      if (depth > 9) return;
      const kids = [...el.children];
      const cs = getComputedStyle(el);
      if (kids.length >= 2) {
        const r = el.getBoundingClientRect();
        out[path] = {
          dir: cs.flexDirection,
          wrap: cs.flexWrap,
          n: kids.length,
          h: Math.round(r.height),
          // a cheap fingerprint of what the children ARE, so a container whose
          // children were replaced is not mistaken for one that merely rotated
          sig: kids.map((k) => k.tagName + ':' + Math.round(k.getBoundingClientRect().width)).join('|').slice(0, 120),
          txt: (el.textContent || '').trim().slice(0, 44),
        };
      }
      kids.forEach((k, i) => walk(k, path + '/' + i, depth + 1));
    };
    walk(scroller, '', 0);
    return { paths: out, pageH: scroller.scrollHeight };
  });
};

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage();

let routes = ROUTES;
if (!routes) {
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE + '/', { waitUntil: 'networkidle2' });
  routes = await page.evaluate(() =>
    [...new Set([...document.querySelectorAll('a[href^="/"]')].map((a) => a.getAttribute('href')))]
      .filter((h) => h && !h.includes('#'))
      .slice(0, 48));
  routes = [...new Set(['/'].concat(routes))];
}

const offenders = [];
const accepted = [];
let checked = 0;

for (const route of routes) {
  let wide;
  let phone;
  try {
    await page.setViewport({ width: 1440, height: 900 });
    wide = await collect(page, BASE + route);
    await page.setViewport({ width: 390, height: 844 });
    phone = await collect(page, BASE + route);
  } catch {
    continue;
  }
  checked++;

  const diag = { wide: Object.keys(wide.paths).length, phone: Object.keys(phone.paths).length, matched: 0, rowToCol: 0, sameN: 0, tall: 0 };
  const hits = [];
  for (const [path, w] of Object.entries(wide.paths)) {
    const p = phone.paths[path];
    if (!p) continue;                                  // tree differs = real recomposition
    diag.matched++;
    if (!/row/.test(w.dir)) continue;                  // was not a row to begin with
    if (!/column/.test(p.dir)) continue;               // still a row on the phone
    diag.rowToCol++;
    // A changed child count is NOT proof of recomposition: 4 -> 2 usually means
    // two children were dropped and the rest still stack.
    if (p.n < MIN_CHILDREN) continue;
    diag.sameN++;
    if (p.h < TALL_PX) continue;                       // short enough not to matter
    diag.tall++;
    hits.push({ path, n: p.n, h: p.h, txt: p.txt });
  }
  // keep only the outermost offender per branch, so one section is one finding
  const trimmed = hits.filter((h) => !hits.some((o) => o !== h && h.path.startsWith(o.path + '/')));
  const fresh = [];
  const held = [];
  for (const h of trimmed) {
    const a = acceptedFor(route, h.txt);
    if (a && h.h <= a.acceptedAtPx + ACCEPTED.tolerancePx) held.push({ ...h, a });
    else if (a) fresh.push({ ...h, grew: a });
    else fresh.push(h);
  }
  accepted.push(...held.map((h) => ({ route, ...h })));
  if (fresh.length) offenders.push({ route, pageH: phone.pageH, hits: fresh });

  process.stdout.write('    diag ' + JSON.stringify(diag) + '\n');
  process.stdout.write('  ' + route.padEnd(32) + String(phone.pageH).padStart(6) + 'px  ' +
    (fresh.length ? fresh.length + ' UNREVIEWED' : held.length ? held.length + ' accepted' : 'recomposed') + '\n');
}
await browser.close();

if (accepted.length) {
  console.log('\n=== reviewed and accepted, with reasons ===');
  for (const a of accepted) {
    console.log('  ' + String(a.h).padStart(5) + 'px  ' + a.route.padEnd(30) + a.a.category);
  }
  console.log('  ' + accepted.length + ' accepted; each fails again if it grows more than +' +
    ACCEPTED.tolerancePx + 'px past the height it was accepted at');
}

console.log('\n=== stacked-only and NOT yet reviewed ===');
if (!offenders.length) {
  console.log('  none across ' + checked + ' route(s)');
} else {
  let total = 0;
  for (const o of offenders) {
    console.log('  ' + o.route + '   (page ' + o.pageH + 'px)');
    for (const h of o.hits) {
      total++;
      console.log('      ' + String(h.h).padStart(5) + 'px  ' + h.n + ' children  "' + h.txt + '"');
    }
  }
  console.log('\n  ' + total + ' section(s) across ' + offenders.length + ' route(s) of ' + checked + ' checked');
}
writeFileSync('qa-recomposition.json', JSON.stringify({ checked, offenders }, null, 2));
process.exit(offenders.length ? 1 : 0);
