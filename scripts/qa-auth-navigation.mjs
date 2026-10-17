#!/usr/bin/env node
/**
 * Focused check: public auth entry points leave the marketing SPA for the real forms.
 *
 * Serves a built `apps/v5/dist` the way the apex routes it: `/login` and `/register` belong to
 * ANOTHER application (stubbed here as two marker pages), everything else is this export. Then,
 * in a real browser:
 *   1. home → click "Log in"        → a DOCUMENT request for /login reaches the server
 *   2. home → click "Create account" → a DOCUMENT request for /register reaches the server
 *   3. a direct visit to /early-access → forwarded to /register, never a waiting-list form,
 *      keeping its query string and fragment
 *   4. loop guard: if /login were misrouted to this export, the forwarder must not reload forever
 *   5. no "Join early access" text is rendered on the home page
 *
 * Usage: node scripts/qa-auth-navigation.mjs --dist apps/v5/dist [--playwright <path to playwright-core>]
 * Exit 0 only when every check passes.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const DIST = resolve(arg('--dist', 'apps/v5/dist'));
const PW = arg('--playwright', 'playwright-core');
const { chromium } = await import(PW.includes('/') || PW.includes('\\') ? pathToFileURL(resolve(PW, 'index.mjs')).href : PW);

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain', '.xml': 'application/xml' };
const requests = [];
let misrouteLogin = false;

const stub = (marker) => `<!doctype html><title>${marker}</title><body><h1 id="marker">${marker}</h1></body>`;
const fileFor = async (path) => {
  for (const candidate of [path, `${path}.html`, join(path, 'index.html')]) {
    const full = join(DIST, candidate);
    if (!full.startsWith(DIST)) return undefined;
    try {
      if ((await stat(full)).isFile()) return full;
    } catch {
      /* next */
    }
  }
  return undefined;
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = decodeURIComponent(url.pathname);
  requests.push({ path, search: url.search, document: (req.headers['sec-fetch-dest'] ?? '') === 'document' });
  // The other application's routes, as the apex sends them there.
  if (path === '/register' || (path === '/login' && !misrouteLogin)) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(stub(path === '/login' ? 'PORTAL-LOGIN' : 'PORTAL-REGISTER'));
    return;
  }
  const file = await fileFor(path === '/' ? '/index.html' : path);
  if (!file) {
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    res.end(await readFile(join(DIST, '+not-found.html')).catch(() => 'not found'));
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(await readFile(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};
const docRequests = (p) => requests.filter((r) => r.path === p && r.document).length;

try {
  for (const [label, width] of [['desktop', 1440], ['phone', 390]]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(`${ORIGIN}/`, { waitUntil: 'networkidle' });
    const homeText = await page.locator('body').innerText();
    check(`${label}: no "Join early access" on the home page`, !/join (v5 )?early access/i.test(homeText));

    // "Log in" may sit behind the phone menu.
    let login = page.getByText('Log in', { exact: true }).first();
    if (!(await login.isVisible().catch(() => false))) {
      const menu = page.getByRole('button', { name: /open navigation/i }).first();
      if (await menu.isVisible().catch(() => false)) await menu.click();
      login = page.getByText('Log in', { exact: true }).first();
    }
    const beforeLogin = docRequests('/login');
    await Promise.all([page.waitForURL('**/login', { timeout: 15000 }).catch(() => undefined), login.click()]);
    await page.waitForTimeout(500);
    const loginMarker = await page.locator('#marker').innerText().catch(() => '');
    check(`${label}: "Log in" makes a document request for /login and reaches the real form`,
      docRequests('/login') === beforeLogin + 1 && loginMarker === 'PORTAL-LOGIN',
      `document requests ${docRequests('/login') - beforeLogin}, page "${loginMarker || (await page.title())}"`);

    await page.goto(`${ORIGIN}/`, { waitUntil: 'networkidle' });
    const beforeRegister = docRequests('/register');
    const create = page.getByText('Create account', { exact: true }).first();
    await Promise.all([page.waitForURL('**/register', { timeout: 15000 }).catch(() => undefined), create.click()]);
    await page.waitForTimeout(500);
    const registerMarker = await page.locator('#marker').innerText().catch(() => '');
    check(`${label}: "Create account" makes a document request for /register and reaches the real form`,
      docRequests('/register') === beforeRegister + 1 && registerMarker === 'PORTAL-REGISTER',
      `document requests ${docRequests('/register') - beforeRegister}, page "${registerMarker || (await page.title())}"`);
    await page.close();
  }

  const page = await browser.newPage();
  const beforeForward = docRequests('/register');
  await page.goto(`${ORIGIN}/early-access`, { waitUntil: 'load' });
  await page.waitForURL('**/register', { timeout: 15000 }).catch(() => undefined);
  await page.waitForTimeout(500);
  const forwardMarker = await page.locator('#marker').innerText().catch(() => '');
  check('direct /early-access is forwarded to /register (no waiting list)',
    docRequests('/register') === beforeForward + 1 && forwardMarker === 'PORTAL-REGISTER',
    `page "${forwardMarker || (await page.title())}"`);

  // The forward keeps campaign parameters and the fragment.
  await page.goto(`${ORIGIN}/early-access?utm_source=newsletter&ref=a1#plans`, { waitUntil: 'load' });
  await page.waitForURL('**/register?*', { timeout: 15000 }).catch(() => undefined);
  await page.waitForTimeout(500);
  const last = requests.filter((r) => r.path === '/register' && r.document).at(-1);
  const landed = new URL(page.url());
  check('the forward keeps the query and the fragment',
    last?.search === '?utm_source=newsletter&ref=a1' && landed.search === '?utm_source=newsletter&ref=a1' && landed.hash === '#plans',
    `server saw "${last?.search ?? ''}", page at "${landed.pathname}${landed.search}${landed.hash}"`);

  misrouteLogin = true;
  const beforeLoop = docRequests('/login');
  await page.goto(`${ORIGIN}/login`, { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const loopCount = docRequests('/login') - beforeLoop;
  check('loop guard: a /login misrouted to this export loads once and holds', loopCount === 1, `${loopCount} document load(s) in 3 s`);
  misrouteLogin = false;
  await page.close();
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed === 0 ? 0 : 1);
