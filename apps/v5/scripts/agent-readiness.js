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
const { gzipSync } = require('node:zlib');
const { ORIGIN, brokenPublicLinks, exportedPages } = require('./public-pages.cjs');

const DIST = path.join(__dirname, '..', 'dist');
const STRICT = process.argv.includes('--strict');

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

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
    });

/* ------------------------------------------------------------------ */
/* checks                                                              */
/* ------------------------------------------------------------------ */

if (!fs.existsSync(DIST)) {
  console.error('dist/ has no pages — run `npx expo export -p web` first');
  process.exit(1);
}
const exported = exportedPages(DIST);
const pages = exported.filter((page) => page.isPublic);
const indexUrls = new Set(pages.filter((page) => page.indexable).map(({ route }) => ORIGIN + route));

const perPage = pages.map(({ route, html, canonical }) => {
  const ld = jsonLdBlocks(html);
  const description = attr(html, /<meta [^>]*name="description"[^>]*content="([^"]*)"/);
  return {
    route,
    html,
    title: attr(html, /<title[^>]*>([^<]*)<\/title>/),
    description,
    descriptionLength: description ? description.length : 0,
    canonical: canonical.length === 1 ? canonical[0] : null,
    ogTitle: has(html, /property="og:title"/),
    ogImage: has(html, /property="og:image"/),
    twitter: has(html, /name="twitter:card"/),
    lang: attr(html, /<html[^>]*lang="([^"]*)"/),
    jsonLd: ld.filter(Boolean),
    invalidJsonLd: ld.some((block) => !block || typeof block !== 'object'),
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

const pct = (n, total) => (total ? (n / total) * 100 : 0);
const display = (value) => String(Math.floor(value * 10) / 10);
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
const score = metrics.reduce((n, m) => n + m.value * m.weight, 0) / totalWeight;

/* ------------------------------------------------------------------ */
/* safety guards — a failure here is not a score, it is a defect        */
/* ------------------------------------------------------------------ */

const guards = [];
const guard = (name, ok, detail) => guards.push({ name, ok, detail });

const wrongDirectives = exported.filter((page) => (page.isPublic || page.expectedNoindex) && page.noindex !== page.expectedNoindex);
guard('Page indexing directives match their purpose', wrongDirectives.length === 0,
  wrongDirectives.map(({ route, expectedNoindex }) => `${route} needs ${expectedNoindex ? 'noindex' : 'to be indexable'}`).join(', '));

const badRedirects = exported.filter((page) => {
  if (!page.redirect) return false;
  const target = page.redirect.split(/;\s*url\s*=\s*/i).at(-1);
  return page.canonical.length !== 1 || page.canonical[0] !== new URL(target, ORIGIN).href || !indexUrls.has(page.canonical[0]);
});
guard('Redirect stubs point at indexable destinations', badRedirects.length === 0,
  badRedirects.map(({ route }) => route).join(', '));

const wrongCanonicals = perPage.filter(({ canonical, route }) => canonical !== ORIGIN + route);
guard('Public routes have one production self-canonical', wrongCanonicals.length === 0,
  wrongCanonicals.map(({ route, canonical }) => `${route}: ${canonical || 'missing or duplicated'}`).join(', '));

const brokenLinks = brokenPublicLinks(DIST, exported);
guard('Public HTML links resolve within the V5 export or a declared public route', brokenLinks.length === 0, brokenLinks.join(', '));
const missingMetadata = perPage.filter(({ title, description, lang }) => !title || !description || !lang);
guard('Public pages declare their title, description and language', missingMetadata.length === 0,
  missingMetadata.map(({ route }) => route).join(', '));
const invalidSchema = perPage.filter(({ invalidJsonLd }) => invalidJsonLd);
guard('Exported JSON-LD parses as structured data', invalidSchema.length === 0,
  invalidSchema.map(({ route }) => route).join(', '));

const searchBots = ['OAI-SearchBot', 'Claude-SearchBot', 'PerplexityBot'];
guard('robots.txt declares search and retrieval policy',
  searchBots.every((bot) => new RegExp(`^User-agent:\\s*${bot}\\s*$`, 'im').test(site.robots || '')),
  'identify the search crawlers separately from model-use controls');

guard('robots.txt references the public and published news sitemaps',
  ['/sitemap.xml', '/_news/sitemap.xml'].every((route) => (site.robots || '').split(/\r?\n/).includes(`Sitemap: ${ORIGIN}${route}`)), '');

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
guard('The homepage links to account registration before JavaScript',
  /<a\b[^>]*\shref=["']\/register["']/i.test(perPage.find((page) => page.route === '/')?.html || ''),
  'render a document link to the existing V5 registration handler');

const locs = [...(site.sitemap || '').matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => match[1]);
const urlsInSitemap = new Set(locs);
const unexpected = [...urlsInSitemap].filter((url) => !indexUrls.has(url));
const missing = [...indexUrls].filter((url) => !urlsInSitemap.has(url));
guard('Sitemap lists every indexable export exactly once',
  indexUrls.size > 0 && locs.length === urlsInSitemap.size && unexpected.length === 0 && missing.length === 0,
  `Missing: ${missing.join(', ') || 'none'}. Unexpected: ${unexpected.join(', ') || 'none'}. Duplicate count: ${locs.length - urlsInSitemap.size}.`);

// Production-build regression cases for the initial response, independent of
// SEO scoring or simulated network and CPU timings.
const startupBudget = 1.5 * 1024 * 1024;
const startupSizes = new Map();
const startup = perPage.map(({ route, html }) => {
  const sources = new Set([...html.matchAll(/<script\b[^>]*\bsrc="(\/_expo\/static\/js\/[\w/.-]+\.js)"/gi)]
    .map((match) => match[1]));
  const bytes = [...sources].reduce((total, src) => {
    if (!startupSizes.has(src)) {
      const file = path.join(DIST, src);
      startupSizes.set(src, fs.existsSync(file) ? gzipSync(fs.readFileSync(file), { level: 6 }).length : Infinity);
    }
    return total + startupSizes.get(src);
  }, 0);
  return { route, bytes };
});
const largestStartup = [...startup].sort((a, b) => b.bytes - a.bytes)[0];
const incompleteSkipLinks = perPage.filter(({ html }) =>
  !/<a\b[^>]*\bhref="#fs-main"[^>]*>/i.test(html) ||
  !/<main\b(?=[^>]*\bid="fs-main")(?=[^>]*\btabindex="-1")[^>]*>/i.test(html));
const home = perPage.find(({ route }) => route === '/')?.html ?? '';
const webChecks = [
  {
    name: 'Initial first-party JavaScript fits the 1.5 MiB gzip budget',
    ok: Boolean(largestStartup && largestStartup.bytes <= startupBudget),
    detail: largestStartup ? `${largestStartup.bytes.toLocaleString('en-US')} compressed bytes at ${largestStartup.route}` : 'No public routes',
  },
  {
    name: 'Public pages provide a native keyboard skip link to the main landmark',
    ok: incompleteSkipLinks.length === 0,
    detail: incompleteSkipLinks.map(({ route }) => route).join(', '),
  },
  {
    name: 'The homepage hero image is available to the initial browser fetch',
    ok: /<img\b(?=[^>]*\bloading="eager")(?=[^>]*\bfetchpriority="high")(?=[^>]*\bsrc="\/assets\/)[^>]*>/i.test(home),
  },
];

/* ------------------------------------------------------------------ */
/* report                                                              */
/* ------------------------------------------------------------------ */

console.log(`\nAGENT READINESS — ${pages.length} pages\n`);
console.log(`  export score  ${display(score)}/100\n`);
metrics.forEach((m) => {
  const bar = '#'.repeat(Math.round(m.value / 5)).padEnd(20, '.');
  console.log(`  ${display(m.value).padStart(5)}%  ${bar}  ${m.key}  (weight ${m.weight})`);
});

console.log('\nSAFETY GUARDS\n');
guards.forEach((g) => console.log(`  ${g.ok ? 'PASS' : 'FAIL'}  ${g.name}${g.ok || !g.detail ? '' : `\n        ${g.detail}`}`));

console.log('\nWEB QUALITY CHECKS\n');
webChecks.forEach((c) => console.log(`  ${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? `\n        ${c.detail}` : ''}`));

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
    console.log(`  ${m.key} — ${display(m.value)}%${list.length ? `\n    ${list.slice(0, 8).join(', ')}${list.length > 8 ? ` … +${list.length - 8}` : ''}` : ''}`);
  });
}

const failed = guards.filter((g) => !g.ok);
const failedChecks = webChecks.filter((check) => !check.ok);
console.log(`\n${failed.length ? `${failed.length} GUARD FAILURE(S)` : 'all guards pass'}`);
console.log(`${failedChecks.length ? `${failedChecks.length} WEB QUALITY CHECK FAILURE(S)` : 'all web quality checks pass'}\n`);
if (STRICT && (failed.length || failedChecks.length)) process.exit(1);
