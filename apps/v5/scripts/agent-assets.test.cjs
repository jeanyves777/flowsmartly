/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

for (const templatePath of ['news/article.html', 'news/article/index.html']) {
  test(`indexes omit the slugless template but retain ${templatePath} for rendering`, () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'news-agent-assets-'));
    try {
      fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
      fs.mkdirSync(path.join(root, 'src/content'), { recursive: true });
      fs.copyFileSync(path.join(__dirname, 'agent-assets.js'), path.join(root, 'scripts/agent-assets.js'));
      fs.copyFileSync(path.join(__dirname, '../src/content/billing-offers.ts'), path.join(root, 'src/content/billing-offers.ts'));
      const template = '<html><head><title>Article rendering template</title></head><body></body></html>';
      for (const file of ['index.html', 'news/index.html', 'news/briefing.html', 'news/science.html', templatePath]) {
        const target = path.join(root, 'dist', file);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, template);
      }
      execFileSync(process.execPath, [path.join(root, 'scripts/agent-assets.js')], { stdio: 'pipe' });
      const sitemap = fs.readFileSync(path.join(root, 'dist/sitemap.xml'), 'utf8');
      const llms = fs.readFileSync(path.join(root, 'dist/llms.txt'), 'utf8');
      assert.ok(!sitemap.includes('<loc>https://flowsmartly.com/news/article</loc>'));
      assert.ok(!llms.includes('(https://flowsmartly.com/news/article)'));
      for (const route of ['/news', '/news/briefing', '/news/science']) {
        assert.ok(sitemap.includes(`<loc>https://flowsmartly.com${route}</loc>`));
        assert.ok(llms.includes(`(https://flowsmartly.com${route})`));
      }
      assert.equal(fs.readFileSync(path.join(root, 'dist', templatePath), 'utf8'), template);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
}
