const fs = require('node:fs');
const path = require('node:path');

const ORIGIN = 'https://flowsmartly.com';
const NOINDEX_ROUTES = new Set(['/early-access', '/login', '/solutions/agent-marketplace']);
// The backend uses this export to render published `/news/article?slug=…`
// URLs. The missing-slug shell is not itself a public article.
const ARTICLE_TEMPLATE = '/news/article';
const SKIP_DIRECTORIES = new Set(['_expo', 'assets', 'node_modules', '.well-known']);
// These destinations are owned by the portal or API in the apex vhost.
const APEX_RUNTIME_LINKS = new Set(['/login', '/register', '/_news/feed.json', '/_news/sitemap.xml']);

function attribute(tag, name) {
  const match = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
}

function metaContents(head, name) {
  return [...head.matchAll(/<meta\b[^>]*>/gi)]
    .filter(([tag]) => attribute(tag, 'name')?.toLowerCase() === name)
    .map(([tag]) => attribute(tag, 'content') || '');
}

function exportedPages(directory) {
  const routes = new Map();
  function walk(dir, prefix = '') {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory() && !SKIP_DIRECTORIES.has(entry.name)) {
        walk(file, `${prefix}/${entry.name}`);
      } else if (entry.isFile() && entry.name.endsWith('.html') && !entry.name.startsWith('_')) {
        const indexFile = entry.name === 'index.html';
        const route = indexFile ? prefix || '/' : `${prefix}/${entry.name.slice(0, -5)}`;
        // The apex serves `route.html` ahead of `route/index.html` when both exist.
        if (!indexFile || !routes.has(route)) routes.set(route, file);
      }
    }
  }
  walk(directory);

  return [...routes].sort(([a], [b]) => a.localeCompare(b)).map(([route, file]) => {
    const html = fs.readFileSync(file, 'utf8');
    const head = /<head\b[^>]*>([\s\S]*?)<\/head>/i.exec(html)?.[1] ?? '';
    const canonical = [...head.matchAll(/<link\b[^>]*>/gi)]
      .filter(([tag]) => attribute(tag, 'rel')?.toLowerCase() === 'canonical')
      .map(([tag]) => attribute(tag, 'href'));
    const noindex = ['robots', 'googlebot', 'bingbot'].flatMap((name) => metaContents(head, name))
      .some((content) => /(?:^|[,\s])(?:noindex|none)(?=$|[,\s])/i.test(content));
    const redirect = [...head.matchAll(/<meta\b[^>]*>/gi)]
      .map(([tag]) => attribute(tag, 'http-equiv')?.toLowerCase() === 'refresh' ? attribute(tag, 'content') : null)
      .find((content) => content && /;\s*url\s*=/i.test(content));
    const expectedNoindex = NOINDEX_ROUTES.has(route) || route === '/+not-found' || Boolean(redirect);
    const isPublic = !expectedNoindex && route !== ARTICLE_TEMPLATE;
    return { route, file, html, canonical, noindex, redirect, expectedNoindex, isPublic, indexable: isPublic && !noindex };
  });
}

function brokenPublicLinks(directory, pages) {
  const exportedRoutes = new Set(pages.filter(({ route }) => route !== '/+not-found' && route !== ARTICLE_TEMPLATE)
    .map(({ route }) => route));
  const broken = new Set();
  for (const page of pages.filter(({ isPublic }) => isPublic)) {
    const markup = page.html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
    for (const [tag] of markup.matchAll(/<a\b[^>]*>/gi)) {
      const href = attribute(tag, 'href');
      if (!href) continue;
      const url = URL.parse(href.replaceAll('&amp;', '&'), ORIGIN + page.route);
      if (!url || !['http:', 'https:'].includes(url.protocol) || !['flowsmartly.com', 'www.flowsmartly.com'].includes(url.hostname)) continue;
      const { pathname } = url;
      if (exportedRoutes.has(pathname) || APEX_RUNTIME_LINKS.has(pathname)) continue;
      if (pathname === ARTICLE_TEMPLATE && /^[a-z0-9-]+$/.test(url.searchParams.get('slug') || '')) continue;
      if (fs.statSync(path.join(directory, pathname), { throwIfNoEntry: false })?.isFile()) continue;
      broken.add(`${page.route} → ${pathname}${url.search}`);
    }
  }
  return [...broken];
}

module.exports = { ORIGIN, brokenPublicLinks, exportedPages };
