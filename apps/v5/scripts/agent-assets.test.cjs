/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { brokenPublicLinks, exportedPages } = require('./public-pages.cjs');

test('static link checks find a missing public target and allow portal and published news links', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'public-link-check-'));
  try {
    fs.writeFileSync(path.join(directory, 'index.html'), '<html><body>' +
      '<a href="/product">Product</a><a href="/register">Register</a>' +
      '<a href="/news/article?slug=story">Current story</a><a href="/_news/feed.json">News feed</a>' +
      '<a href="/missing">Invalid target</a><a href="https://example.com">External</a></body></html>');
    fs.writeFileSync(path.join(directory, 'product.html'), '<html><body>Product</body></html>');
    assert.deepEqual(brokenPublicLinks(directory, exportedPages(directory)), ['/ → /missing']);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

for (const templatePath of ['news/article.html', 'news/article/index.html']) {
  test(`indexes omit the slugless template but retain ${templatePath} for rendering`, () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'news-agent-assets-'));
    try {
      fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
      fs.mkdirSync(path.join(root, 'src/content'), { recursive: true });
      fs.copyFileSync(path.join(__dirname, 'agent-assets.js'), path.join(root, 'scripts/agent-assets.js'));
      fs.copyFileSync(path.join(__dirname, 'public-pages.cjs'), path.join(root, 'scripts/public-pages.cjs'));
      fs.copyFileSync(path.join(__dirname, '../src/content/billing-offers.ts'), path.join(root, 'src/content/billing-offers.ts'));
      const factsPath = path.join(__dirname, '../src/content/product-facts.json');
      fs.copyFileSync(factsPath, path.join(root, 'src/content/product-facts.json'));
      const template = '<html><head><title>Article rendering template</title></head><body></body></html>';
      for (const file of ['index.html', 'news/index.html', 'news/briefing.html', 'news/science.html', templatePath]) {
        const target = path.join(root, 'dist', file);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, template);
      }
      const authoredOrganisation = { '@type': 'Organization', name: 'Pre-rendered organisation' };
      fs.writeFileSync(path.join(root, 'dist/index.html'), template.replace('</head>',
        `<script data-rh="true" type="application/ld+json">${JSON.stringify(authoredOrganisation)}</script></head>`));
      const post = {
        slug: 'published', title: 'Published post', description: 'A genuine published article from FlowSmartly.',
        author: 'Test author', topic: 'Platform', date: '2026-01-06', updated: '2026-03-08',
      };
      fs.writeFileSync(path.join(root, 'src/content/posts.index.json'), JSON.stringify([
        post,
        { ...post, slug: 'authored', title: 'Pre-rendered article', updated: '2026-03-12' },
        { ...post, slug: 'unpublished' },
      ]));
      fs.mkdirSync(path.join(root, 'dist/resources/blog'), { recursive: true });
      fs.writeFileSync(path.join(root, 'dist/resources/index.html'), template);
      fs.writeFileSync(path.join(root, 'dist/resources/blog/index.html'), template);
      fs.writeFileSync(path.join(root, 'dist/resources/blog/published.html'), template);
      const authoredBlogSchemas = {
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'BlogPosting', headline: 'Pre-rendered article' },
          { '@type': 'BreadcrumbList', name: 'Pre-rendered trail' },
        ],
      };
      const authoredArticle = template.replace('</head>',
        `<script type="application/ld+json">${JSON.stringify(authoredBlogSchemas)}</script></head>`);
      fs.writeFileSync(path.join(root, 'dist/resources/blog/authored.html'), authoredArticle);
      fs.writeFileSync(path.join(root, 'dist/login.html'), template);
      fs.writeFileSync(path.join(root, 'dist/private.html'), template.replace('</head>', '<meta content="NOINDEX, follow" name="robots"></head>'));
      fs.mkdirSync(path.join(root, 'dist/platform'), { recursive: true });
      fs.writeFileSync(path.join(root, 'dist/platform/flowagent.html'), template);
      execFileSync(process.execPath, [path.join(root, 'scripts/agent-assets.js')], { stdio: 'pipe' });
      const sitemap = fs.readFileSync(path.join(root, 'dist/sitemap.xml'), 'utf8');
      const llms = fs.readFileSync(path.join(root, 'dist/llms.txt'), 'utf8');
      const feed = fs.readFileSync(path.join(root, 'dist/feed.xml'), 'utf8');
      const redirect = fs.readFileSync(path.join(root, 'dist/flow-ai/index.html'), 'utf8');
      const facts = JSON.parse(fs.readFileSync(factsPath, 'utf8'));
      const home = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8');
      const schemas = [...home.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
        .map(([, json]) => JSON.parse(json))
        .flat();
      const software = schemas.find((node) => node['@type'] === 'SoftwareApplication');
      assert.deepEqual(schemas.filter((node) => node['@type'] === 'Organization'), [authoredOrganisation]);
      assert.equal(schemas.filter((node) => node['@type'] === 'WebSite').length, 1);
      assert.equal(schemas.filter((node) => node['@type'] === 'SoftwareApplication').length, 1);
      assert.equal(software?.description, facts.overview.answer);
      assert.ok(llms.includes(facts.overview.answer));
      for (const { question, answer } of facts.questions) {
        assert.ok(llms.includes(question));
        assert.ok(llms.includes(answer));
      }
      assert.ok(software.offers.offers.every((offer) => !('availability' in offer)));
      for (const route of ['/news/article', '/login', '/private', '/flow-ai', '/resources/blog/unpublished']) {
        assert.ok(!sitemap.includes(`<loc>https://flowsmartly.com${route}</loc>`));
        assert.ok(!llms.includes(`(https://flowsmartly.com${route})`));
        assert.ok(!feed.includes(`<link>https://flowsmartly.com${route}</link>`));
      }
      for (const route of ['/news', '/news/briefing', '/news/science', '/platform/flowagent', '/resources/blog/published']) {
        assert.ok(sitemap.includes(`<loc>https://flowsmartly.com${route}</loc>`));
        assert.ok(llms.includes(`(https://flowsmartly.com${route})`));
      }
      assert.deepEqual([...sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map(([, date]) => date), ['2026-03-12', post.updated]);
      assert.match(redirect, /<link rel="canonical" href="https:\/\/flowsmartly.com\/platform\/flowagent">/);
      assert.ok(feed.includes('<link>https://flowsmartly.com/resources/blog/published</link>'));
      const article = fs.readFileSync(path.join(root, 'dist/resources/blog/published.html'), 'utf8');
      const [blogPosting, breadcrumb] = [...article.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(([, json]) => JSON.parse(json));
      assert.equal(blogPosting['@type'], 'BlogPosting');
      assert.equal(blogPosting.dateModified, post.updated);
      assert.equal(blogPosting.headline, post.title);
      assert.deepEqual(breadcrumb.itemListElement.map(({ item }) => new URL(item).pathname), ['/', '/resources', '/resources/blog', '/resources/blog/published']);
      assert.equal(fs.readFileSync(path.join(root, 'dist/resources/blog/authored.html'), 'utf8'), authoredArticle);
      assert.equal(fs.readFileSync(path.join(root, 'dist', templatePath), 'utf8'), template);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
}
