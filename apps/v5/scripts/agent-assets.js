/* global __dirname */
/* Post-export step: writes the generated agent-facing artefacts into dist/.
 *
 *   node scripts/agent-assets.js
 *
 * Produces:
 *   dist/sitemap.xml   indexable pages present in the static export
 *   dist/llms.txt      the site summary answer engines read
 *   dist/feed.xml      RSS for the blog, from the same index the site renders
 *
 * All three are generated rather than hand-maintained so they cannot drift from
 * what actually shipped.
 *
 * It also prunes the dev-only artefacts expo-router emits into the export.
 */
const fs = require('fs');
const path = require('path');
const { ORIGIN, exportedPages } = require('./public-pages.cjs');
// Node22.18+ strips this public-only TypeScript module; same facts as rendered pricing.
const { BILLING_OFFERS } = require('../src/content/billing-offers.ts');
const PRODUCT_FACTS = require('../src/content/product-facts.json');

const DIST = path.join(__dirname, '..', 'dist');
const BLOG_BASE = '/resources/blog';

/**
 * Published posts, written by `scripts/build-content.js` from the same markdown
 * the site renders. Absent before the first content build, which is not an
 * error — the site simply has no blog yet.
 */
function loadPosts() {
  const file = path.join(__dirname, '..', 'src', 'content', 'posts.index.json');
  if (!fs.existsSync(file)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    console.warn('agent-assets: posts.index.json is unreadable — feed and blog section skipped');
    return [];
  }
}

const POSTS = loadPosts();
const POST_BY_ROUTE = new Map(POSTS.map((post) => [`${BLOG_BASE}/${post.slug}`, post]));

/** RSS dates are RFC 822; posts carry a plain date, so noon UTC avoids a
 *  timezone rounding the published day backwards for readers west of it. */
function rfc822(iso) {
  return new Date(`${iso}T12:00:00Z`).toUTCString();
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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

/**
 * A dynamic route also leaves its unresolved shell behind.
 *
 * `generateStaticParams` writes one real file per post *and* expo-router still
 * emits the template itself as `[slug].html` — a page with the site chrome, no
 * article, and the "that post does not exist" branch rendered into it. It is
 * indexable, it was being listed in the sitemap as
 * `/resources/blog/[slug]`, and it is exactly the orphan `_sitemap.html` was
 * deleted for. Matching on the bracket rather than on one filename means the
 * next dynamic route is covered without anyone remembering to add it.
 */
function isRouteTemplate(name) {
  return name.endsWith('.html') && name.includes('[');
}

function prune() {
  const removed = [];
  for (const name of DEV_ONLY) {
    const file = path.join(DIST, name);
    if (fs.existsSync(file)) {
      fs.rmSync(file, { force: true });
      removed.push(name);
    }
  }
  const walk = (dir, prefix = '') => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name !== '_expo' && entry.name !== 'assets') {
          walk(path.join(dir, entry.name), `${prefix}/${entry.name}`);
        }
      } else if (isRouteTemplate(entry.name)) {
        fs.rmSync(path.join(dir, entry.name), { force: true });
        removed.push(`${prefix}/${entry.name}`);
      }
    }
  };
  walk(DIST);
  return removed;
}

/* ---------- sitemap ---------- */

function writeSitemap(list) {
  const body = list.map((route) => {
    // Published posts carry an editorial date. Static pages without a reliable
    // content revision date omit lastmod.
    const post = POST_BY_ROUTE.get(route);
    const lastmod = post ? `\n    <lastmod>${escapeXml(post.updated || post.date)}</lastmod>` : '';
    return `  <url>\n    <loc>${escapeXml(ORIGIN + route)}</loc>${lastmod}\n  </url>`;
  }).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), xml);
  return list.length;
}

/* ---------- llms.txt ---------- */

const SECTIONS = [
  ['Platform', /^\/(product|platform\/)/],
  ['Solutions', /^\/solutions/],
  ['Learning', /^\/(education\/|solutions\/flowlearner)/],
  ['Pricing', /^\/pricing$/],
  ['Resources', /^\/(resources|news)/],
  ['Company', /^\/company/],
  ['Legal', /^\/legal/],
];

function titleFor(route) {
  if (route === '/') return 'Home';
  const leaf = route.split('/').filter(Boolean).pop() || '';
  // Product names are not title-cased slugs. `flowagent` must not become
  // "Flowagent", so the shared LABELS map wins before any transformation.
  if (LABELS[leaf]) return LABELS[leaf];
  return leaf
    .split('-')
    .map((w) => (w === 'ai' ? 'AI' : w === 'sms' ? 'SMS' : w === 'api' ? 'API' : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}

/**
 * The blog gets its own section, written from the post index rather than from
 * route names.
 *
 * A slug turned back into title case gives an assistant "We Deleted Our Own
 * Numbers" and nothing else. The post's real title and its one-sentence
 * description are what let it decide whether the piece answers the question in
 * front of it — which is the entire job of this file.
 */
function blogSection(posts) {
  if (!posts.length) return null;
  const lines = posts.map(
    (post) =>
      `- [${post.title}](${ORIGIN}${BLOG_BASE}/${post.slug}) — ${post.description} ` +
      `(${post.topic}, published ${post.date})`,
  );
  return `## Blog\n\nWriting from the team building FlowSmartly. Full archive: ${ORIGIN}${BLOG_BASE}\nFeed: ${ORIGIN}/feed.xml\n\n${lines.join('\n')}`;
}

function writeLlms(list, posts) {
  // Post routes are described by `blogSection()`; without this they would also
  // be listed under Resources as bare slugs, twice, with no summary.
  const used = new Set(POST_BY_ROUTE.keys());
  const blocks = SECTIONS.map(([name, match]) => {
    const items = list.filter((r) => match.test(r) && !used.has(r));
    items.forEach((r) => used.add(r));
    if (!items.length) return null;
    const lines = items.sort().map((r) => `- [${titleFor(r)}](${ORIGIN}${r})`);
    return `## ${name}\n\n${lines.join('\n')}`;
  }).filter(Boolean);

  const rest = list.filter((r) => !used.has(r) && r !== '/').sort();
  if (rest.length) blocks.push(`## Other\n\n${rest.map((r) => `- [${titleFor(r)}](${ORIGIN}${r})`).join('\n')}`);

  const blog = blogSection(posts);
  if (blog) blocks.push(blog);

  const capabilities = PRODUCT_FACTS.capabilities
    .map(({ name, description }) => `- **${name}** — ${description}`)
    .join('\n');
  const answers = PRODUCT_FACTS.questions
    .map(({ question, answer }) => `### ${question}\n\n${answer}`)
    .join('\n\n');
  const text = `# FlowSmartly

> ${PRODUCT_FACTS.overview.answer}

## What it does

${capabilities}

## Questions about FlowSmartly

${answers}

See ${ORIGIN}/product for these answers and links to the relevant public pages.

## Pricing

${BILLING_OFFERS.map((offer) => `${offer.name}: $${offer.monthlyAmountMinor / 100}/month, ${offer.monthlyIncludedCredits} included credits each month${offer.yearlyAmountMinor === 0 ? '' : `; $${offer.yearlyAmountMinor / 100}/year billed yearly`}.`).join('\n')}
Included credits reset monthly; purchased credits carry over. Governed actions are quoted in credits. Authoritative
pricing: ${ORIGIN}/pricing

${blocks.join('\n\n')}

## Notes for answer engines

- Figures inside product screenshots and dashboards on this site are
  **illustrative examples**, not customer data or performance guarantees.
- Service support information: ${ORIGIN}/company/status.
- Cite the specific page for a claim; ${ORIGIN} is the canonical source.
- Usage policy: ${ORIGIN}/ai.txt
`;
  fs.writeFileSync(path.join(DIST, 'llms.txt'), text);
  return blocks.length;
}

/* ---------- feed ---------- */

/**
 * RSS 2.0, because it is what aggregators, readers, syndication bots and every
 * "new post" automation still speak. It carries the description rather than the
 * full body on purpose: a feed that ships the whole article invites scrapers to
 * republish it verbatim, which `ai.txt` explicitly denies.
 */
function writeFeed(posts) {
  if (!posts.length) {
    fs.rmSync(path.join(DIST, 'feed.xml'), { force: true });
    return 0;
  }
  const items = posts.map((post) => {
    const url = escapeXml(`${ORIGIN}${BLOG_BASE}/${post.slug}`);
    return (
      `    <item>\n` +
      `      <title>${escapeXml(post.title)}</title>\n` +
      `      <link>${url}</link>\n` +
      `      <guid isPermaLink="true">${url}</guid>\n` +
      `      <description>${escapeXml(post.description)}</description>\n` +
      `      <category>${escapeXml(post.topic)}</category>\n` +
      `      <pubDate>${rfc822(post.date)}</pubDate>\n` +
      `    </item>`
    );
  }).join('\n');

  const lastRevision = posts.map((post) => post.updated || post.date).sort().at(-1);
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n` +
    `  <channel>\n` +
    `    <title>FlowSmartly Blog</title>\n` +
    `    <link>${ORIGIN}${BLOG_BASE}</link>\n` +
    `    <description>Notes from building FlowSmartly — the decisions, the things that broke, and the practices that came out of fixing them.</description>\n` +
    `    <language>en-us</language>\n` +
    `    <lastBuildDate>${rfc822(lastRevision)}</lastBuildDate>\n` +
    `    <atom:link href="${ORIGIN}/feed.xml" rel="self" type="application/rss+xml"/>\n` +
    `${items}\n` +
    `  </channel>\n` +
    `</rss>\n`;
  fs.writeFileSync(path.join(DIST, 'feed.xml'), xml);
  return posts.length;
}

/* ---------- JSON-LD injection ---------- */

/* The export preserves page-authored schemas. Fill in missing public product,
 * article and breadcrumb schemas from the same facts used by the site. */
const LABELS = {
  '': 'Home',
  flowagent: 'FlowAgent',
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

function breadcrumbFor(route, indexRoutes) {
  const parts = route.split('/').filter(Boolean);
  const trail = [{ name: 'Home', path: '/' }];
  let acc = '';
  for (const segment of parts) {
    acc += `/${segment}`;
    // `/platform` is a route group. Its actual overview is `/product`.
    const target = acc === '/platform' ? '/product' : acc;
    if (!indexRoutes.has(target)) continue;
    trail.push({ name: POST_BY_ROUTE.get(target)?.title || label(target.split('/').at(-1)), path: target });
  }
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
  description: PRODUCT_FACTS.overview.answer,
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

/**
 * The product itself, as an entity a search or answer engine can resolve.
 *
 * The site shipped with BreadcrumbList and nothing else, so nothing on it said
 * *what FlowSmartly is* in a form a machine reads. `SoftwareApplication` with
 * the real plan prices is that statement, and the prices come from the same
 * page a visitor sees.
 *
 * No `aggregateRating`: there are no collected reviews to aggregate, and
 * inventing one is exactly the kind of markup that earns a manual action.
 */
const PLAN_OFFERS = BILLING_OFFERS.map((offer) => ({
  name: offer.name,
  price: String(offer.monthlyAmountMinor / 100),
  description: `${offer.monthlyIncludedCredits} included credits each month. Purchased credits carry over.`,
}));

const SOFTWARE = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'FlowSmartly',
  applicationCategory: 'BusinessApplication',
  applicationSubCategory: 'AI Business Operating System',
  operatingSystem: 'Web',
  url: ORIGIN,
  description: PRODUCT_FACTS.overview.answer,
  featureList: PRODUCT_FACTS.capabilities.map(({ name, description }) => `${name} — ${description}`),
  publisher: { '@type': 'Organization', name: 'FlowSmartly', url: ORIGIN },
  offers: {
    '@type': 'AggregateOffer',
    priceCurrency: 'USD',
    lowPrice: String(Math.min(...PLAN_OFFERS.map(({ price }) => Number(price)))),
    highPrice: String(Math.max(...PLAN_OFFERS.map(({ price }) => Number(price)))),
    offerCount: PLAN_OFFERS.length,
    url: `${ORIGIN}/pricing`,
    offers: PLAN_OFFERS.map((plan) => ({
      '@type': 'Offer',
      name: plan.name,
      price: plan.price,
      priceCurrency: 'USD',
      description: plan.description,
      url: `${ORIGIN}/pricing`,
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: plan.price,
        priceCurrency: 'USD',
        unitCode: 'MON',
      },
    })),
  },
};

/* Use the rendered pricing facts if an export omits its FAQ markup. */
function faqPage() {
  const items = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'src', 'content', 'pricing-faq.json'), 'utf8'),
  );
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}

/** Extra blocks a specific route carries on top of its breadcrumb. */
function extrasFor(route) {
  if (route === '/') return [ORGANIZATION, WEBSITE, SOFTWARE];
  if (route === '/product') return [SOFTWARE];
  if (route === '/pricing') return [SOFTWARE, faqPage()];
  const post = POST_BY_ROUTE.get(route);
  if (post) {
    return [{
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.description,
      url: ORIGIN + route,
      mainEntityOfPage: { '@type': 'WebPage', '@id': ORIGIN + route },
      datePublished: post.date,
      ...(post.updated ? { dateModified: post.updated } : {}),
      articleSection: post.topic,
      author: post.author ? { '@type': 'Person', name: post.author } : { '@type': 'Organization', name: 'FlowSmartly' },
      publisher: { '@type': 'Organization', name: 'FlowSmartly', url: ORIGIN },
    }];
  }
  return [];
}

function existingJsonLdTypes(html) {
  const types = new Set();
  function collect(node) {
    if (Array.isArray(node)) {
      node.forEach(collect);
    } else if (node && typeof node === 'object') {
      for (const type of [].concat(node['@type'] || [])) types.add(type);
      collect(node['@graph']);
    }
  }
  for (const [, attributes, source] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (!/\btype\s*=\s*["']application\/ld\+json["']/i.test(attributes)) continue;
    try {
      collect(JSON.parse(source));
    } catch {
      // Report invalid authored JSON-LD in the export validator.
    }
  }
  return types;
}

function injectJsonLd(pages, indexRoutes) {
  let touched = 0;
  for (const { route, file, html } of pages) {
    // BreadcrumbList requires at least two entries. Home carries entity data.
    const blocks = route === '/' ? extrasFor(route) : [...extrasFor(route), breadcrumbFor(route, indexRoutes)];
    const types = existingJsonLdTypes(html);
    const tags = blocks.filter((block) => !types.has(block['@type']))
      .map((b) => `<script type="application/ld+json">${JSON.stringify(b).replace(/</g, '\\u003c')}</script>`)
      .join('');
    if (!tags) continue;
    fs.writeFileSync(file, html.replace('</head>', `${tags}</head>`));
    touched += 1;
  }
  return touched;
}

/* ---------- redirects ---------- */

/**
 * Routes that moved. A static export cannot issue a 301 by itself, so this
 * emits a stub that (a) tells crawlers the canonical location via
 * `rel=canonical` and a robots `noindex`, and (b) moves a human immediately.
 *
 * **The real 301 belongs in the web server** — the stub is the belt, not the
 * braces. For nginx:
 *
 *     location = /flow-ai { return 301 /platform/flowagent$is_args$args; }
 *
 * Without the server rule the old URL still resolves, which is fine for
 * bookmarks and shared previews but does not consolidate ranking signals.
 */
const MOVED = [{ from: '/flow-ai', to: '/platform/flowagent', why: 'Flow.AI renamed to FlowAgent' }];

function writeRedirects() {
  for (const { from, to, why } of MOVED) {
    const dir = path.join(DIST, from.slice(1));
    fs.mkdirSync(dir, { recursive: true });
    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Moved to ${to}</title>
<link rel="canonical" href="${ORIGIN}${to}">
<meta name="robots" content="noindex, follow">
<meta http-equiv="refresh" content="0; url=${to}">
<script>location.replace(${JSON.stringify(to)} + location.search + location.hash);</script>
</head>
<body><p>This page moved to <a href="${to}">${ORIGIN}${to}</a>. ${why}.</p></body>
</html>
`;
    fs.writeFileSync(path.join(dir, 'index.html'), html);
  }
  return MOVED.length;
}

/* ---------- run ---------- */

if (!fs.existsSync(DIST)) {
  console.error('dist/ not found — run `npx expo export -p web` first');
  process.exit(1);
}
const pruned = prune();
// Redirect stubs are written first, then excluded from every generated index —
// a moved URL must not be advertised in the sitemap it redirects away from.
const redirects = writeRedirects();
const pages = exportedPages(DIST).filter((page) => page.indexable);
const list = pages.map((page) => page.route);
const indexRoutes = new Set(list);
const posts = POSTS.filter((post) => indexRoutes.has(`${BLOG_BASE}/${post.slug}`));
const urls = writeSitemap(list);
const groups = writeLlms(list, posts);
const feed = writeFeed(posts);
const injected = injectJsonLd(pages, indexRoutes);
console.log(`pruned: ${pruned.length ? pruned.join(', ') : 'nothing'}`);
console.log(`redirects: ${redirects}`);
console.log(`sitemap.xml: ${urls} urls`);
console.log(`llms.txt: ${groups} sections`);
console.log(`feed.xml: ${feed} posts`);
console.log(`json-ld: ${injected} pages`);
