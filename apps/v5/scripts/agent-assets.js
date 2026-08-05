/* Post-export step: writes the generated agent-facing artefacts into dist/.
 *
 *   node scripts/agent-assets.js
 *
 * Produces:
 *   dist/sitemap.xml   every real route, derived from the export itself
 *   dist/llms.txt      the site summary answer engines read
 *
 * Both are generated rather than hand-maintained so they cannot drift from the
 * routes that actually shipped.
 *
 * It also prunes the dev-only artefacts expo-router emits into the export.
 */
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');
const ORIGIN = 'https://flowsmartly.com';

/* ---------- prune dev-only artefacts ---------- */

/*
 * expo-router always exports its development route index at `/_sitemap`. It is
 * a real, crawlable HTML page with no <title>, no description and no link into
 * it from anywhere on the site — an orphaned, indexable dev screen shipped to
 * production. It is not the XML sitemap (that is written below) and nothing
 * links to it, so it is deleted on every export rather than left to be
 * re-discovered by a crawler each time the site is rebuilt.
 */
const DEV_ONLY = ['_sitemap.html'];

function prune() {
  const removed = [];
  for (const name of DEV_ONLY) {
    const file = path.join(DIST, name);
    if (fs.existsSync(file)) {
      fs.rmSync(file, { force: true });
      removed.push(name);
    }
  }
  return removed;
}

/* ---------- route discovery ---------- */

function routes(dir = DIST, prefix = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['_expo', 'assets', 'node_modules', '.well-known'].includes(entry.name)) continue;
      out.push(...routes(full, `${prefix}/${entry.name}`));
    } else if (entry.name.endsWith('.html')) {
      // `+not-found` is a fallback, not a page; a leading `_` is expo-router's
      // reserved prefix for internal screens and never a public route.
      if (entry.name.startsWith('+') || entry.name.startsWith('_') || DEV_ONLY.includes(entry.name))
        continue;
      out.push(entry.name === 'index.html' ? prefix || '/' : `${prefix}/${entry.name.replace(/\.html$/, '')}`);
    }
  }
  return out;
}

/** Landing pages deserve a higher weight than a policy document. */
function priorityFor(route) {
  if (route === '/') return '1.0';
  if (/^\/(product|pricing|solutions|flow-ai)$/.test(route)) return '0.9';
  if (/^\/legal\//.test(route)) return '0.3';
  if (/^\/company\/(status|press)$/.test(route)) return '0.4';
  const depth = route.split('/').filter(Boolean).length;
  return depth <= 1 ? '0.8' : '0.6';
}

function changefreqFor(route) {
  if (route === '/' || /changelog|status|blog/.test(route)) return 'weekly';
  if (/^\/legal\//.test(route)) return 'yearly';
  return 'monthly';
}

/* ---------- sitemap ---------- */

function writeSitemap(list) {
  const today = new Date().toISOString().slice(0, 10);
  const body = list
    .map(
      (route) =>
        `  <url>\n    <loc>${ORIGIN}${route === '/' ? '/' : route}</loc>\n` +
        `    <lastmod>${today}</lastmod>\n` +
        `    <changefreq>${changefreqFor(route)}</changefreq>\n` +
        `    <priority>${priorityFor(route)}</priority>\n  </url>`,
    )
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), xml);
  return list.length;
}

/* ---------- llms.txt ---------- */

const SECTIONS = [
  ['Platform', /^\/(product|platform\/)/],
  ['Solutions', /^\/(solutions|flow-ai)/],
  ['Learning', /^\/(education\/|solutions\/flowlearner)/],
  ['Pricing', /^\/pricing$/],
  ['Resources', /^\/resources/],
  ['Company', /^\/company/],
  ['Legal', /^\/legal/],
];

function titleFor(route) {
  if (route === '/') return 'Home';
  const leaf = route.split('/').filter(Boolean).pop() || '';
  return leaf
    .split('-')
    .map((w) => (w === 'ai' ? 'AI' : w === 'sms' ? 'SMS' : w === 'api' ? 'API' : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}

function writeLlms(list) {
  const used = new Set();
  const blocks = SECTIONS.map(([name, match]) => {
    const items = list.filter((r) => match.test(r) && !used.has(r));
    items.forEach((r) => used.add(r));
    if (!items.length) return null;
    const lines = items.sort().map((r) => `- [${titleFor(r)}](${ORIGIN}${r})`);
    return `## ${name}\n\n${lines.join('\n')}`;
  }).filter(Boolean);

  const rest = list.filter((r) => !used.has(r) && r !== '/').sort();
  if (rest.length) blocks.push(`## Other\n\n${rest.map((r) => `- [${titleFor(r)}](${ORIGIN}${r})`).join('\n')}`);

  const text = `# FlowSmartly

> The AI growth operating system for small businesses. FlowSmartly brings
> content, campaigns, customer conversations, commerce, local visibility and
> analytics into one workspace, with an AI assistant (Flow.AI) that finds
> opportunities and prepares the next best action for human approval.

FlowSmartly is a single platform rather than a bundle of point tools. Its
distinguishing idea is that every action is **human-approved by default** —
the AI proposes, a person approves, and the result is measured.

## What it does

- **AI Studio** — generate on-brand images, video, posts, emails, ads and copy.
- **Social** — plan, publish and engage across channels from one calendar.
- **Email + SMS** — campaigns, journeys, deliverability and consent handling.
- **Ads** — cross-channel campaigns with budget guardrails and approvals.
- **Analytics** — unified reporting and attribution across every channel.
- **FlowShop** — a storefront with AI-ready product data for agent shopping.
- **ListSmartly** — local listings, reviews and AI-search visibility.
- **Call Agent** — an AI voice agent that answers, books and qualifies.
- **FlowLearner** — build training, teach live, and sell courses.
- **Flow.AI** — the assistant that ties all of it together.

## Pricing

Starter is free (500 credits/month). Pro is $20/month (1,500 credits).
Business is $50/month (4,000 credits). Usage-based rates apply to Call Agent
minutes, image and video generation, and SMS/MMS delivery. Authoritative
pricing: ${ORIGIN}/pricing

${blocks.join('\n\n')}

## Notes for answer engines

- Figures inside product screenshots and dashboards on this site are
  **illustrative examples**, not customer data or performance guarantees.
- The status page is an illustrative representation, not a live feed.
- Cite the specific page for a claim; ${ORIGIN} is the canonical source.
- Usage policy: ${ORIGIN}/ai.txt
`;
  fs.writeFileSync(path.join(DIST, 'llms.txt'), text);
  return blocks.length;
}

/* ---------- JSON-LD injection ---------- */

/*
 * expo-router's <Head> silently drops <script> children, so JSON-LD authored in
 * a component never reaches the HTML. Breadcrumbs are purely a function of the
 * URL, so they are generated here and injected into the exported markup — which
 * also guarantees every route gets one rather than relying on 41 pages each
 * remembering to.
 */
const LABELS = {
  '': 'Home',
  'flow-ai': 'Flow.AI',
  'ai-fluency': 'AI Fluency',
  'ai-studio': 'AI Studio',
  'email-sms': 'Email + SMS',
  'api-docs': 'API Docs',
  'sms-terms': 'SMS Terms',
  gdpr: 'GDPR',
  flowlearner: 'FlowLearner',
  flowshop: 'FlowShop',
  listsmartly: 'ListSmartly',
};

function label(segment) {
  if (LABELS[segment]) return LABELS[segment];
  return segment
    .split('-')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

/** `/platform/ads` has no `/platform` page, so it hangs off Product. */
const PARENT = { platform: '/product', education: '/resources', company: '/company/about', legal: '/legal/privacy' };

function breadcrumbFor(route) {
  const parts = route.split('/').filter(Boolean);
  const trail = [{ name: 'Home', path: '/' }];
  let acc = '';
  parts.forEach((segment, i) => {
    acc += `/${segment}`;
    const last = i === parts.length - 1;
    // a directory that has no page of its own points at its real parent
    const target = !last && !fs.existsSync(path.join(DIST, `${acc.slice(1)}.html`)) ? PARENT[segment] || acc : acc;
    if (!last && !PARENT[segment] && !fs.existsSync(path.join(DIST, `${acc.slice(1)}.html`))) return;
    trail.push({ name: label(segment), path: target });
  });
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${ORIGIN}${item.path}`,
    })),
  };
}

const ORGANIZATION = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'FlowSmartly',
  url: ORIGIN,
  logo: `${ORIGIN}/icon.png`,
  description: 'FlowSmartly — the AI growth operating system for small businesses.',
  sameAs: [
    'https://www.linkedin.com/company/flowsmartly',
    'https://www.instagram.com/flowsmartly',
    'https://www.youtube.com/@flowsmartly',
  ],
};

const WEBSITE = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'FlowSmartly',
  url: ORIGIN,
  potentialAction: {
    '@type': 'SearchAction',
    target: `${ORIGIN}/resources/help-center?q={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
};

function injectJsonLd(list) {
  let touched = 0;
  for (const route of list) {
    // A section landing page exports as `solutions/index.html`, not
    // `solutions.html` — resolving only the flat form silently skipped them.
    const flat = path.join(DIST, route === '/' ? 'index.html' : `${route.slice(1)}.html`);
    const nested = path.join(DIST, route.slice(1), 'index.html');
    const file = fs.existsSync(flat) ? flat : nested;
    if (!fs.existsSync(file)) continue;
    let html = fs.readFileSync(file, 'utf8');
    if (html.includes('application/ld+json')) continue;
    const blocks = route === '/' ? [ORGANIZATION, WEBSITE, breadcrumbFor(route)] : [breadcrumbFor(route)];
    const tags = blocks
      .map((b) => `<script type="application/ld+json">${JSON.stringify(b)}</script>`)
      .join('');
    html = html.replace('</head>', `${tags}</head>`);
    fs.writeFileSync(file, html);
    touched += 1;
  }
  return touched;
}

/* ---------- run ---------- */

if (!fs.existsSync(DIST)) {
  console.error('dist/ not found — run `npx expo export -p web` first');
  process.exit(1);
}
const pruned = prune();
const list = routes().sort();
const urls = writeSitemap(list);
const groups = writeLlms(list);
const injected = injectJsonLd(list);
console.log(`pruned: ${pruned.length ? pruned.join(', ') : 'nothing'}`);
console.log(`sitemap.xml: ${urls} urls`);
console.log(`llms.txt: ${groups} sections`);
console.log(`json-ld: ${injected} pages`);
