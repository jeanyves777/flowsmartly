// Renders the exported /news in a real browser against the feed shapes the core emits, and
// measures the painted words. Needs `dist/` (npm run build:web) and Playwright + Chromium.
//
//   node scripts/qa-news-render.mjs [--shots <dir>]
//
// Arms:
//   static     no feed answers yet (the HTML as exported, before JS reads the feed)
//   empty      first-party feed with no articles        -> empty state
//   headlines  first-party feed of source_summary items -> headlines, labelled by publisher
//   failed     feed returns 503                         -> "temporarily unavailable" (and only then)
//   article   published customer and first-party indexing after hydration
//   nav        the Resources menu names "FlowSmartly News"
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(process.env.QA_NEWS_DIST ?? path.join(here, '../dist'));
const shotsAt = process.argv.indexOf('--shots');
const shots = shotsAt > 0 ? process.argv[shotsAt + 1] : null;
if (shots) fs.mkdirSync(shots, { recursive: true });

const FORBIDDEN = [/flowagent/i, /original reporting/i, /\banalysis\b/i, /source-grounded/i];
const UNAVAILABLE = /temporarily unavailable/i;
const FIRST_PARTY = {
  kind: 'first_party',
  name: 'FlowSmartly News',
  description: 'Headlines from public sources, each linked to its publisher.',
  author: 'FlowSmartly',
};

function headline(n, publisher, title, category) {
  const link = `https://www.${publisher.toLowerCase().replace(/\W+/g, '')}.example/story-${n}`;
  const excerpt = `${publisher}’s own feed description for story ${n}, capped to a short excerpt.`;
  return {
    id: `p${n}`,
    slug: `headline-${n}`,
    url: `https://flowsmartly.com/news/article?slug=headline-${n}`,
    title,
    excerpt,
    publishedAt: `2026-11-2${n % 3}T1${n}:00:00.000Z`,
    text: `${excerpt}\n\nSource: ${publisher}.`,
    blocks: [
      { key: 'summary', type: 'rich_text', paragraphs: [{ runs: [{ text: excerpt }] }] },
      { key: 'source', type: 'rich_text', paragraphs: [{ runs: [{ text: 'Read the full story at ' }, { text: publisher, href: link }] }] },
    ],
    editorial: {
      storyKey: `story-${n}`,
      category,
      mode: 'source_summary',
      researchedAt: '2026-11-22T12:00:00.000Z',
      sources: [{ url: link, title, publisher, publishedAt: null, retrievedAt: '2026-11-22T12:00:00.000Z' }],
      uncertainty: [],
      corrections: [],
    },
  };
}
const feed = (articles) => ({ version: 'https://jsonfeed.org/version/1.1', title: FIRST_PARTY.name, description: FIRST_PARTY.description, _newsroom: FIRST_PARTY, articles, items: [] });
const HEADLINES = feed([
  headline(1, 'Example Science Wire', 'Telescope survey maps faint galaxies at the edge of the early universe', 'science'),
  headline(2, 'Example Markets Daily', 'Regional banks report steadier deposits in the third quarter', 'banking'),
  headline(3, 'Example Tech Review', 'Chipmakers outline new packaging roadmap for data-centre parts', 'technology'),
  headline(4, 'Example Business Post', 'Small retailers lean on local delivery partnerships this season', 'business'),
]);
const customerOrigin = 'https://merchant.example';
const customerPost = {
  ...HEADLINES.articles[0],
  title: 'Customer fixture with literal </script> text',
  canonicalUrl: `${customerOrigin}/blog/${HEADLINES.articles[0].slug}`,
  editorial: { ...HEADLINES.articles[0].editorial, mode: 'analysis' },
};
const CUSTOMER = {
  ...feed([customerPost]),
  _newsroom: {
    kind: 'flowagent', name: 'FlowAgent News', author: 'FlowAgent · FlowSmartly',
    description: 'Original source-grounded reporting and analysis from FlowAgent.',
    site: { origin: customerOrigin, noIndex: true },
  },
};

// Static server with the export's clean URLs (/news -> news/index.html, /x -> x.html).
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = decodeURIComponent(url.pathname).replace(/\/+$/, '') || '/index';
  for (const candidate of [p, `${p}.html`, `${p}/index.html`]) {
    const file = path.join(dist, candidate);
    if (file.startsWith(dist) && fs.existsSync(file) && fs.statSync(file).isFile()) {
      const ext = path.extname(file);
      const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.ttf': 'font/ttf', '.png': 'image/png', '.svg': 'image/svg+xml' }[ext] ?? 'application/octet-stream';
      res.writeHead(200, { 'content-type': type });
      return fs.createReadStream(file).pipe(res);
    }
  }
  res.writeHead(404).end();
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) failures++;
};

async function words(page) {
  return page.evaluate(() => {
    const meta = (sel) => [...document.querySelectorAll(sel)].map((m) => m.getAttribute('content') ?? '').join(' | ');
    return {
      title: document.title,
      meta: meta('meta[name="description"], meta[property^="og:"], meta[name^="twitter:"]'),
      jsonld: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent).join('\n'),
      main: document.querySelector('main')?.innerText ?? '',
    };
  });
}
function forbiddenIn(w) {
  return Object.entries(w).flatMap(([k, v]) => FORBIDDEN.filter((re) => re.test(v)).map((re) => `${k} ${re}`));
}

const browser = await chromium.launch({ executablePath: process.env.QA_NEWS_CHROMIUM_EXECUTABLE });
const viewports = [
  ['desktop', { viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 }],
  ['phone', { ...devices['iPhone 13'] }],
];
for (const [vpName, ctxOptions] of viewports) {
  for (const arm of ['static', 'empty', 'headlines', 'failed']) {
    const context = await browser.newContext(ctxOptions);
    const page = await context.newPage();
    if (arm === 'static') await page.route('**/_news/feed.json', () => new Promise(() => {}));
    if (arm === 'empty') await page.route('**/_news/feed.json', (r) => r.fulfill({ json: feed([]) }));
    if (arm === 'headlines') await page.route('**/_news/feed.json', (r) => r.fulfill({ json: HEADLINES }));
    if (arm === 'failed') await page.route('**/_news/feed.json', (r) => r.fulfill({ status: 503, body: '' }));
    const name = `${vpName}/${arm}`;
    if (arm === 'static') {
      await page.route('**/*.js', (r) => r.abort());
      await page.goto(`${origin}/news`, { waitUntil: 'load' });
    } else {
      await page.goto(`${origin}/news`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => !/Loading headlines|Loading published reporting/.test(document.querySelector('main')?.innerText ?? ''), null, { timeout: 15000 });
    }
    const w = await words(page);
    const bad = forbiddenIn(w);
    check(bad.length === 0, `${name}: page, meta and JSON-LD never say FlowAgent, original reporting or analysis${bad.length ? ` (found: ${bad.join(', ')})` : ''}`);
    check(/FLOWSMARTLY NEWS/.test(w.main) && /Headlines from public sources, each linked to its publisher\./.test(w.main), `${name}: eyebrow and hero name the first-party newsroom`);
    check(/Headlines from public sources/.test(w.meta), `${name}: meta description is the first-party description`);
    if (arm === 'empty') {
      check(/No headlines have been published yet\./.test(w.main), `${name}: empty feed shows the empty state`);
      check(!UNAVAILABLE.test(w.main), `${name}: empty feed is not "temporarily unavailable"`);
    }
    if (arm === 'headlines') {
      check(/Telescope survey maps faint galaxies/.test(w.main) && /From Example Science Wire/.test(w.main), `${name}: source_summary items render, labelled by publisher`);
      check(!UNAVAILABLE.test(w.main), `${name}: source_summary items do not turn the page "temporarily unavailable"`);
    }
    if (arm === 'failed') check(UNAVAILABLE.test(w.main), `${name}: a failed feed (503) still says temporarily unavailable`);
    await page.getByRole('button', { name: 'Reject optional' }).click({ timeout: 2000 }).catch(() => {});
    if (shots && arm !== 'static') await page.screenshot({ path: path.join(shots, `news-${vpName}-${arm}.png`), fullPage: arm !== 'failed' });
    if (shots && (arm === 'empty' || arm === 'headlines')) {
      // The page scrolls inside a container, so a full-page shot is the top only: scroll the list in.
      await page.getByText(/published articles?$/).first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(shots, `news-${vpName}-${arm}-list.png`) });
    }
    await context.close();
  }
}

for (const [vpName, ctxOptions] of viewports) {
  for (const [name, snapshot, canonical, robots] of [
    ['customer', CUSTOMER, customerPost.canonicalUrl, 'noindex, follow'],
    ['first-party', HEADLINES, HEADLINES.articles[0].url, 'index, follow'],
  ]) {
    const context = await browser.newContext(ctxOptions);
    const page = await context.newPage();
    await page.route('**/_news/feed.json', (route) => route.fulfill({ json: snapshot }));
    await page.goto(`${origin}/news/article?slug=${snapshot.articles[0].slug}`, { waitUntil: 'networkidle' });
    const title = snapshot.articles[0].title;
    await page.getByRole('heading', { name: title }).first().waitFor({ timeout: 15000 });
    const head = await page.evaluate(() => ({
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
      robots: document.querySelector('meta[name="robots"]')?.getAttribute('content'),
      schema: [...document.querySelectorAll('script[type="application/ld+json"]')].map((script) => JSON.parse(script.textContent ?? '{}')).find((data) => data['@type'] === 'NewsArticle'),
    }));
    check(head.canonical === canonical && head.schema?.url === canonical, `${vpName}/${name} article: canonical URL agrees with NewsArticle markup (expected ${canonical}, head ${head.canonical}, schema ${head.schema?.url})`);
    check(head.schema?.headline === title, `${vpName}/${name} article: structured data round-trips the headline`);
    check(head.robots === robots, `${vpName}/${name} article: robots is ${robots}`);
    await context.close();
  }
}

// Nav: the Resources entry, as painted (desktop mega menu; phone drawer). The description
// 'Headlines from public sources' is not painted by either, so news.test.mjs checks it in nav.ts.
for (const [vpName, ctxOptions] of viewports) {
  const context = await browser.newContext(ctxOptions);
  const page = await context.newPage();
  await page.route('**/_news/feed.json', (r) => r.fulfill({ json: HEADLINES }));
  await page.goto(`${origin}/news`, { waitUntil: 'networkidle' });
  if (vpName === 'phone') {
    await page.getByLabel('Open navigation').first().click();
    // On /news the drawer opens with the current section (Resources) already expanded.
    const resources = page.getByRole('button', { name: 'Resources', exact: true });
    if ((await resources.getAttribute('aria-expanded')) !== 'true') await resources.click();
    await page.getByText('FlowSmartly News', { exact: true }).last().waitFor({ timeout: 5000 }).catch(() => {});
  } else {
    // The desktop mega menu opens on pointer-enter; a click would navigate to /resources.
    await page.locator('nav[aria-label="Main"]').getByText('Resources', { exact: true }).hover();
  }
  await page.waitForTimeout(900);
  // Only the painted nav entry: visible links to /news outside <main> and the footer.
  const entries = await page.evaluate(() =>
    [...document.querySelectorAll('a[href="/news"]')]
      .filter((a) => !a.closest('main, footer') && a.getBoundingClientRect().height > 0)
      .map((a) => a.innerText.trim()),
  );
  check(entries.length > 0 && entries.every((t) => /FlowSmartly\s+News/.test(t) && !/FlowAgent/i.test(t)), `${vpName}/nav: the painted news entry reads "FlowSmartly News" (${JSON.stringify(entries)})`);
  const menu = await page.evaluate(() => document.body.innerText);
  check(!/FlowAgent News|Source-grounded news/i.test(menu), `${vpName}/nav: the page never says FlowAgent News or source-grounded news`);
  if (shots) await page.screenshot({ path: path.join(shots, `news-${vpName}-nav.png`) });
  if (vpName === 'phone') {
    const product = page.getByRole('button', { name: 'Product', exact: true });
    if ((await product.getAttribute('aria-expanded')) !== 'true') await product.click();
  } else {
    await page.locator('nav[aria-label="Main"]').getByText('Product', { exact: true }).hover();
  }
  const productEntries = await page.evaluate(() =>
    [...document.querySelectorAll('a[href="/solutions/custom-automation"]')]
      .filter((a) => !a.closest('main, footer') && a.getBoundingClientRect().height > 0)
      .map((a) => a.innerText.trim()),
  );
  check(productEntries.some((text) => /Custom AI Automation/.test(text)), `${vpName}/nav: Product opens with the Custom AI Automation link`);
  await context.close();
}

await browser.close();
server.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
