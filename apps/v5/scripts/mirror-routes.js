/* Local QA only: serve `/product/` as well as `/product.html`.
 *
 *   node scripts/mirror-routes.js
 *
 * `expo export` writes one file per route (`product.html`). A real web server
 * maps `/product` onto it; `python -m http.server` does not, so every route
 * 404s while reviewing a build locally. This copies each page to
 * `<route>/index.html` so the plain static server can serve the URLs the site
 * actually publishes.
 *
 * **Run it last.** It doubles the page count, so anything that walks `dist/`
 * and counts pages — the sitemap, the readiness audit — has to run first or it
 * sees every route twice.
 */
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');
const SKIP = new Set(['_expo', 'assets']);

let mirrored = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP.has(entry.name)) walk(full);
      continue;
    }
    if (!entry.name.endsWith('.html') || entry.name === 'index.html') continue;
    const asDirectory = full.slice(0, -'.html'.length);
    fs.mkdirSync(asDirectory, { recursive: true });
    fs.copyFileSync(full, path.join(asDirectory, 'index.html'));
    mirrored += 1;
  }
}

if (!fs.existsSync(DIST)) {
  console.error('mirror: dist/ is missing — run the export first');
  process.exitCode = 1;
} else {
  walk(DIST);
  console.log(`mirror: ${mirrored} routes also served as <route>/index.html`);
}
