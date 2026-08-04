/* Scores the exported site the way an answer engine would read it, and fails
 * on anything that is a safety problem rather than a quality one.
 *
 *   node scripts/agent-readiness.js            # score dist/
 *   node scripts/agent-readiness.js --strict   # exit 1 if any GUARD fails
 *
 * Two separate ideas, deliberately kept apart:
 *   SCORE  — how legible the site is to an agent (0-100, weighted)
 *   GUARDS — hard safety rules. A guard failure is never "just a lower score".
 */
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');
const STRICT = process.argv.includes('--strict');

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function htmlFiles(dir = DIST, prefix = '') {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['_expo', 'assets', 'node_modules', '.well-known'].includes(e.name)) continue;
      out.push(...htmlFiles(full, `${prefix}/${e.name}`));
    } else if (e.name.endsWith('.html') && e.name !== '_sitemap.html') {
      out.push({
        route: e.name === 'index.html' ? prefix || '/' : `${prefix}/${e.name.replace(/\.html$/, '')}`,
        file: full,
        isNotFound: e.name.startsWith('+'),
      });
    }
  }
  return out;
}

const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);
// The exporter injects `data-rh="true"` as the FIRST attribute, so every
// matcher here has to be attribute-order agnostic. Anchoring on `<meta name=`
// silently scores a perfectly tagged page as zero.
const has = (html, re) => re.test(html);
const attr = (html, re) => {
  const m = re.exec(html);
  return m ? m[1] : null;
};
const jsonLdBlocks = (html) =>
  [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => {
      try {
        return JSON.parse(m[1]);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

/* ------------------------------------------------------------------ */
/* checks                                                              */
/* ------------------------------------------------------------------ */

const pages = htmlFiles().filter((p) => !p.isNotFound);
const notFound = htmlFiles().filter((p) => p.isNotFound);

if (!pages.length) {
  console.error('dist/ has no pages — run `npx expo export -p web` first');
  process.exit(1);
}

const perPage = pages.map(({ route, file }) => {
  const html = read(file) || '';
  const ld = jsonLdBlocks(html);
  const description = attr(html, /<meta [^>]*name="description"[^>]*content="([^"]*)"/);
  return {
    route,
    html,
    title: attr(html, /<title[^>]*>([^<]*)<\/title>/),
    description,
    descriptionLength: description ? description.length : 0,
    canonical: attr(html, /<link [^>]*rel="canonical"[^>]*href="([^"]*)"/),
    ogTitle: has(html, /property="og:title"/),
    ogImage: has(html, /property="og:image"/),
    twitter: has(html, /name="twitter:card"/),
    robots: attr(html, /<meta [^>]*name="robots"[^>]*content="([^"]*)"/),
    lang: attr(html, /<html[^>]*lang="([^"]*)"/),
    jsonLd: ld,
    // `role="heading" aria-level={1}` on a react-native-web Text really does
    // emit an <h1> carrying the aria attribute — counting both double-counts
    // the same element and reports a correct page as having two H1s.
    h1: (html.match(/<h1[\s>]/g) || []).length || (html.match(/aria-level="1"/g) || []).length,
    // the rendered text an agent without JS would actually see
    textLength: html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length,
  };
});

const site = {
  robots: read(path.join(DIST, 'robots.txt')),
  sitemap: read(path.join(DIST, 'sitemap.xml')),
  llms: read(path.join(DIST, 'llms.txt')),
  ai: read(path.join(DIST, 'ai.txt')),
  security: read(path.join(DIST, '.well-known', 'security.txt')),
};

const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0);
const count = (fn) => perPage.filter(fn).length;

const metrics = [
  { key: 'Unique titles', weight: 10, value: pct(new Set(perPage.map((p) => p.title)).size, perPage.length) },
  { key: 'Descriptions (50-165 chars)', weight: 10, value: pct(count((p) => p.descriptionLength >= 50 && p.descriptionLength <= 165), perPage.length) },
  { key: 'Canonical URL', weight: 10, value: pct(count((p) => !!p.canonical), perPage.length) },
  { key: 'Open Graph', weight: 8, value: pct(count((p) => p.ogTitle && p.ogImage), perPage.length) },
  { key: 'Twitter card', weight: 4, value: pct(count((p) => p.twitter), perPage.length) },
  { key: 'JSON-LD present', weight: 16, value: pct(count((p) => p.jsonLd.length > 0), perPage.length) },
  { key: 'Exactly one H1', weight: 8, value: pct(count((p) => p.h1 === 1), perPage.length) },
  { key: 'Server-rendered text (>1200 chars)', weight: 14, value: pct(count((p) => p.textLength > 1200), perPage.length) },
  { key: 'html lang', weight: 4, value: pct(count((p) => !!p.lang), perPage.length) },
  { key: 'robots.txt', weight: 4, value: site.robots ? 100 : 0 },
  { key: 'sitemap.xml', weight: 5, value: site.sitemap ? 100 : 0 },
  { key: 'llms.txt', weight: 4, value: site.llms ? 100 : 0 },
  { key: 'ai.txt policy', weight: 3, value: site.ai ? 100 : 0 },
];

const totalWeight = metrics.reduce((n, m) => n + m.weight, 0);
const score = Math.round(metrics.reduce((n, m) => n + (m.value / 100) * m.weight, 0) / totalWeight * 100);

/* ------------------------------------------------------------------ */
/* safety guards — a failure here is not a score, it is a defect        */
/* ------------------------------------------------------------------ */

const guards = [];
const guard = (name, ok, detail) => guards.push({ name, ok, detail });

guard('404 is noindex', notFound.every((p) => /noindex/.test(read(p.file) || '')),
  'the not-found page must never be indexed');

guard('No page is accidentally noindex', !perPage.some((p) => p.robots && /noindex/.test(p.robots)),
  perPage.filter((p) => p.robots && /noindex/.test(p.robots)).map((p) => p.route).join(', ') || 'none');

guard('Canonical points at the production origin',
  perPage.every((p) => !p.canonical || p.canonical.startsWith('https://flowsmartly.com')),
  'no localhost or preview host may leak into a canonical');

guard('robots.txt declares an AI policy',
  !!site.robots && /GPTBot|ClaudeBot|PerplexityBot/.test(site.robots),
  'answer-engine crawlers must be addressed explicitly, not left to the wildcard');

guard('robots.txt references the sitemap', !!site.robots && /Sitemap:/i.test(site.robots), '');

guard('security.txt present and not expired',
  !!site.security && (() => {
    const m = /Expires:\s*(\S+)/.exec(site.security);
    return !!m && new Date(m[1]).getTime() > Date.now();
  })(),
  'a stale security.txt is worse than none — it misroutes disclosure');

guard('No personal data in structured data',
  !perPage.some((p) => p.jsonLd.some((b) => /"(telephone|email)"\s*:/.test(JSON.stringify(b)) && !/Organization/.test(JSON.stringify(b['@type'] || '')))),
  'JSON-LD must not publish personal contact details');

guard('Illustrative figures are disclosed to agents',
  !!site.ai && /Illustrative-Figures:\s*yes/.test(site.ai),
  'dashboards show example numbers; an answer engine must not repeat them as fact');

guard('Sitemap has no non-production URLs',
  !site.sitemap || !/localhost|127\.0\.0\.1|:8093/.test(site.sitemap), '');

/* ------------------------------------------------------------------ */
/* report                                                              */
/* ------------------------------------------------------------------ */

console.log(`\nAGENT READINESS — ${pages.length} pages\n`);
console.log(`  score  ${score}/100\n`);
metrics.forEach((m) => {
  const bar = '#'.repeat(Math.round(m.value / 5)).padEnd(20, '.');
  console.log(`  ${String(m.value).padStart(3)}%  ${bar}  ${m.key}  (weight ${m.weight})`);
});

console.log('\nSAFETY GUARDS\n');
guards.forEach((g) => console.log(`  ${g.ok ? 'PASS' : 'FAIL'}  ${g.name}${g.ok || !g.detail ? '' : `\n        ${g.detail}`}`));

const weakest = metrics.filter((m) => m.value < 100).sort((a, b) => b.weight * (100 - b.value) - a.weight * (100 - a.value));
if (weakest.length) {
  console.log('\nBIGGEST WINS\n');
  weakest.slice(0, 4).forEach((m) => {
    const offenders = {
      'JSON-LD present': () => perPage.filter((p) => !p.jsonLd.length).map((p) => p.route),
      'Exactly one H1': () => perPage.filter((p) => p.h1 !== 1).map((p) => p.route),
      'Descriptions (50-165 chars)': () => perPage.filter((p) => p.descriptionLength < 50 || p.descriptionLength > 165).map((p) => p.route),
      'Server-rendered text (>1200 chars)': () => perPage.filter((p) => p.textLength <= 1200).map((p) => p.route),
      'Unique titles': () => [],
    }[m.key];
    const list = offenders ? offenders() : [];
    console.log(`  ${m.key} — ${m.value}%${list.length ? `\n    ${list.slice(0, 8).join(', ')}${list.length > 8 ? ` … +${list.length - 8}` : ''}` : ''}`);
  });
}

const failed = guards.filter((g) => !g.ok);
console.log(`\n${failed.length ? `${failed.length} GUARD FAILURE(S)` : 'all guards pass'}\n`);
if (STRICT && failed.length) process.exit(1);
