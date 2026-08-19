/* Post-export step: writes the generated agent-facing artefacts into dist/.
 *
 *   node scripts/agent-assets.js
 *
 * Produces:
 *   dist/sitemap.xml   every real route, derived from the export itself
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

const DIST = path.join(__dirname, '..', 'dist');
const ORIGIN = 'https://flowsmartly.com';
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
  if (/^\/(product|pricing|solutions|flowagent)$/.test(route)) return '0.9';
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
  // A post's lastmod is the day it was published or last revised, not the day
  // the site happened to be rebuilt. Stamping every URL with today's date tells
  // a crawler the whole archive changed on every deploy, which is how a sitemap
  // stops being believed.
  const lastmodFor = (route) => {
    const post = POST_BY_ROUTE.get(route);
    return post ? post.updated || post.date : today;
  };
  const body = list
    .map(
      (route) =>
        `  <url>\n    <loc>${ORIGIN}${route === '/' ? '/' : route}</loc>\n` +
        `    <lastmod>${lastmodFor(route)}</lastmod>\n` +
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
  ['Solutions', /^\/(solutions|flowagent)/],
  ['Learning', /^\/(education\/|solutions\/flowlearner)/],
  ['Pricing', /^\/pricing$/],
  // The account screens. Without a section of their own they fall into
  // "Other" and `/login/code` is advertised to an assistant as "Code".
  ['Account', /^\/(login|register|check-email)/],
  ['Resources', /^\/resources/],
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
function blogSection() {
  if (!POSTS.length) return null;
  const lines = POSTS.map(
    (post) =>
      `- [${post.title}](${ORIGIN}${BLOG_BASE}/${post.slug}) — ${post.description} ` +
      `(${post.topic}, published ${post.date})`,
  );
  return `## Blog\n\nWriting from the team building FlowSmartly. Full archive: ${ORIGIN}${BLOG_BASE}\nFeed: ${ORIGIN}/feed.xml\n\n${lines.join('\n')}`;
}

function writeLlms(list) {
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

  const blog = blogSection();
  if (blog) blocks.push(blog);

  const text = `# FlowSmartly

> The AI Business Operating System. One intelligent platform to run, connect
> and grow a business: the daily work, the content, the conversations, the
> customers, the sales and the numbers in one place, with an AI partner
> (FlowAgent) that prepares the next action for a person to approve.

FlowSmartly is a single platform rather than a bundle of point tools, and it
is built for real businesses of any kind — services, retail, healthcare,
professional practices, education, hospitality — not for one industry. Its
distinguishing idea is that every action is **human-approved by default**:
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
- **FlowAgent** — the AI business operator that ties all of it together.

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

/* ---------- feed ---------- */

/**
 * RSS 2.0, because it is what aggregators, readers, syndication bots and every
 * "new post" automation still speak. It carries the description rather than the
 * full body on purpose: a feed that ships the whole article invites scrapers to
 * republish it verbatim, which `ai.txt` explicitly denies.
 */
function writeFeed() {
  if (!POSTS.length) return 0;
  const items = POSTS.map((post) => {
    const url = `${ORIGIN}${BLOG_BASE}/${post.slug}`;
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

  const newest = POSTS[0];
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n` +
    `  <channel>\n` +
    `    <title>FlowSmartly Blog</title>\n` +
    `    <link>${ORIGIN}${BLOG_BASE}</link>\n` +
    `    <description>Notes from building FlowSmartly — the decisions, the things that broke, and the practices that came out of fixing them.</description>\n` +
    `    <language>en-us</language>\n` +
    `    <lastBuildDate>${rfc822(newest.updated || newest.date)}</lastBuildDate>\n` +
    `    <atom:link href="${ORIGIN}/feed.xml" rel="self" type="application/rss+xml"/>\n` +
    `${items}\n` +
    `  </channel>\n` +
    `</rss>\n`;
  fs.writeFileSync(path.join(DIST, 'feed.xml'), xml);
  return POSTS.length;
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
  login: 'Sign in',
  register: 'Create your account',
  // `/login/code` — the leaf alone is meaningless out of context.
  code: 'Two-factor code',
  'check-email': 'Check your email',
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
  description: 'FlowSmartly — the AI Business Operating System. One platform to run, connect and grow a business, with every AI action approved by a person.',
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
const PLAN_OFFERS = [
  { name: 'Starter', price: '0', description: '500 credits monthly' },
  { name: 'Pro', price: '20', description: '1,500 credits monthly' },
  { name: 'Business', price: '50', description: '4,000 credits monthly' },
];

const SOFTWARE = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'FlowSmartly',
  applicationCategory: 'BusinessApplication',
  applicationSubCategory: 'AI Business Operating System',
  operatingSystem: 'Web',
  url: ORIGIN,
  description:
    'One intelligent platform to run, connect and grow a business — work, content, conversations, customers, sales and analytics in one place, with every AI action approved by a person.',
  featureList: [
    'AI Studio — images, video, posts, emails, ads and copy',
    'Social — plan, publish and engage from one calendar',
    'Email + SMS — campaigns, journeys, deliverability and consent',
    'Ads — cross-channel campaigns with budget guardrails',
    'Analytics — unified reporting and attribution',
    'FlowShop — storefront with AI-ready product data',
    'ListSmartly — local listings, reviews and AI-search visibility',
    'Call Agent — an AI voice agent that answers, books and qualifies',
    'FlowLearner — build training, teach live, and sell courses',
    'FlowAgent — the AI business operator across all of it',
  ],
  publisher: { '@type': 'Organization', name: 'FlowSmartly', url: ORIGIN },
  offers: {
    '@type': 'AggregateOffer',
    priceCurrency: 'USD',
    lowPrice: '0',
    highPrice: '50',
    offerCount: PLAN_OFFERS.length,
    url: `${ORIGIN}/pricing`,
    offers: PLAN_OFFERS.map((plan) => ({
      '@type': 'Offer',
      name: plan.name,
      price: plan.price,
      priceCurrency: 'USD',
      description: plan.description,
      url: `${ORIGIN}/pricing`,
      availability: 'https://schema.org/InStock',
    })),
  },
};

/*
 * The pricing questions, marked up from the same JSON the page renders — the
 * page authored `faqJsonLd(...)` and it never reached the HTML, because
 * expo-router's <Head> drops <script> children. Reading the shared file keeps
 * the markup and the visible answers identical, which is what Google requires.
 */
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
  return [];
}

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
    const blocks = [...extrasFor(route), breadcrumbFor(route)];
    const tags = blocks
      .map((b) => `<script type="application/ld+json">${JSON.stringify(b)}</script>`)
      .join('');
    html = html.replace('</head>', `${tags}</head>`);
    fs.writeFileSync(file, html);
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
 *     location = /flow-ai { return 301 /flowagent; }
 *
 * Without the server rule the old URL still resolves, which is fine for
 * bookmarks and shared previews but does not consolidate ranking signals.
 */
const MOVED = [{ from: '/flow-ai', to: '/flowagent', why: 'Flow.AI renamed to FlowAgent' }];

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

/** A moved route must never appear in the sitemap or llms.txt. */
function isMoved(route) {
  return MOVED.some((m) => m.from === route);
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
const list = routes().sort().filter((route) => !isMoved(route));
const urls = writeSitemap(list);
const groups = writeLlms(list);
const feed = writeFeed();
const injected = injectJsonLd(list);
console.log(`pruned: ${pruned.length ? pruned.join(', ') : 'nothing'}`);
console.log(`redirects: ${redirects}`);
console.log(`sitemap.xml: ${urls} urls`);
console.log(`llms.txt: ${groups} sections`);
console.log(`feed.xml: ${feed} posts`);
console.log(`json-ld: ${injected} pages`);
