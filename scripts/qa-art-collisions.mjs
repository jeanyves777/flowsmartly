/**
 * Does the section art land on type?
 *
 * `SectionArt` paints a 1440x420 composition with `preserveAspectRatio="slice"`
 * across `StyleSheet.absoluteFill` of its section. Slice scales to *cover*, so a
 * section taller than 3.43:1 is covered by height — the composition is magnified
 * and cropped horizontally. The taller the section, the bigger the art. That is
 * backwards: the densest sections get the loudest drawing, and its filled nodes
 * can land on a heading.
 *
 * This measures it rather than arguing about it: the intersection between each
 * *filled* art node (rect/circle — the parts carrying a fill, a stroke and a
 * glyph) and each heading or paragraph box.
 */
import puppeteer from 'puppeteer';

const BASE = process.argv[2] ?? 'http://127.0.0.1:8093';

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

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const hits = [];

for (const [route, name] of ROUTES) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1000 });
  await page.evaluateOnNewDocument(() => {
    try {
      window.localStorage.setItem(
        'fs.consent.v1',
        JSON.stringify({ necessary: true, analytics: false, marketing: false, at: 0, version: 1 }),
      );
    } catch {
      /* private mode */
    }
  });
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle0', timeout: 60_000 });

  // Grow the viewport past the content so every section is laid out at its real
  // size; a node below the fold is still painted over a heading.
  const h = await page.evaluate(() => {
    const el = [...document.querySelectorAll('div')].find((d) => d.scrollHeight > d.clientHeight + 40);
    return Math.min(el?.scrollHeight ?? 1000, 14_000);
  });
  await page.setViewport({ width: 1280, height: h });
  await new Promise((r) => setTimeout(r, 500));

  const found = await page.evaluate(() => {
    const out = [];
    for (const art of document.querySelectorAll('[aria-hidden="true"] svg, [aria-hidden] svg')) {
      const section = art.closest('div')?.parentElement;
      if (!section) continue;

      const nodes = [...art.querySelectorAll('rect, circle')].filter((n) => {
        const f = n.getAttribute('fill');
        return f && f !== 'none';
      });
      const type = [...section.querySelectorAll('h1, h2, h3')];

      for (const t of type) {
        const a = t.getBoundingClientRect();
        if (a.width === 0) continue;
        for (const n of nodes) {
          const b = n.getBoundingClientRect();
          const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const hh = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (w <= 2 || hh <= 2) continue;
          const covered = (w * hh) / (a.width * a.height);
          if (covered > 0.06) {
            out.push({
              text: t.textContent?.slice(0, 52) ?? '',
              covered: Math.round(covered * 100),
              node: `${n.tagName} ${Math.round(b.width)}x${Math.round(b.height)}`,
            });
          }
        }
      }
    }
    return out;
  });

  for (const f of found) hits.push({ route: name, ...f });
  await page.close();
}

await browser.close();

if (hits.length === 0) {
  console.log('no art/type collisions');
} else {
  console.log(`${String(hits.length)} art node(s) painted over a heading:\n`);
  for (const h of hits) {
    console.log(`  ${h.route.padEnd(11)} ${String(h.covered).padStart(3)}%  ${h.node.padEnd(16)} "${h.text}"`);
  }
}
